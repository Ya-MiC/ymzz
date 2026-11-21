"""MIT. Exact native rights/source coverage, distinct from npm declaration policy.
An original permissive grant needs notices, NOT invented complete-source delivery.
A matching LGPL/MPL source proof cannot excuse a missing grant or an unknown DLL.
"""
import argparse,hashlib,importlib.util,json
from pathlib import Path
REPO=Path(__file__).resolve().parents[2]
SOURCE_GROUPS={'office013','sharp-vips','electron-ffmpeg','lxml-iconv'}
def digest(p):
 with Path(p).open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def load_module(name,file):
 s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
NATIVE=load_module('ymzz_native_inventory',Path(__file__).with_name('inventory-native-payload.py'))
def identity(row):return(row['root'],row['path'],row['sha256'],row['bytes'])
def source_verified(group,sources,inventory):
 r=sources.get(group,{})
 return r.get('verified')is True and r.get('proof',{}).get('installedInventoryMatch',{}).get('appAsarSHA256')==inventory.get('appAsarSHA256') and bool(inventory.get('appAsarSHA256'))
def evaluate(inventory,matrix,sources,actual_roots_verified=False,producer_proofs=None):
 if matrix.get('schema')!=1:raise ValueError('NATIVE_MATRIX_SCHEMA')
 components={r['id']:r for r in matrix['components']}
 if len(components)!=len(matrix['components']):raise ValueError('DUPLICATE_NATIVE_COMPONENT')
 expected={};hashes=set()
 for r in matrix['nativeFiles']:
  if r['component']not in components:raise ValueError('UNKNOWN_MATRIX_COMPONENT')
  if r['sha256']in hashes:raise ValueError('DUPLICATE_NATIVE_HASH')
  hashes.add(r['sha256'])
  for loc in r['locations']:
   k=(loc['root'],loc['path'])
   if k in expected:raise ValueError('DUPLICATE_NATIVE_LOCATION')
   expected[k]=r
 notices={(r['sha256'],r['bytes'])for r in inventory.get('originalNoticeFiles',[])if NATIVE.is_notice_path(r['path'])}
 holds=[];used=set();seen=set();matched=0;variations=[]
 for r in inventory['nativeFiles']:
  k=(r['root'],r['path'])
  if k in seen:raise ValueError('DUPLICATE_ACTUAL_NATIVE_LOCATION')
  seen.add(k);pin=expected.get(k)
  if pin and(pin['sha256'],pin['bytes'])!=(r['sha256'],r['bytes']):
   proof=(producer_proofs or{}).get(k,{});profile=matrix.get('producerIdentities',{}).get(pin['component'],{})
   if actual_roots_verified and pin['component']=='electron-chromium'and profile.get('kind')=='electron-resource-rebrand-v1'and profile.get('location')=={'root':r['root'],'path':r['path']}and proof.get('codeIdentityVerified')is True and proof.get('referenceSHA256')==profile.get('referenceExeSHA256')and proof.get('actualExecutableSHA256')==r['sha256']and proof.get('currentAppAsarSHA256')==inventory.get('appAsarSHA256'):
    used.add(pin['component']);matched+=1;variations.append(proof);continue
  if not pin or(pin['sha256'],pin['bytes'])!=(r['sha256'],r['bytes']):
   holds.append({'kind':'unknown-or-changed-native','root':r['root'],'path':r['path'],'sha256':r['sha256']});continue
  used.add(pin['component']);matched+=1
 if not seen:holds.append({'kind':'empty-native-payload'})
 for root,relative in sorted(set(expected)-seen):holds.append({'kind':'expected-native-missing','root':root,'path':relative,'detail':'A payload deletion requires explicit reviewed feature-preserving matrix revision; it cannot green the source/license gate.'})
 outcomes=[];required=set()
 for name in sorted(used):
  c=components[name];issues=[];group=c.get('sourceGroup')
  if name in SOURCE_GROUPS and(group!=name or c.get('obligation')!='covered-source-and-replacement'):raise ValueError('COVERED_SOURCE_OBLIGATION_REMOVED '+name)
  if c.get('obligation')not in ('original-notices','covered-source-and-replacement','unapproved-copyleft'):raise ValueError('UNKNOWN_NATIVE_OBLIGATION')
  if c.get('sourceObligationsReviewed')is not True:issues.append({'kind':'native-obligation-review-required','detail':'Actual constituent source obligations not fully classified; no blanket permissive npm inheritance'})
  if c.get('grantReviewed')is not True:issues.append({'kind':'grant-review-required','detail':c.get('reviewHold','Original constituent grant remains unverified')})
  if c.get('policyHold'):issues.append({'kind':'native-license-policy-hold','detail':c['policyHold']})
  pins=c.get('originalNoticePins',[])
  if not pins:issues.append({'kind':'original-grant-notice-missing'})
  for n in pins:
   if(n['sha256'],n['bytes'])not in notices:issues.append({'kind':'original-notice-not-shipped-or-changed','sha256':n['sha256'],'path':n.get('examplePath')})
  if c['obligation']in ('covered-source-and-replacement','unapproved-copyleft'):
   required.add(group)
   if not group or not source_verified(group,sources,inventory):issues.append({'kind':'matching-covered-source-materials-missing','group':group,'detail':sources.get(group,{}).get('error')})
  outcomes.append({'component':name,'licenseBasis':c['licenseBasis'],'obligation':c['obligation'],'originalNoticePinsVerified':len(pins)-sum(i['kind']=='original-notice-not-shipped-or-changed'for i in issues),'passed':not issues,'issues':issues})
  holds.extend({'component':name,**i}for i in issues)
 source_pass=bool(used)and all(components[name].get('sourceObligationsReviewed')is True for name in used)and all(source_verified(g,sources,inventory)for g in required)
 coverage=bool(seen)and matched==len(seen)and set(expected)==seen
 rights=bool(used)and coverage and not any(i['kind']!='matching-covered-source-materials-missing'for i in holds)
 inspected=actual_roots_verified and bool(seen)
 return {'schema':1,'scope':'All current native hash/path identities, original grant notices, and selective corresponding-source obligations. No source duty is inferred from a permissive DLL.','nativeRepresentations':len(seen),'nativeRepresentationsMatched':matched,'nativeCoverageComplete':coverage,'verifiedNativeProducerVariations':variations,'packagedNativePayloadInspected':inspected,'nativeRightsVerified':rights,'requiredSourceGroups':sorted(required),'correspondingSourceMaterialsVerified':source_pass,'components':outcomes,'sourceResults':sources,'holds':holds,'nativeGatePassed':inspected and rights and source_pass,'releaseCleared':False}
