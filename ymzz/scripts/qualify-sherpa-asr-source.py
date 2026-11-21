"""MIT. Independent native source candidate; NEVER selects/publishes a product.
Preserves unchanged actual DSH SenseVoice/VAD transcriber, tested with original
and rebuilt DLLs and real pinned offline models/audio. No paid/LLM transport.
"""
import argparse,hashlib,json,os,shutil,subprocess,sys,tarfile,urllib.request,wave
from pathlib import Path
REPO=Path(__file__).resolve().parents[2]
def sha(p):
 with p.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def contract(profile):
 for row in profile['consumers']:
  if sha(REPO/row['path'])!=row['sha256']:raise ValueError('DSH_SPEECH_CONSUMER_CHANGED_REVIEW_REQUIRED')
 tracked=subprocess.check_output(['git','ls-files','packages','apps','scripts'],cwd=REPO,text=True).splitlines();used=[]
 for name in tracked:
  if Path(name).suffix not in ('.ts','.tsx','.js','.mjs')or any(p in name for p in ('/test','/dist/','/lib/','/pool/')):continue
  if 'sherpa-onnx-node'in(REPO/name).read_text(encoding='utf-8'):used.append(name)
 if sorted(used)!=sorted(r['path']for r in profile['consumers']):raise ValueError('UNREVIEWED_DSH_SHERPA_CONSUMER '+str(used))
 if sha(REPO/profile['modelAssetsFile'])!=profile['modelAssetsSHA256']:raise ValueError('DSH_SPEECH_ASSETS_CHANGED_REVIEW_REQUIRED')
def fetch(row,dest):
 if dest.exists():
  if dest.stat().st_size!=row['bytes']or sha(dest)!=row['sha256']:raise ValueError('CACHED_SOURCE_OR_MODEL_PIN_MISMATCH '+dest.name)
 else:
  dest.parent.mkdir(parents=True,exist_ok=True)
  with urllib.request.urlopen(row['url'],timeout=180)as f:data=f.read(row['bytes']+1)
  if len(data)!=row['bytes']or hashlib.sha256(data).hexdigest()!=row['sha256']:raise ValueError('SOURCE_OR_MODEL_PIN_MISMATCH '+dest.name)
  dest.write_bytes(data)
 return dest
def extract(archive,dest):
 dest.mkdir(parents=True,exist_ok=True)
 with tarfile.open(archive)as t:t.extractall(dest,filter='data')
 return next(p for p in dest.iterdir()if p.is_dir())
