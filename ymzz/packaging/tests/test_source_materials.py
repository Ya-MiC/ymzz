"""Synthetic negative material tests; no large downloads or success-shaped mock receipts."""
import copy,importlib.util,io,json,sys,tempfile,unittest,warnings,zipfile,hashlib
from pathlib import Path
SCRIPTS=Path(__file__).resolve().parents[2]/'scripts';sys.path.insert(0,str(SCRIPTS))
import verify_sharp_sources as sharp
import verify_office_sources as office
class SourceMaterialsTests(unittest.TestCase):
    def setUp(self):
        self.profile=json.loads((sharp.REPO/'ymzz/compliance/sharp-win32-sources.lock.json').read_text());self.native=json.loads((sharp.REPO/'ymzz/compliance/sharp-win32-native.lock.json').read_text())
    def test_current_constituents_cover_exact_native_set(self):sharp.validate_components(self.profile,self.native)
    def test_missing_constituent(self):
        self.profile['components'].pop()
        with self.assertRaisesRegex(ValueError,'CONSTITUENT_SET'):sharp.validate_components(self.profile,self.native)
    def test_version_drift(self):
        self.profile['components'][0]['version']='0.0.0'
        with self.assertRaisesRegex(ValueError,'VERSION_MISMATCH'):sharp.validate_components(self.profile,self.native)
    def test_duplicate_constituent(self):
        self.profile['components'].append(self.profile['components'][0])
        with self.assertRaisesRegex(ValueError,'DUPLICATE_COMPONENT'):sharp.validate_components(self.profile,self.native)
    def test_unsafe_source_filename(self):
        self.profile['components'][0]['file']='../../unexpected'
        with self.assertRaisesRegex(ValueError,'UNSAFE'):sharp.validate_components(self.profile,self.native)
    def check_zip(self,members,rows):
        b=io.BytesIO()
        with warnings.catch_warnings(),zipfile.ZipFile(b,'w')as z:
            warnings.simplefilter('ignore',UserWarning)
            for name,data in members:z.writestr(name,data)
        with zipfile.ZipFile(b)as z:sharp.verify_zip(z,rows)
    def test_tampered_source(self):
        row={'path':'source.tar','bytes':4,'sha256':hashlib.sha256(b'good').hexdigest()}
        with self.assertRaisesRegex(ValueError,'SHA256_MISMATCH'):self.check_zip([('source.tar',b'evil')],[row])
    def test_duplicate_zip(self):
        with self.assertRaisesRegex(ValueError,'DUPLICATE_ZIP'):self.check_zip([('same',b'a'),('same',b'a')],[])
    def test_zip_path_escape(self):
        with self.assertRaisesRegex(ValueError,'UNSAFE_MATERIAL_PATH'):self.check_zip([('../escape',b'a')],[])
    def test_zip_symlink(self):
        link=zipfile.ZipInfo('linked');link.external_attr=0o120777<<16
        with self.assertRaisesRegex(ValueError,'MATERIAL_SYMLINK'):self.check_zip([(link,b'target')],[])
    def office_plan(self):
        downloads=office.parse_downloads('SKIA_SHA256SUM := '+64*'a'+'\nSKIA_VERSION := 1\nSKIA_TARBALL := skia-$(SKIA_VERSION).tar.xz\nFONT_TEST_SHA256SUM := '+64*'b'+'\nFONT_TEST_TARBALL := font.zip\n')
        rows=[{'key':k,'file':f,'sha256':h}for k,(f,h)in downloads.items()]
        return {'sources':[r for r in rows if not office.excluded(r['key'])],'excluded':[r for r in rows if office.excluded(r['key'])]},downloads,['--without-fonts','--without-java','--enable-python=no','--without-lxml']
    def test_original_download_variable_expansion(self):
        p,d,c=self.office_plan();self.assertEqual(d['SKIA'][0],'skia-1.tar.xz');office.validate_external_plan(p,d,c)
    def test_exclusion_requires_actual_native_configuration(self):
        p,d,c=self.office_plan();c.remove('--without-fonts')
        with self.assertRaisesRegex(ValueError,'EXCLUSION_NOT_CONFIGURED'):office.validate_external_plan(p,d,c)
    def test_omitted_static_constituent(self):
        p,d,c=self.office_plan();p['sources']=[]
        with self.assertRaisesRegex(ValueError,'SOURCE_SET_MISMATCH'):office.validate_external_plan(p,d,c)
    def test_changed_office_source_pin(self):
        p,d,c=self.office_plan();p['sources'][0]['sha256']='c'*64
        with self.assertRaisesRegex(ValueError,'CORE_DOWNLOAD_PIN'):office.validate_external_plan(p,d,c)
if __name__=='__main__':unittest.main()
