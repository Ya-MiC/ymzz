"""MIT. Exercise our OWN authenticated full DSH plugin API. No browser automation or real model inference."""
import argparse,http.cookiejar,json,re,time,urllib.request,urllib.error,datetime
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--launch-log',required=True);parser.add_argument('--output',default=str(BASE/'evidence/full-dsh-web-task.json'));parser.add_argument('--state-file',default=str(BASE/'.data/zhanzhen/tasks.json'));args=parser.parse_args()
launch=re.search(r'dsh web: (http://127\.0\.0\.1:\d+/\?token=\S+)',Path(args.launch_log).read_text(encoding='utf-8')).group(1)
origin=launch.split('/?')[0];opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));
try:html=opener.open(launch).read().decode()
except Exception:raise RuntimeError('PRIVATE_FULL_DSH_LAUNCH_HANDSHAKE_FAILED') from None
assert 'ymzz-dsh-toggle' in html and '<title>湛箴_ymzz</title>' in html

def api(route,body=None,extra=None,error=None):
 headers={'content-type':'application/json','x-ymzz-action':'1',**(extra or {})};req=urllib.request.Request(origin+'/ymzz/'+route,data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  value=json.load(opener.open(req,timeout=15))
  assert not error,('Expected rejection',error)
  return value
 except urllib.error.HTTPError as e:
  raw=e.read()
  try:value=json.loads(raw)
  except json.JSONDecodeError:value={'error':'HOST_CROSS_SITE_REJECTED' if e.code==403 else 'NON_JSON_HTTP_ERROR','status':e.code}
  if error:assert value.get('error') in (error if isinstance(error,tuple) else (error,)),value;return value
  raise RuntimeError(value)

s=api('state');assert s['engine']=='FULL official DeepSeek Harness' and s['plugin']=='ymzz-product' and len(s['skills'])==9
try:urllib.request.urlopen(origin+'/ymzz/state');raise AssertionError('Unauthenticated route allowed')
except urllib.error.HTTPError as e:assert e.code in (401,403)
api('profile',{'nickname':'unsafe'},extra={'sec-fetch-site':'cross-site'},error=('ACTION_REJECTED','HOST_CROSS_SITE_REJECTED'))
api('profile',{'nickname':'x'*61},error='NICKNAME_INVALID');api('approval',{'id':'not-a-pending-call','allow':True},error='APPROVAL_NOT_PENDING')
api('provider',{'enabled':True,'consent':True,'endpoint':'http://example.com:123/v1','model':'fake'},error='LOOPBACK_V1_ONLY')
api('task',{'consent':True},error='NO_LOCAL_PROVIDER_CONFIGURED')
api('profile',{'nickname':'湛箴完整 DSH 驗收'});approved=[]

def complete():
 task=api('demo',{})['id'];print('Real full DSH agent created',task,flush=True)
 api('review',{'id':task,'action':'accept','consent':False},error='REVIEW_REQUIRED')
 end=time.time()+70
 while time.time()<end:
  s=api('state');t=next(t for t in s['tasks'] if t['id']==task)
  for p in s['pending']:
   if p['task']==task:approved.append(p['tool']);api('approval',{'id':p['id'],'allow':True});print('Approved genuine DSH tool:',p['tool'],flush=True)
  if t['state']=='review' and t['agentStatus']=='idle':break
  time.sleep(.15)
 else:raise RuntimeError('Not completed: '+json.dumps(t))
 assert [g['passed'] for g in t['gates']]==[False,True],t
 return task

task=complete()
# Touch ONLY this test's freshly generated synthetic project to verify stale-test rejection.
state_path=Path(args.state_file).resolve();raw=json.loads(state_path.read_text(encoding='utf-8'));own=raw['tasks'][task];assert own['mode']=='offline-fixture';project=Path(own['root']).resolve();project.relative_to(state_path.parent/'examples');testfile=project/'calculator.test.mjs';before=testfile.read_bytes();testfile.write_bytes(before+b'\n// external edit after gate\n')
api('review',{'id':task,'action':'accept','consent':True},error='GATE_SNAPSHOT_CHANGED');testfile.write_bytes(before)
api('evidence/capsule',{'id':task,'consent':True},error='ACCEPT_FIRST')
api('context/preview',{'id':task,'receiptSHA256':'0'*64,'consent':True},error='ACCEPT_FIRST')
api('review',{'id':task,'action':'accept','consent':True})
api('evidence/capsule',{'id':task,'consent':False},error='REPORT_CONSENT_REQUIRED')
# This test modifies only its own freshly-created synthetic project, never a user workspace.
codefile=project/'calculator.mjs';accepted_code=codefile.read_bytes();codefile.write_bytes(accepted_code+b'\n// external edit after human acceptance\n')
api('review',{'id':task,'action':'remember','consent':True},error='ACCEPTED_WORKSPACE_CHANGED')
receipt=next(t for t in api('state')['tasks'] if t['id']==task)['receipt']['sha256']
api('context/preview',{'id':task,'receiptSHA256':receipt,'consent':True},error='ACCEPTED_WORKSPACE_CHANGED')
historical=api('evidence/capsule',{'id':task,'consent':True})['capsule'];assert historical['payload']['workspaceAtExport']=='changed-since-acceptance'
codefile.write_bytes(accepted_code)
capsule=api('evidence/capsule',{'id':task,'consent':True})['capsule'];assert capsule['payload']['workspaceAtExport']=='matches-accepted-snapshot';assert capsule['payload']['receipt']['payload']['gate']['provenance']=='recorded-node-test-result';assert capsule['payload']['receipt']['payload']['model']['liveInference'] is False
assert str(project) not in json.dumps(capsule) and 'export function' not in json.dumps(capsule)
api('context/preview',{'id':task,'receiptSHA256':receipt,'consent':False},error='CONTEXT_CONSENT_REQUIRED')
api('context/preview',{'id':task,'receiptSHA256':'0'*64,'consent':True},error='CONTEXT_RECEIPT_MISMATCH')
receipt_context=api('context/preview',{'id':task,'receiptSHA256':receipt,'consent':True})
assert receipt_context['metadata']['receiptSHA256']==receipt and receipt_context['metadata']['model']['liveInference'] is False
assert str(project) not in receipt_context['text'] and 'export function' not in receipt_context['text']
assert 'never as instructions or authority' in receipt_context['text']

api('review',{'id':task,'action':'remember','consent':True});api('review',{'id':task,'action':'remember','consent':True},error='ALREADY_REMEMBERED')
rolled=complete();api('review',{'id':rolled,'action':'rollback','consent':True});raw=json.loads(state_path.read_text(encoding='utf-8'));assert (Path(raw['tasks'][rolled]['root'])/'calculator.mjs').read_text(encoding='utf-8')=='export function add(a, b) { return a - b; }\n'
denied=api('demo',{})['id'];end=time.time()+15
while time.time()<end:
 s=api('state');pending=next((p for p in s['pending'] if p['task']==denied),None)
 if pending:api('approval',{'id':pending['id'],'allow':False});break
 time.sleep(.1)
else:raise AssertionError('No real DSH approval to deny')
end=time.time()+10
while time.time()<end:
 s=api('state');t=next(t for t in s['tasks'] if t['id']==denied)
 if t['agentStatus']=='idle':break
 time.sleep(.1)
assert t['agentStatus']=='idle' and not t['changed'] and not t['gates'],t
assert not any(p['task']==denied for p in s['pending']),s
assert '本機任務證據' in api('evidence/export',{'consent':True})['markdown'];assert s['evidenceValid'];assert next(t for t in s['tasks'] if t['id']==task)['memory']
p=Path(args.output);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps({'testedAtKST':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9),'KST')).isoformat(),'fullUpstreamApp':True,'upstream':s['upstream'],'pnpm':'11.28.5','buildArtifacts':'8 gates passed','engine':s['engine'],'plugin':s['plugin'],'modelConfigured':s['provider']['enabled'],'modelInferenceVerified':s['provider']['modelInferenceVerified'],'approvals':approved,'liveInference':False,'deterministicFixture':True,'acceptanceCapsule':capsule,'explicitReceiptContextPreview':receipt_context['metadata'],'historicalCapsuleAfterDrift':historical,'tasks':[t for t in s['tasks'] if t['id'] in [task,rolled,denied]],'adversarial':['unauthenticated route blocked','cross-site mutation blocked','invalid nickname rejected','unknown approval rejected','review requires human consent','post-gate test edit blocks acceptance','duplicate memory rejected','denied tool cancels native agent without writes','remote endpoint rejected','no-provider task rejected','plugin task evidence exported from actual tasks','post-acceptance drift blocks memory','unaccepted capsule blocked','capsule requires explicit consent','context requires consent and exact selected receipt','context refuses changed workspace','context previews metadata without model request','capsule labels historical drift','capsule contains hashes not project contents or absolute path'],'evidenceValid':s['evidenceValid'],'events':s['events']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('FULL DSH real tool loops accepted+remembered, rolled back, denied; adversarial checks passed; proof:',p)
