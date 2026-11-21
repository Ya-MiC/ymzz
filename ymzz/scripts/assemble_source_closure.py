"""MIT. Assemble SOURCE-ONLY pending material archives from pinned, already downloaded files.
No downloads, compiled engine/installer inclusion, publication or gate changes.
"""
import argparse,json,tarfile,zipfile
from pathlib import Path
from verify_sharp_sources import REPO,require,file_digest,digest

def assemble(group,receipts,cache,output):
    require(group in ('sharp','office'),'UNKNOWN_MATERIAL_GROUP');root=cache.resolve()
    filename='sharp-win32-sources.lock.json'if group=='sharp'else'office013-all-external-sources.lock.json'
    profile_path=REPO/'ymzz/compliance'/filename;profile=json.loads(profile_path.read_text(encoding='utf-8'));rows=profile['components'if group=='sharp'else'sources'];actual=json.loads(receipts.read_text(encoding='utf-8'));entries=actual['components'if group=='sharp'else'sources'];lookup={r['component'if group=='sharp'else'key']:r for r in entries}
    files=[]
    for row in rows:
        source=lookup[row['component'if group=='sharp'else'key']];p=Path(source['local']);require(not p.is_symlink()and p.is_file()and p.resolve().is_relative_to(root),'SOURCE_OUTSIDE_REQUESTED_CACHE')
        require(p.stat().st_size==row['bytes']and file_digest(p)==row['sha256'],'SOURCE_BYTES_CHANGED '+row['file']);files.append((p,'sources/'+row['file']))
    output.parent.mkdir(parents=True,exist_ok=True)
    # Never overwrite prior evidence. The caller chooses a new candidate filename.
    with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_STORED)as z:
        for f,name in files:z.write(f,name)
        z.write(profile_path,'compliance/'+filename)
        document=REPO/'ymzz/compliance'/('SHARP-SOURCE-REBUILD.md'if group=='sharp'else'OFFICE-SOURCE-REBUILD.md');z.write(document,'compliance/'+document.name)
        if group=='sharp':
            pins=json.loads((REPO/'ymzz/compliance/sharp-win32-native.lock.json').read_text(encoding='utf-8'));source=root/'img-sharp-win32-x64-0.35.5.tgz';upstream=next(r for r in json.loads((REPO/'ymzz/compliance/source-materials.lock.json').read_text(encoding='utf-8'))['sources']if r['file']==source.name);require(file_digest(source)==upstream['sha256'],'ORIGINAL_SHARP_PACKAGE_CHANGED')
            with tarfile.open(source)as t:
                for name in ('LICENSE','versions.json','package.json'):
                    data=t.extractfile('package/'+name).read()
                    if name!='package.json':require(digest(data)==next(r['sha256']for r in pins['files']if r['path']==name),'ORIGINAL_SHARP_METADATA_CHANGED')
                    z.writestr('native-original/'+name,data)
    return {'schema':1,'group':group,'sourceOnly':True,'sourceArchives':len(files),'bytes':output.stat().st_size,'sha256':file_digest(output),'filename':output.name,'releaseCleared':False}
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--group',choices=('sharp','office'),required=True);p.add_argument('--receipts',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--report',type=Path);a=p.parse_args();result=assemble(a.group,a.receipts,a.cache,a.output);text=json.dumps(result,indent=2)+'\n'
    if a.report:a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(text,encoding='utf-8')
    print(text,end='')
if __name__=='__main__':main()
