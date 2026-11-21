"""MIT. Reconstruct pinned SOURCE-ONLY 04-08 assets on any CI runner.
Each inner byte is authoritative; original ZIP compression/timestamps are not source.
No installer, runtime bundle, license policy change, upload, or unsafe extraction.
"""
import argparse,concurrent.futures,hashlib,json,os,shutil,urllib.parse,urllib.request,zipfile
from pathlib import Path
from verify_sharp_sources import REPO,require,file_digest,safe_name,verify_exact_entries
HOSTS={'cairographics.org','chromium.googlesource.com','codeload.github.com','dev-www.libreoffice.org','download.gnome.org','download.osgeo.org','downloads.sourceforge.net','files.pythonhosted.org','ftp-osl.osuosl.org','ftp.osuosl.org','github.com','gitlab.freedesktop.org','static.crates.io','storage.googleapis.com','www.libarchive.org','xorg.freedesktop.org'}
def validate_url(url):
 p=urllib.parse.urlparse(url);require(p.scheme=='https'and p.hostname in HOSTS and not p.username and not p.password and p.port in(None,443)and not p.fragment,'UNREVIEWED_SOURCE_ORIGIN')
def valid(p,r):return p.is_file()and not p.is_symlink()and p.stat().st_size==r['bytes']and file_digest(p)==r['sha256']
def validate_plan(plan):
 require(plan['schema']==1 and bool(plan['assets']),'SOURCE_STAGE_SCHEMA');names=set();known={}
 for asset in plan['assets']:
  safe_name(asset['file']);require('/'not in asset['file']and asset['file']not in names,'DUPLICATE_OR_UNSAFE_ASSET');names.add(asset['file']);entries=set()
  for r in asset['entries']:
   safe_name(r['path']);require(Path(r['path']).suffix.lower()not in{'.exe','.dll','.node','.pyd','.wasm','.so'},'RUNTIME_IN_SOURCE_ASSET');require(r['path']not in entries,'DUPLICATE_SOURCE_ENTRY');entries.add(r['path']);require(len(r['sha256'])==64 and all(c in'0123456789abcdef'for c in r['sha256'])and isinstance(r['bytes'],int)and r['bytes']>0,'INVALID_SOURCE_ENTRY_PIN')
   require(bool(r.get('repoFile'))!=bool(r.get('urls')),'AMBIGUOUS_SOURCE_ORIGIN')
   if r.get('repoFile'):safe_name(r['repoFile']);require(r['repoFile'].startswith('ymzz/compliance/reconstruction/'),'SOURCE_REPO_INPUT_OUTSIDE_REVIEWED_ROOT')
   for url in r.get('urls',[]):validate_url(url)
   require(r['sha256']not in known or known[r['sha256']]['bytes']==r['bytes'],'CONFLICTING_SOURCE_PIN');known.setdefault(r['sha256'],r)
 return known

def fetch(r,cache,download):
 p=cache/r['sha256'];require(not p.is_symlink(),'SOURCE_CACHE_LINK')
 if p.exists():require(valid(p,r),'CHANGED_SOURCE_CACHE '+r['sha256']);return p
 if r.get('repoFile'):
  source=REPO/r['repoFile'];require(source.resolve().is_relative_to(REPO.resolve())and valid(source,r),'CHANGED_REPO_SOURCE_INPUT');shutil.copyfile(source,p);return p
 require(download,'MISSING_OFFLINE_SOURCE '+r['path'])
 for url in r['urls']:
  tmp=cache/(r['sha256']+'.partial-'+str(os.getpid()))
  try:
   validate_url(url)
   with urllib.request.urlopen(url,timeout=120)as response,tmp.open('xb')as output:
    require(urllib.parse.urlparse(response.geturl()).scheme=='https','INSECURE_SOURCE_REDIRECT');size=0;h=hashlib.sha256()
    while chunk:=response.read(1024*1024):
     size+=len(chunk);require(size<=r['bytes'],'SOURCE_DOWNLOAD_TOO_LARGE');output.write(chunk);h.update(chunk)
   require(size==r['bytes']and h.hexdigest()==r['sha256'],'SOURCE_DOWNLOAD_PIN_MISMATCH');tmp.rename(p);return p
  except Exception:
   if tmp.exists():tmp.unlink()
 raise ValueError('NO_VERIFIED_SOURCE_MIRROR '+r['path'])

def stage(plan,cache,output,seeds=None,download=False):
 rows=validate_plan(plan);cache.mkdir(parents=True,exist_ok=True);output.mkdir(parents=True,exist_ok=True);require(not cache.is_symlink()and not output.is_symlink(),'SOURCE_STAGE_ROOT_LINK')
 if seeds:
  for asset in plan['assets']:
   seed=seeds/asset['file']
   if not seed.exists():continue
   require(not seed.is_symlink(),'SOURCE_SEED_LINK')
   with zipfile.ZipFile(seed)as z:
    verify_exact_entries(z,asset['entries'])
    for r in asset['entries']:
     dest=cache/r['sha256'];require(not dest.is_symlink(),'SOURCE_CACHE_LINK')
     if dest.exists():require(valid(dest,r),'CHANGED_SOURCE_CACHE');continue
     with z.open(r['path'])as source,dest.open('xb')as target:shutil.copyfileobj(source,target)
 with concurrent.futures.ThreadPoolExecutor(max_workers=6)as pool:list(pool.map(lambda r:fetch(r,cache,download),rows.values()))
 assets=[]
 for asset in plan['assets']:
  p=output/asset['file'];require(not p.is_symlink(),'SOURCE_OUTPUT_LINK')
  if not p.exists():
   with zipfile.ZipFile(p,'x',compression=zipfile.ZIP_STORED)as z:
    for r in asset['entries']:
     info=zipfile.ZipInfo(r['path'],(1980,1,1,0,0,0));info.external_attr=0o100644<<16
     with z.open(info,'w',force_zip64=True)as target,(cache/r['sha256']).open('rb')as source:shutil.copyfileobj(source,target)
  require(not p.is_symlink(),'SOURCE_OUTPUT_LINK')
  with zipfile.ZipFile(p)as z:verify_exact_entries(z,asset['entries'])
  assets.append({'file':asset['file'],'bytes':p.stat().st_size,'sha256':file_digest(p),'sourceEntriesVerified':len(asset['entries']),'historicalContainerMatched':file_digest(p)==asset['originalContainerSHA256']})
 return {'schema':1,'sourceOnly':True,'sourceEntriesVerified':sum(len(a['entries'])for a in plan['assets']),'uniqueSourceObjectsVerified':len(rows),'assets':assets,'releaseCleared':False}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--cache',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--seed-archives',type=Path);p.add_argument('--download-missing',action='store_true');p.add_argument('--report',type=Path);a=p.parse_args();plan=json.loads((REPO/'ymzz/compliance/source-staging.lock.json').read_text(encoding='utf-8'));result=stage(plan,a.cache,a.output,a.seed_archives,a.download_missing);text=json.dumps(result,indent=2)+'\n'
 if a.report:a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(text,encoding='utf-8')
 print(text,end='')
if __name__=='__main__':main()
