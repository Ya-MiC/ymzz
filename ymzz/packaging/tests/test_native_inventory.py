"""MIT. Inert synthetic headers, never executable/native qualification proof."""
import importlib.util,struct,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('native',Path(__file__).parents[2]/'scripts/inventory-native-payload.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PE(unittest.TestCase):
 def test_native_or_source_in_third_party_is_not_a_license(self):
  for p in ['third_party/conpty/conpty.dll','licenses/plugin.exe','licenses/code.py','third_party/README.md']:
   self.assertFalse(m.is_notice_path(p),p)
 def test_actual_original_legal_text_names(self):
  for p in ['LICENSES.chromium.html','package/LICENSE','x.dist-info/licenses/COPYING.LGPL','licenses/vendor.txt','third_party/conpty/LICENSE']:
   self.assertTrue(m.is_notice_path(p),p)
 def fixture(self):
  b=bytearray(1024);b[:2]=b'MZ';struct.pack_into('<I',b,0x3c,0x80);b[0x80:0x84]=b'PE\0\0';struct.pack_into('<H',b,0x84,0x8664);struct.pack_into('<H',b,0x86,1);struct.pack_into('<H',b,0x94,240);struct.pack_into('<H',b,0x98,0x20b);struct.pack_into('<I',b,0x98+60,512);struct.pack_into('<I',b,0x98+108,16);return b
 def test_minimal_header(self):self.assertEqual(m.pe_imports(self.fixture()),{'machine':'0x8664','format':'PE32+','imports':[],'delayImports':[]})
 def test_valid_zero_size_directory_still_reads_terminated_imports(self):
  b=self.fixture();section=0x98+240;struct.pack_into('<IIII',b,section+8,512,0x1000,512,512);struct.pack_into('<II',b,0x98+112+8,0x1000,0);struct.pack_into('<I',b,512+12,0x1040);b[576:589]=b'KERNEL32.dll\0';self.assertEqual(m.pe_imports(b)['imports'],['KERNEL32.dll'])
 def test_invalid_signature(self):
  with self.assertRaisesRegex(ValueError,'MZ'):m.pe_imports(b'not PE')
 def test_unmapped_import_is_not_silently_ignored(self):
  b=self.fixture();struct.pack_into('<II',b,0x98+112+8,0x4000,20)
  with self.assertRaisesRegex(ValueError,'UNMAPPED'):m.pe_imports(b)
if __name__=='__main__':unittest.main()
