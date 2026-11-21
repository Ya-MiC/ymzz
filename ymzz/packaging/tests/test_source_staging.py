import hashlib,importlib.util,io,json,tempfile,unittest,zipfile
from pathlib import Path
P=Path(__file__).resolve().parents[2]/'scripts';import sys;sys.path.insert(0,str(P))
spec=importlib.util.spec_from_file_location('stage_source_materials',P/'stage_source_materials.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StagingTests(unittest.TestCase):
 def row(self):return {'path':'sources/original.tar.gz','bytes':3,'sha256':hashlib.sha256(b'abc').hexdigest(),'urls':['https://static.crates.io/crates/a/a-1.crate']}
 def plan(self,row=None):return {'schema':1,'assets':[{'file':'04-test.zip','originalContainerSHA256':'0'*64,'entries':[row or self.row()]}]}
 def test_exact_source_bytes_accept_changed_zip_timestamp_and_compression(self):
  row=self.row()
  for compression in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED):
   b=io.BytesIO()
   with zipfile.ZipFile(b,'w',compression=compression)as z:z.writestr(row['path'],b'abc')
   with zipfile.ZipFile(io.BytesIO(b.getvalue()))as z:m.verify_exact_entries(z,[row])
 def test_extra_runtime_or_text_never_accepted(self):
  for name in ('native.dll','extra.txt'):
   b=io.BytesIO()
   with zipfile.ZipFile(b,'w')as z:z.writestr(self.row()['path'],b'abc');z.writestr(name,b'extra')
   with zipfile.ZipFile(io.BytesIO(b.getvalue()))as z,self.assertRaisesRegex(ValueError,'EXTRA_OR_MISSING'):m.verify_exact_entries(z,[self.row()])
 def test_mutated_inner_source_rejected(self):
  b=io.BytesIO()
  with zipfile.ZipFile(b,'w')as z:z.writestr(self.row()['path'],b'abd')
  with zipfile.ZipFile(io.BytesIO(b.getvalue()))as z,self.assertRaisesRegex(ValueError,'MATERIAL_SHA256'):m.verify_exact_entries(z,[self.row()])
 def test_unreviewed_http_and_credentials_rejected(self):
  for url in ('http://static.crates.io/a','https://user:pass@static.crates.io/a','https://127.0.0.1/a'):
   with self.assertRaisesRegex(ValueError,'UNREVIEWED'):m.validate_url(url)
 def test_runtime_outer_entry_and_traversal_rejected(self):
  for path in ('runtime/node.exe','../source.tar.gz'):
   row=self.row();row['path']=path
   with self.assertRaises(ValueError):m.validate_plan(self.plan(row))
 def test_broken_source_cache_symlink_rejected_before_write(self):
  with tempfile.TemporaryDirectory()as d:
   root=Path(d);cache=root/'cache';cache.mkdir();row=self.row();outside=root/'outside';(cache/row['sha256']).symlink_to(outside)
   with self.assertRaisesRegex(ValueError,'SOURCE_CACHE_LINK'):m.fetch(row,cache,False)
   self.assertFalse(outside.exists())
 def test_fresh_cas_stage_is_deterministic_without_original_container(self):
  with tempfile.TemporaryDirectory()as d:
   root=Path(d);cache=root/'cas';cache.mkdir();(cache/self.row()['sha256']).write_bytes(b'abc');a=m.stage(self.plan(),cache,root/'a');b=m.stage(self.plan(),cache,root/'b');self.assertEqual(a['assets'][0]['sha256'],b['assets'][0]['sha256']);self.assertFalse(a['assets'][0]['historicalContainerMatched']);self.assertFalse(a['releaseCleared'])
 def test_duplicate_plan_rejected(self):
  p=self.plan();p['assets'][0]['entries'].append(self.row())
  with self.assertRaisesRegex(ValueError,'DUPLICATE_SOURCE_ENTRY'):m.validate_plan(p)
if __name__=='__main__':unittest.main()
