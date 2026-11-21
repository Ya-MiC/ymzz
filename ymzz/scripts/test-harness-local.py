"""MIT. POSIX CI/local full-DSH HTTP acceptance; ephemeral own profile, no browser/live model."""
import argparse,json,os,re,signal,subprocess,sys,tempfile,time,hashlib
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=3092);p.add_argument('--output',required=True);args=p.parse_args()
assert os.name=='posix','Use the existing native Windows qualification workflow on Windows'
assert 1024<=args.port<=65535
out=Path(args.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
base=repo/'ymzz/.build';base.mkdir(parents=True,exist_ok=True);private=Path(tempfile.mkdtemp(prefix='harness-private-',dir=base));log=private/'private-launch.log';home=private/'home'
# Do not print/upload launch URLs, cookies, raw server logs or profile state.
with log.open('w')as stream:
 os.chmod(log,0o600)
 server=subprocess.Popen(['node',str(repo/'ymzz/scripts/dev.mjs'),'--no-open','--port',str(args.port)],cwd=repo,env={**os.environ,'YMZZ_HOME':str(home),'YMZZ_AGENTS_HOME':str(home/'agents')},stdout=stream,stderr=stream,start_new_session=True)
 try:
  deadline=time.monotonic()+90
  while time.monotonic()<deadline:
   if server.poll()is not None:raise RuntimeError('OWN_HARNESS_SERVER_START_FAILED')
   if 'dsh web: http://127.0.0.1:'in log.read_text(errors='replace'):break
   time.sleep(.2)
  else:raise RuntimeError('OWN_HARNESS_SERVER_START_TIMEOUT')
  subprocess.run([sys.executable,str(repo/'ymzz/scripts/smoke-product.py'),'--launch-log',str(log),'--output',str(out),'--state-file',str(home/'ymzz/tasks.json')],cwd=repo,check=True,timeout=180)
  proof=json.loads(out.read_text());capsule=out.with_suffix('.capsule.json');capsule.write_text(json.dumps(proof['acceptanceCapsule'],ensure_ascii=False,indent=2)+'\n')
  subprocess.run(['node',str(repo/'ymzz/scripts/verify-acceptance-capsule.mjs'),str(capsule)],cwd=repo,check=True,timeout=10)
  broken=json.loads(capsule.read_text());broken['payload']['receipt']['payload']['revision']+=1;tampered=private/'tampered-capsule.json';tampered.write_text(json.dumps(broken));bad=subprocess.run(['node',str(repo/'ymzz/scripts/verify-acceptance-capsule.mjs'),str(tampered)],cwd=repo,capture_output=True,timeout=10);assert bad.returncode!=0,'TAMPERED_CAPSULE_CLI_ACCEPTED'
  files=['packages/ymzz/product/acceptance.mjs','packages/ymzz/product/index.mjs','packages/ymzz/product/ui.js','ymzz/scripts/smoke-product.py','packages/ymzz/product/web-guidance.mjs','packages/ymzz/product/univer-assets.mjs','ymzz/integrations/univer/editor.js','ymzz/integrations/univer/snapshot.mjs','ymzz/integrations/univer/build.mjs','ymzz/integrations/univer/package-lock.json']
  proof['harnessAcceptance']={'fullDSHHTTP':True,'offlineCapsuleCLI':True,'tamperedCapsuleCLIRejected':True,'newFeatureWindowsGUIQualified':False,'explicitReceiptContextHTTPPreview':True,'sourceFilesSHA256':{f:hashlib.sha256((repo/f).read_bytes()).hexdigest()for f in files}}
  out.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');print('Real full DSH acceptance -> content drift rejection -> fresh memory -> capsule/CLI passed; no live inference')
 finally:
  if server.poll()is None:
   os.killpg(server.pid,signal.SIGTERM)
   try:server.wait(timeout=15)
   except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait(timeout=5)
