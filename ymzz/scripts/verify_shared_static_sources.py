"""MIT. Rehash minimal FFmpeg/lxml/iconv corresponding-source/relink delivery.
Never demand complete source for standalone permissive binaries. Never use a
version label instead of exact native/source pins or a prebuilt .lib as source.
"""
import argparse,hashlib,io,json,re,tarfile,zipfile
from pathlib import Path
from verify_sharp_sources import verify_zip,require,file_digest,digest
REPO=Path(__file__).resolve().parents[2]
def compiled(data):
 if data.startswith((b'\x7fELF',b'\0asm',b'!<arch>\n')):return True
 if data[:2]==b'MZ'and len(data)>=64:
  p=int.from_bytes(data[60:64],'little');return data[p:p+4]==b'PE\0\0'
 return False
def verify(group,archive,inventory=None):
 require(group in ('electron-ffmpeg','lxml-iconv'),'UNKNOWN_SHARED_STATIC_GROUP')
 profile_file=REPO/'ymzz/compliance/shared-static-sources.lock.json';profile=json.loads(profile_file.read_text(encoding='utf-8'));sources=profile['sources'];texts=profile['texts'];all_rows=sources+texts
 expected={r['path']for r in all_rows}|{'compliance/shared-static-sources.lock.json'}
 with zipfile.ZipFile(archive)as z:
  require(set(z.namelist())==expected and len(z.namelist())==len(expected),'EXTRA_OR_MISSING_SHARED_SOURCE_MEMBER')
  verify_zip(z,all_rows)
  require(z.read('compliance/shared-static-sources.lock.json')==profile_file.read_bytes(),'SHARED_SOURCE_PROFILE_CHANGED')
  for r in sources:
   with tarfile.open(fileobj=io.BytesIO(z.read(r['path'])),mode='r:*')as t:
    for member in t.getmembers():
     if not member.isfile():continue
     with t.extractfile(member)as f:head=f.read(4096)
     require(not compiled(head),'COMPILED_RUNTIME_IN_SOURCE_ASSET '+member.name)
    if r['group']=='electron-ffmpeg':
     for variant in ('Chrome','Chromium'):
      cfg=t.extractfile('chromium/config/'+variant+'/win/x64/config.h').read().decode()
      for flag in ('GPL','GPLV3','NONFREE','VERSION3'):require(re.search(r'^#define CONFIG_'+flag+r' 0$',cfg,re.M),'FFMPEG_FORBIDDEN_CONFIG '+flag)
     require(t.getmember('COPYING.LGPLv2.1').isfile(),'ORIGINAL_FFMPEG_LGPL_TEXT_MISSING')
  rows=[r for r in sources if r['group']==group]
  binding=None
  if inventory:
   actual=json.loads(inventory.read_text(encoding='utf-8'));native={(r['root'],r['path']):(r['sha256'],r['bytes'])for r in actual['nativeFiles']};pins=[r for r in profile['nativePins']if r['component']==group]
   for r in pins:
    for loc in r['locations']:require(native.get((loc['root'],loc['path']))==(r['sha256'],r['bytes']),'SHARED_STATIC_NATIVE_MISMATCH '+loc['path'])
   require(bool(pins),'SHARED_STATIC_NATIVE_PINS_EMPTY')
   binding={'inventorySHA256':file_digest(inventory),'appAsarSHA256':actual['appAsarSHA256'],'nativeRepresentationsMatched':sum(len(r['locations'])for r in pins)}
 return {'group':group,'sourceArchivesVerified':len(rows),'allSourceOnlyArchivesInspected':len(sources),'archiveSHA256':file_digest(archive),'installedInventoryMatch':binding,'scope':'Exact full source, original Windows build recipe/patches and replacement/relink instructions. Source inventory only; no new native compilation or global release approval.','releaseCleared':False}
def main():
 p=argparse.ArgumentParser();p.add_argument('--archive',type=Path,required=True);p.add_argument('--inventory',type=Path);p.add_argument('--group',choices=['electron-ffmpeg','lxml-iconv'],required=True);p.add_argument('--output',type=Path);a=p.parse_args();r=verify(a.group,a.archive,a.inventory);s=json.dumps(r,indent=2)+'\n'
 if a.output:a.output.write_text(s,encoding='utf-8')
 print(s,end='')
if __name__=='__main__':main()
