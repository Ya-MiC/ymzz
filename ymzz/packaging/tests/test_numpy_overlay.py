"""MIT. Synthetic inert ZIP/filesystem unit fixtures; never executable/qualification evidence."""
import importlib.util, json, tempfile, unittest, zipfile
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('overlay',Path(__file__).parents[1]/'numpy_source_overlay.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class OverlayTests(unittest.TestCase):
 def fixture(self,work):
  site=work/'payload/resources/site-packages';site.mkdir(parents=True)
  for name in m.ROOTS:(site/name).mkdir()
  (site/'numpy/old.py').write_bytes(b'preserved original namespace')
  (site/'numpy-2.3.5.dist-info/LICENSE.txt').write_bytes(b'original archive fixture')
  dll=site/'numpy.libs/libscipy_openblas64_-9e3e5a4229c1ca39f10dc82bba9e2b2b.dll';dll.write_bytes(b'inert original DLL fixture')
  wheel=work/'fixture.whl';files={'numpy/__init__.py':b'# inert unit fixture','numpy/_core/inert.pyd':b'not executable','numpy-2.3.5.dist-info/METADATA':b'Name: numpy\nVersion: 2.3.5\n','numpy-2.3.5.dist-info/LICENSE.txt':b'Synthetic unit license text; not a public grant for any third party'}
  with zipfile.ZipFile(wheel,'w') as z:
   for n,b in files.items():z.writestr(n,b)
  proof={'status':'passed','sourceVersion':'2.3.5','checks':[{'passed':True} for _ in range(3)],'wheelSHA256':m.digest(wheel.read_bytes()),'sourceSHA256':'unit-only','nativeImports':[{'file':'numpy/_core/inert.pyd','sha256':m.digest(files['numpy/_core/inert.pyd']),'dependencies':['KERNEL32.dll']}],'wheelLicenseFiles':[{'path':'numpy-2.3.5.dist-info/LICENSE.txt','sha256':m.digest(files['numpy-2.3.5.dist-info/LICENSE.txt'])}],'tradeoff':'fixture only'}
  marker=work/'payload/resources/overlay.json';backups=work/'outside-distribution';backups.mkdir()
  return site,wheel,proof,marker,backups,dll
 def test_complete_namespace_replacement_preserves_original_outside_payload_and_is_idempotent(self):
  with tempfile.TemporaryDirectory(prefix='NumPy 中文 空格 ') as tmp:
   site,wheel,proof,marker,backups,dll=self.fixture(Path(tmp))
   with patch.object(m,'ORIGINAL_DLL_SHA256',m.digest(dll.read_bytes())):
    result=m.apply_overlay(wheel,site,proof,marker,backups)
    self.assertTrue(result['wholeNamespaceReplacement']);self.assertFalse(result['releaseCleared'])
    self.assertFalse((site/'numpy/old.py').exists());self.assertFalse((site/'numpy.libs').exists())
    saved=list(backups.glob('*/numpy/old.py'));self.assertEqual(len(saved),1);self.assertEqual(saved[0].read_bytes(),b'preserved original namespace')
    self.assertEqual(m.apply_overlay(wheel,site,proof,marker,backups),result)
    (site/'numpy/unknown.py').write_text('unexpected')
    with self.assertRaisesRegex(ValueError,'UNEXPECTED_INSTALLED_FILE'):m.apply_overlay(wheel,site,proof,marker,backups)
 def test_failed_post_swap_verification_rolls_back_every_original_namespace(self):
  with tempfile.TemporaryDirectory() as tmp:
   site,wheel,proof,marker,backups,dll=self.fixture(Path(tmp))
   with patch.object(m,'ORIGINAL_DLL_SHA256',m.digest(dll.read_bytes())),patch.object(m,'verify_installed',side_effect=ValueError('INJECTED_POST_SWAP_FAILURE')):
    with self.assertRaisesRegex(ValueError,'POST_SWAP'):m.apply_overlay(wheel,site,proof,marker,backups)
   self.assertTrue(dll.exists());self.assertEqual((site/'numpy/old.py').read_bytes(),b'preserved original namespace');self.assertFalse(marker.exists());self.assertFalse((site/'numpy/_core/inert.pyd').exists())
 def test_unknown_original_never_mutates(self):
  with tempfile.TemporaryDirectory() as tmp:
   site,wheel,proof,marker,backups,dll=self.fixture(Path(tmp))
   with self.assertRaisesRegex(ValueError,'UNKNOWN_ORIGINAL'):m.apply_overlay(wheel,site,proof,marker,backups)
   self.assertTrue(dll.exists());self.assertFalse(marker.exists())
 def test_tampered_wheel_or_native_manifest_fails_before_changes(self):
  with tempfile.TemporaryDirectory() as tmp:
   site,wheel,proof,marker,backups,dll=self.fixture(Path(tmp));proof['wheelSHA256']='bad'
   with self.assertRaisesRegex(ValueError,'WHEEL_HASH'):m.apply_overlay(wheel,site,proof,marker,backups)
   self.assertTrue(dll.exists())
   proof['wheelSHA256']=m.digest(wheel.read_bytes());proof['nativeImports'][0]['sha256']='bad'
   with self.assertRaisesRegex(ValueError,'NATIVE_GRAPH'):m.apply_overlay(wheel,site,proof,marker,backups)
 def test_backup_inside_payload_is_forbidden(self):
  with tempfile.TemporaryDirectory() as tmp:
   site,wheel,proof,marker,backups,dll=self.fixture(Path(tmp));bad=site/'backup';bad.mkdir()
   with self.assertRaisesRegex(ValueError,'BACKUP_INSIDE'):m.apply_overlay(wheel,site,proof,marker,bad)
 def test_linked_root_is_rejected_before_resolving_it(self):
  with tempfile.TemporaryDirectory() as tmp:
   site,wheel,proof,marker,backups,dll=self.fixture(Path(tmp));link=Path(tmp)/'link';link.symlink_to(site,target_is_directory=True)
   with self.assertRaisesRegex(ValueError,'PAYLOAD_LINK'):m.apply_overlay(wheel,link,proof,marker,backups)
 def test_archive_traversal_is_rejected_even_for_a_unit_fixture_with_its_own_hash(self):
  with tempfile.TemporaryDirectory() as tmp:
   site,wheel,proof,marker,backups,dll=self.fixture(Path(tmp))
   with zipfile.ZipFile(wheel,'a')as z:z.writestr('numpy/../../escaped.py',b'inert fixture')
   proof['wheelSHA256']=m.digest(wheel.read_bytes())
   with self.assertRaisesRegex(ValueError,'WHEEL_PATH'):m.apply_overlay(wheel,site,proof,marker,backups)
   self.assertTrue(dll.exists());self.assertFalse((site.parent/'escaped.py').exists())
 def test_no_gnu_dependency_can_be_reclassified_by_a_marker(self):
  with tempfile.TemporaryDirectory() as tmp:
   site,wheel,proof,marker,backups,dll=self.fixture(Path(tmp));proof['nativeImports'][0]['dependencies'].append('libgcc_s.dll')
   with self.assertRaisesRegex(ValueError,'GNU_IMPORT'):m.apply_overlay(wheel,site,proof,marker,backups)
if __name__=='__main__':unittest.main()
