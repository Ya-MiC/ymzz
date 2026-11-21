import hashlib,importlib.util,json,struct,tempfile,unittest
from pathlib import Path
p=Path(__file__).resolve().parents[2]/'scripts/verify_generated_pe.py';spec=importlib.util.spec_from_file_location('pe_identity',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class GeneratedPeTests(unittest.TestCase):
 def test_exact_wire_state_only_not_neighboring_code(self):
  a=b'prefix'+m.SENTINEL+bytes([1,8])+b'11111111'+b'immutable';b=a.replace(b'11111111',b'01111111');out,changes=m.fuse_normalize(a,b);self.assertEqual(out,a);self.assertEqual(changes,[0])
 def test_unknown_fuse_state_rejected(self):
  a=m.SENTINEL+bytes([1,8])+b'11111111'
  with self.assertRaisesRegex(ValueError,'UNSUPPORTED_FUSE_STATE'):m.fuse_normalize(a,a[:-1]+b'X')
 def test_fuse_growth_and_movement_rejected(self):
  a=m.SENTINEL+bytes([1,8])+b'11111111'
  for b in (b'X'+a,a.replace(bytes([1,8]),bytes([1,9]))):
   with self.assertRaises(ValueError):m.fuse_normalize(a,b)
 def test_asar_hash_is_actual_utf8_header_not_manifest_flag(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d)/'app.asar';data=json.dumps({'files':{'中文.txt':{'size':0}}},ensure_ascii=False).encode();padded=(len(data)+3)//4*4;header=struct.pack('<II',padded+4,len(data))+data+b'\0'*(padded-len(data));p.write_bytes(struct.pack('<II',4,len(header))+header);self.assertEqual(m.asar_header_digest(p),hashlib.sha256(data).hexdigest());p.write_bytes(p.read_bytes()[:16])
   with self.assertRaisesRegex(ValueError,'TRUNCATED'):m.asar_header_digest(p)
 def test_manifest_cannot_change_execution_privilege(self):
  a=b'<assembly><assemblyIdentity name="electron"/><requestedExecutionLevel level="asInvoker"/></assembly>';b=a.replace(b'electron',b'ymzz');self.assertEqual(m.manifest(a),m.manifest(b));self.assertNotEqual(m.manifest(a),m.manifest(a.replace(b'asInvoker',b'requireAdministrator')))
if __name__=='__main__':unittest.main()
