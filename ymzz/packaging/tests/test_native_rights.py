"""MIT. Synthetic coverage fixtures, not native/GUI qualification results."""
import copy,importlib.util,json,sys,tempfile,unittest,zipfile
from pathlib import Path
SCRIPTS=Path(__file__).parents[2]/'scripts';sys.path.insert(0,str(SCRIPTS))
from verify_native_rights import evaluate
from verify_shared_static_sources import compiled,verify
class NativeRights(unittest.TestCase):
 def fixture(self,name='permissive'):
  self.i={'appAsarSHA256':'a'*64,'nativeFiles':[{'root':'actual-installed','path':'one.dll','sha256':'b'*64,'bytes':100}],'originalNoticeFiles':[{'path':'LICENSE','sha256':'c'*64,'bytes':50}]}
  self.m={'schema':1,'components':[{'id':name,'grantReviewed':True,'sourceObligationsReviewed':True,'licenseBasis':'MIT original grant, not package metadata','obligation':'original-notices','originalNoticePins':[{'sha256':'c'*64,'bytes':50}]}],'nativeFiles':[{'component':name,'sha256':'b'*64,'bytes':100,'locations':[{'root':'actual-installed','path':'one.dll'}]}]}
  return self.i,self.m
 def test_permissive_notice_only_does_not_need_any_source(self):
  i,m=self.fixture();r=evaluate(i,m,{},True);self.assertTrue(r['nativeGatePassed']);self.assertEqual(r['requiredSourceGroups'],[])
 def test_copyleft_requires_real_bound_source_proof(self):
  i,m=self.fixture('office013');m['components'][0].update(obligation='covered-source-and-replacement',sourceGroup='office013')
  self.assertFalse(evaluate(i,m,{},True)['nativeGatePassed'])
  self.assertFalse(evaluate(i,m,{'office013':{'verified':True}},True)['nativeGatePassed'])
  proof={'office013':{'verified':True,'proof':{'installedInventoryMatch':{'appAsarSHA256':'a'*64}}}}
  self.assertTrue(evaluate(i,m,proof,True)['nativeGatePassed']);proof['office013']['proof']['installedInventoryMatch']['appAsarSHA256']='d'*64
  self.assertFalse(evaluate(i,m,proof,True)['nativeGatePassed'])
 def test_removing_known_source_obligation_is_not_a_fix(self):
  i,m=self.fixture('office013')
  with self.assertRaisesRegex(ValueError,'OBLIGATION_REMOVED'):evaluate(i,m,{},True)
 def test_changed_native_hash_blocks(self):
  i,m=self.fixture();i['nativeFiles'][0]['sha256']='d'*64;self.assertFalse(evaluate(i,m,{},True)['nativeCoverageComplete'])
 def test_known_native_hash_at_unreviewed_path_blocks(self):
  i,m=self.fixture();i['nativeFiles'][0]['path']='renamed.dll';self.assertFalse(evaluate(i,m,{},True)['nativeGatePassed'])
 def test_new_native_not_hidden_by_known_package(self):
  i,m=self.fixture();i['nativeFiles'].append({'root':'actual-installed','path':'new.dll','sha256':'d'*64,'bytes':20,'npmPackage':'MIT-label'})
  self.assertFalse(evaluate(i,m,{},True)['nativeGatePassed'])
 def test_missing_or_changed_original_notice_blocks(self):
  for field,value in [('bytes',51),('sha256','d'*64)]:
   i,m=self.fixture();i['originalNoticeFiles'][0][field]=value;self.assertFalse(evaluate(i,m,{},True)['nativeGatePassed'])
 def test_third_party_dll_is_not_a_grant(self):
  i,m=self.fixture();i['originalNoticeFiles'][0]['path']='third_party/LICENSE.dll';self.assertFalse(evaluate(i,m,{},True)['nativeGatePassed'])
 def test_baseline_inventory_is_not_current_installed_inspection(self):
  i,m=self.fixture();r=evaluate(i,m,{});self.assertTrue(r['nativeRightsVerified']);self.assertFalse(r['nativeGatePassed']);self.assertFalse(r['packagedNativePayloadInspected'])
 def test_gpl_native_hold_not_overridden_by_npm_apache_or_source(self):
  i,m=self.fixture();m['components'][0]['licenseBasis']='Apache-2.0 npm label';m['components'][0]['policyHold']='Static GPL dependency unapproved';self.assertFalse(evaluate(i,m,{},True)['nativeRightsVerified'])
 def test_dual_ftl_and_unshipped_gpl_tools_are_not_bare_gpl(self):
  i,m=self.fixture();m['components'][0]['licenseBasis']='Original FreeType FTL OR GPL; FTL selected. XZ0BSD library; GPL auxiliary tools NOT shipped.';self.assertTrue(evaluate(i,m,{},True)['nativeGatePassed'])
 def test_unclassified_constituent_obligations_keep_global_source_hold(self):
  i,m=self.fixture();m['components'][0]['sourceObligationsReviewed']=False;r=evaluate(i,m,{},True);self.assertFalse(r['correspondingSourceMaterialsVerified']);self.assertFalse(r['nativeGatePassed'])
 def test_unapproved_native_copyleft_is_not_notice_only(self):
  i,m=self.fixture();m['components'][0].update(obligation='unapproved-copyleft',sourceGroup='sherpa-espeak-gpl',policyHold='No waiver');r=evaluate(i,m,{},True);self.assertIn('sherpa-espeak-gpl',r['requiredSourceGroups']);self.assertFalse(r['correspondingSourceMaterialsVerified'])
 def test_duplicate_native_location_rejected(self):
  i,m=self.fixture();i['nativeFiles']*=2
  with self.assertRaisesRegex(ValueError,'DUPLICATE_ACTUAL'):evaluate(i,m,{},True)
 def test_empty_payload_cannot_pass_vacuously(self):
  i,m=self.fixture();i['nativeFiles']=[];self.assertFalse(evaluate(i,m,{},True)['nativeGatePassed'])
 def test_copying_lib_is_text_not_an_object_archive(self):
  self.assertFalse(compiled(b'GNU LESSER GENERAL PUBLIC LICENSE'))
  self.assertTrue(compiled(b'!<arch>\nnot-source'));self.assertTrue(compiled(b'\x7fELFbinary'))
 def test_extra_runtime_in_source_asset_rejected_before_source_fetch(self):
  profile=json.loads((SCRIPTS.parent/'compliance/shared-static-sources.lock.json').read_text());names=[r['path']for r in profile['sources']+profile['texts']]+['compliance/shared-static-sources.lock.json','unneeded-node.exe']
  with tempfile.TemporaryDirectory()as d:
   p=Path(d)/'bad.zip'
   with zipfile.ZipFile(p,'w')as z:
    for n in names:z.writestr(n,'synthetic')
   with self.assertRaisesRegex(ValueError,'EXTRA_OR_MISSING'):verify('electron-ffmpeg',p)
if __name__=='__main__':unittest.main()