def run(cmd,cwd=None):subprocess.run([str(x)for x in cmd],cwd=cwd,check=True,timeout=1800)
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--work',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--contract-only',action='store_true');a=p.parse_args();profile=json.loads((REPO/'ymzz/compliance/candidates/sherpa-asr-source-profile.json').read_text());contract(profile)
 if a.contract_only:print('Actual DSH Sherpa consumers unchanged; only OfflineRecognizer+Vad are used. Candidate NOT production.');return
 if sys.platform!='win32':raise ValueError('NATIVE_WINDOWS_REQUIRED')
 work=a.work.resolve();work.mkdir(parents=True,exist_ok=True)
 if(work/'source').exists():raise ValueError('USE_NEW_CANDIDATE_WORKDIR_PRESERVE_PREVIOUS')
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps({'schema':1,'status':'in-progress','phase':'source-build','productionSelected':False,'releaseCleared':False})+'\n')
 inputs=work/'inputs';source=profile['source'];archive=fetch(source,inputs/('sherpa-onnx-'+source['commit']+'.tar.gz'));src=extract(archive,work/'source');build=work/'build';install=build/'install'
 run(['cmake','-S',src,'-B',build,'-A','x64','-DCMAKE_INSTALL_PREFIX='+str(install),*profile['cmakeFlags']])
 cache=(build/'CMakeCache.txt').read_text()
 if 'SHERPA_ONNX_ENABLE_TTS:BOOL=OFF'not in cache:raise ValueError('TTS_PROFILE_NOT_ACTUAL')
 forbidden=[p.name for p in(build/'_deps').iterdir()if'espeak'in p.name.lower()or'piper'in p.name.lower()]
 if forbidden:raise ValueError('UNEXPECTED_GPL_DEPENDENCY '+str(forbidden))
 run(['cmake','--build',build,'--config','Release','--target','install','--parallel','4'])
 for row in profile['packages']:fetch(row,inputs/row['file'])
 models=json.loads((REPO/profile['modelAssetsFile']).read_text());assets=work/'assets'
 for row in [models['models']['int8'],models['tokens'],models['vad']]:fetch(row,assets/row['name'])
 for row in profile['testFixtures']:
  original=fetch(row,inputs/row['file'])
  # Browser recordings are canonical PCM16 WAV; normalize only the container,
  # keeping every original audio sample. Never relax the real DSH validator.
  with wave.open(str(original),'rb')as reader:
   if(reader.getnchannels(),reader.getsampwidth(),reader.getframerate())!=(1,2,16000):raise ValueError('AUDIO_FIXTURE_FORMAT')
   pcm=reader.readframes(reader.getnframes())
  with wave.open(str(assets/row['file']),'wb')as writer:
   writer.setnchannels(1);writer.setsampwidth(2);writer.setframerate(16000);writer.writeframes(pcm)
 if len(profile['testFixtures'])!=2:raise ValueError('BOTH_REAL_AUDIO_FIXTURES_REQUIRED')
 results={};native=[]
 for variant in ['original','source-candidate']:
  consumer=work/variant/'consumer';consumer.mkdir(parents=True,exist_ok=True);(consumer/'package.json').write_text('{"type":"module"}');nm=consumer/'node_modules';nm.mkdir(exist_ok=True)
  for name in ['inference.ts','input.ts']:shutil.copyfile(REPO/'packages/experimental/speech-to-text-sensevoice/src'/name,consumer/name)
  for row in profile['packages']:
   target=nm/row['name'];extracted=extract(inputs/row['file'],work/variant/row['name']);shutil.copytree(extracted,target)
  platform=nm/'sherpa-onnx-win-x64'
  if variant=='source-candidate':
   for name in ['sherpa-onnx-c-api.dll','sherpa-onnx-cxx-api.dll']:
    matches=list((install/'lib').glob(name));
    if len(matches)!=1:raise ValueError('REBUILT_NATIVE_OUTPUT_MISSING '+name)
    shutil.copyfile(matches[0],platform/name)
  data=(platform/'sherpa-onnx-c-api.dll').read_bytes();markers=[b'CallPhonemizeEspeak',b'Failed to initialize espeak-ng with data dir']
  if variant=='original'and not all(s in data for s in markers):raise ValueError('ORIGINAL_NATIVE_ESPEAK_EVIDENCE_CHANGED')
  if variant=='source-candidate'and any(s in data for s in markers):raise ValueError('ESPEAK_IMPLEMENTATION_IN_REBUILT_NATIVE')
  wave=nm/'@deepseek-ai/dsh-experimental-speech-to-text';wave.mkdir(parents=True);(wave/'package.json').write_text('{"type":"module","exports":{"./wave":"./wave.mjs"}}')
  run(['node',REPO/'ymzz/scripts/probe-sherpa-transcriber.mjs','--prepare-wave',REPO/'packages/experimental/speech-to-text/src/wave.ts',wave/'wave.mjs'])
  result=work/(variant+'-transcriber.json');run(['node',REPO/'ymzz/scripts/probe-sherpa-transcriber.mjs',consumer,assets,result]);results[variant]=json.loads(result.read_text())
  if variant=='source-candidate':
   native=[{'file':p.name,'sha256':sha(p),'bytes':p.stat().st_size}for p in sorted(platform.iterdir())if p.suffix.lower()in('.dll','.node')]
 atext=[r['text']for r in results['original']['transcripts']];btext=[r['text']for r in results['source-candidate']['transcripts']]
 if atext!=btext or any(len(t.strip())<2 for t in btext):raise ValueError('ACTUAL_DSH_OFFLINE_TRANSCRIBER_RESULT_MISMATCH')
 report={'schema':1,'status':'passed','sourceCommit':source['commit'],'sourceArchiveSHA256':source['sha256'],'cmakeFlags':profile['cmakeFlags'],'espeakAndPiperBuildDependencies':forbidden,'originalVsCandidateDSHTranscriptEquality':True,'actualTranscriber':results,'nativeFiles':native,'productionSelected':False,'releaseCleared':False,'limits':'Independent source candidate/native DSH STT proof only. Not full Sherpa TTS parity, model accuracy/performance parity, final installed product/GUI, ORT constituent source closure or a distribution approval.'};a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in report.items()if k not in('actualTranscriber','nativeFiles')},indent=2))
if __name__=='__main__':
 try:main()
 except Exception as error:
  import re
  message=re.sub(r'https?://[^\s]+','[public URL omitted]',str(error))[:2000]
  if '--output'in sys.argv:
   target=Path(sys.argv[sys.argv.index('--output')+1]);target.parent.mkdir(parents=True,exist_ok=True)
   target.write_text(json.dumps({'schema':1,'status':'failed','errorType':type(error).__name__,'error':message,'productionSelected':False,'releaseCleared':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  print(type(error).__name__+': '+message,file=sys.stderr);sys.exit(1)
