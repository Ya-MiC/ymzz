"""MIT. Reproducible source/TEXT-only asset08, no original binary/npm runtime."""
import argparse,hashlib,json,urllib.parse,urllib.request,zipfile
from pathlib import Path
REPO=Path(__file__).resolve().parents[2]
def sha(p):
 with p.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def assemble(research,output,download=False):
 profile_file=REPO/'ymzz/compliance/shared-static-sources.lock.json';profile=json.loads(profile_file.read_text(encoding='utf-8'));members=[]
 for r in profile['sources']:
  candidates=[research/r['file'],research/'native-coverage'/r['file']];p=next((p for p in candidates if p.is_file()),None)
  if p is None:
   if not download:raise ValueError('MISSING_SOURCE '+r['file'])
   url=urllib.parse.urlparse(r['url'])
   if url.scheme!='https'or url.hostname not in ('codeload.github.com','files.pythonhosted.org','chromium.googlesource.com'):raise ValueError('UNREVIEWED_SOURCE_HOST')
   p=research/r['file'];p.parent.mkdir(parents=True,exist_ok=True)
   with urllib.request.urlopen(r['url'],timeout=120)as f:data=f.read(r['bytes']+1)
   if len(data)!=r['bytes']or hashlib.sha256(data).hexdigest()!=r['sha256']:raise ValueError('SOURCE_DOWNLOAD_PIN_MISMATCH')
   p.write_bytes(data)
  if p.is_symlink()or p.stat().st_size!=r['bytes']or sha(p)!=r['sha256']:raise ValueError('SOURCE_PIN_MISMATCH '+r['file'])
  members.append((r['path'],p.read_bytes()))
 for r in profile['texts']:
  p=REPO/r['path']
  if p.stat().st_size!=r['bytes']or sha(p)!=r['sha256']:raise ValueError('REBUILD_TEXT_CHANGED '+r['path'])
  members.append((r['path'],p.read_bytes()))
 members.append(('compliance/shared-static-sources.lock.json',profile_file.read_bytes()));output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_STORED)as z:
  for name,data in sorted(members):
   info=zipfile.ZipInfo(name,(1980,1,1,0,0,0));info.external_attr=0o100644<<16;z.writestr(info,data)
 return {'filename':output.name,'bytes':output.stat().st_size,'sha256':sha(output),'members':len(members),'published':False}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--research',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--download-missing',action='store_true');a=p.parse_args();print(json.dumps(assemble(a.research,a.output,a.download_missing),indent=2))
