"""MIT. Inert source archive extraction tests, not Windows native evidence."""
import hashlib,importlib.util,io,tarfile,tempfile,unittest
from pathlib import Path
s=importlib.util.spec_from_file_location('sherpa_source',Path(__file__).parents[2]/'scripts/qualify-sherpa-asr-source.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
DEMO='scripts/go/_internal/vad-spoken-language-identification/main.go'
class SourceExtract(unittest.TestCase):
 def archive(self,root,path,target):
  p=root/'fixture.tar.gz'
  with tarfile.open(p,'w:gz')as t:
   n=tarfile.TarInfo('source/CMakeLists.txt');data=b'# inert source';n.size=len(data);t.addfile(n,io.BytesIO(data))
   n=tarfile.TarInfo('source/'+path);n.type=tarfile.SYMTYPE;n.linkname=target;t.addfile(n)
  return p
 def test_cmake_chinese_space_path_is_read_as_utf8_not_windows_ansi(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d)/'CMakeCache.txt';text='CMAKE_HOME_DIRECTORY:INTERNAL=D:/源碼 space/build';p.write_text(text,encoding='utf-8');self.assertEqual(m.read_utf8(p),text)
 def test_unknown_absolute_source_link_remains_rejected(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d);a=self.archive(p,'sherpa-onnx/csrc/trap','/outside/source')
   with self.assertRaises(tarfile.FilterError):m.extract(a,p/'output')
 def test_only_pinned_unbuilt_demo_link_omitted_and_never_dereferenced(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d);a=self.archive(p,DEMO,'/not-accessed');r=m.extract(a,p/'output',[{'path':DEMO,'targetSHA256':hashlib.sha256(b'/not-accessed').hexdigest()}]);self.assertTrue((r/'CMakeLists.txt').is_file());self.assertFalse((r/DEMO).exists())
 def test_changed_demo_link_does_not_use_filename_allowlist(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d);a=self.archive(p,DEMO,'/changed')
   with self.assertRaisesRegex(ValueError,'DEMO_LINK_CHANGED'):m.extract(a,p/'output',[{'path':DEMO,'targetSHA256':'0'*64}])
 def test_cannot_exempt_cxx_source(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d);a=self.archive(p,'sherpa-onnx/csrc/trap','/outside')
   with self.assertRaisesRegex(ValueError,'CANNOT_OMIT_CXX'):m.extract(a,p/'output',[{'path':'sherpa-onnx/csrc/trap','targetSHA256':hashlib.sha256(b'/outside').hexdigest()}])
if __name__=='__main__':unittest.main()