def verify_sources(materials,inventory):
 result={}
 if not materials:return result
 for group in sorted(SOURCE_GROUPS):
  try:
   if group=='sharp-vips':
    m=load_module('ymzz_sharp_sources',Path(__file__).with_name('verify_sharp_sources.py'));proof=m.verify(json.loads((REPO/'ymzz/compliance/sharp-win32-sources.lock.json').read_text()),json.loads((REPO/'ymzz/compliance/sharp-win32-native.lock.json').read_text()),materials/'06-ymzz-libvips-all-constituents-PENDING.zip',materials/'05-ymzz-libvips-rsvg-rust-sources-PENDING.zip',inventory)
   elif group=='office013':
    m=load_module('ymzz_office_sources',Path(__file__).with_name('verify_office_sources.py'));proof=m.verify(materials/'04-ymzz-office013-corresponding-sources-PENDING.zip',materials/'07-ymzz-office013-all-external-sources-PENDING.zip',inventory)
   else:
    m=load_module('ymzz_shared_static_sources',Path(__file__).with_name('verify_shared_static_sources.py'));proof=m.verify(group,materials/'08-ymzz-ffmpeg-lxml-relink-sources-PENDING.zip',inventory)
   binding=proof.get('installedInventoryMatch')or{}
   if binding.get('inventorySHA256')!=digest(inventory):raise ValueError('SOURCE_INPUT_INVENTORY_BINDING_MISMATCH')
   result[group]={'verified':True,'proof':proof}
  except (OSError,ValueError,KeyError,AssertionError)as e:result[group]={'verified':False,'error':type(e).__name__+': '+str(e)}
 return result
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--inventory',type=Path,required=True);p.add_argument('--matrix',type=Path,default=REPO/'ymzz/compliance/native-obligations.lock.json');p.add_argument('--installed',type=Path);p.add_argument('--asar-copy',type=Path);p.add_argument('--source-materials',type=Path);p.add_argument('--electron-reference',type=Path,default=REPO/'apps/desktop/.desktop-build/targets/win-x64/electron/electron.exe');p.add_argument('--output',type=Path);a=p.parse_args()
 inventory=json.loads(a.inventory.read_text(encoding='utf-8'));bound=False
 if bool(a.installed)!=bool(a.asar_copy):raise ValueError('BOTH_ACTUAL_ROOTS_REQUIRED')
 if a.installed:
  fresh=NATIVE.inspect([('actual-installed',a.installed),('actual-app-asar',a.asar_copy)])
  if sorted(map(identity,fresh['nativeFiles']))!=sorted(map(identity,inventory['nativeFiles'])):raise ValueError('CURRENT_NATIVE_PAYLOAD_CHANGED_OR_INCOMPLETE_INVENTORY')
  if digest(a.installed/'resources/app.asar')!=inventory['appAsarSHA256']:raise ValueError('CURRENT_ASAR_BINDING_MISMATCH')
  inventory['originalNoticeFiles']=fresh['originalNoticeFiles'];bound=True
 source_results=verify_sources(a.source_materials,a.inventory)
 matrix=json.loads(a.matrix.read_text(encoding='utf-8'));producer_proofs={};producer_issues=[]
 if bound and a.electron_reference.is_file():
  profile=matrix.get('producerIdentities',{}).get('electron-chromium',{});where=profile.get('location',{})
  if where=={'root':'actual-installed','path':'湛箴_ymzz.exe'}:
   try:
    pe=load_module('ymzz_generated_pe',Path(__file__).with_name('verify_generated_pe.py'));proof=pe.compare(a.electron_reference.read_bytes(),(a.installed/where['path']).read_bytes(),profile['referenceExeSHA256'],pe.asar_header_digest(a.installed/'resources/app.asar'));proof['currentAppAsarSHA256']=inventory['appAsarSHA256'];producer_proofs[(where['root'],where['path'])]=proof
   except (OSError,ValueError,KeyError)as e:producer_issues.append({'component':'electron-chromium','kind':'generated-pe-code-identity-not-verified','detail':str(e)})
 report=evaluate(inventory,matrix,source_results,bound,producer_proofs);report['producerIdentityDiagnostics']=producer_issues
 report.update({'inventorySHA256':digest(a.inventory),'matrixSHA256':digest(a.matrix),'appAsarSHA256':inventory.get('appAsarSHA256'),'actualRootsVerified':bound})
 text=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
 if a.output:a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(text,encoding='utf-8')
 print(text,end='')
if __name__=='__main__':main()
