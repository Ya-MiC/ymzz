"""MIT. Assemble verified ORIGINAL archives, not a declaration that compliance has cleared."""
import argparse, hashlib, json, re, zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();repo=Path(__file__).resolve().parents[2];lockfile=repo/'ymzz/compliance/source-materials.lock.json';lock=json.loads(lockfile.read_text())
files=[]
for r in lock['sources']:
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]+',r['file']):raise ValueError('UNSAFE_ARCHIVE_NAME')
    f=a.cache/r['file']
    if f.is_symlink()or not f.is_file()or f.stat().st_size!=r['bytes']or hashlib.file_digest(f.open('rb'),'sha256').hexdigest()!=r['sha256']:raise ValueError('MISSING_OR_CHANGED_MATERIAL '+r['file'])
    files.append(f)
a.output.mkdir(parents=True,exist_ok=True);assets=[]
# Separate Chromium from the other materials so no asset approaches GitHub's twoGiB limit.
for n,group in enumerate([[f for f in files if f.name.startswith('chromium-')],[f for f in files if not f.name.startswith('chromium-')]],1):
    out=a.output/f'湛箴_ymzz-corresponding-materials-{n:02}.zip'
    with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_STORED)as z:
        for f in group:z.write(f,'archives/'+f.name)
        z.write(lockfile,'source-materials.lock.json')
        for f in (repo/'ymzz/compliance').rglob('*'):
            if f.is_file()and f.suffix in ['.md','.txt','.json']:z.write(f,'compliance/'+f.relative_to(repo/'ymzz/compliance').as_posix())
    assets.append({'file':out.name,'bytes':out.stat().st_size,'sha256':hashlib.file_digest(out.open('rb'),'sha256').hexdigest()})
(a.output/'SHA256SUMS.materials.txt').write_text(''.join(r['sha256']+'  '+r['file']+'\n'for r in assets));(a.output/'material-assets.json').write_text(json.dumps({'distributionCleared':False,'archivesVerified':len(files),'assets':assets},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'distributionCleared':False,'archivesVerified':len(files),'assets':assets},ensure_ascii=False,indent=2))
