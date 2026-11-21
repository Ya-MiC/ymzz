"""MIT. Rehash complete selected Office external-source materials against the ORIGINAL Core.
Collection and matching-source proof are not new native execution or global release clearance.
"""
import argparse,hashlib,io,json,re,tarfile,zipfile
from pathlib import Path
from verify_sharp_sources import REPO,digest,file_digest,require,verify_zip
CORE='bce0998afefdbc355585ca324285661a2170ba77'
def parse_downloads(text):
    values=dict(re.findall(r'^(\w+)\s*:?=\s*(.*?)\s*$',text,re.M));out={}
    for key,value in values.items():
        if not key.endswith('_TARBALL'):continue
        for _ in range(8):value=re.sub(r'\$\((\w+)\)',lambda m:values.get(m[1],m[0]),value)
        require('$('not in value,'UNEXPANDED_TARBALL '+key);name=key[:-8];out[name]=(value,values[name+'_SHA256SUM'])
    return out
def excluded(key):return key.startswith(('FONT_','JFREEREPORT_'))or key in {'BSH','HSQLDB','JAVA_WEBSOCKET','RHINO','PYTHON','PYTHON_BOOTSTRAP','LXML'}
def validate_external_plan(profile,downloads,configure):
    for flag in ('--without-fonts','--without-java','--enable-python=no','--without-lxml'):require(flag in configure,'NATIVE_EXCLUSION_NOT_CONFIGURED '+flag)
    rows=profile['sources'];names=[r['key']for r in rows];require(len(names)==len(set(names)),'DUPLICATE_OFFICE_SOURCE')
    require(set(names)=={k for k in downloads if not excluded(k)},'OFFICE_SOURCE_SET_MISMATCH')
    omitted=profile['excluded'];require({r['key']for r in omitted}=={k for k in downloads if excluded(k)},'OFFICE_EXCLUSION_SET_MISMATCH')
    for r in rows+omitted:require(downloads.get(r['key'])==(r['file'],r['sha256']),'CORE_DOWNLOAD_PIN_MISMATCH '+r['key'])
def tar_source(t,relative):
    matches=[m for m in t.getmembers()if m.name.endswith('/'+relative)];require(len(matches)==1 and matches[0].isfile(),'PREFERRED_SOURCE_MISSING_OR_AMBIGUOUS '+relative);return t.extractfile(matches[0]).read()
def verify(base,external,inventory=None):
    p=json.loads((REPO/'ymzz/compliance/office013-all-external-sources.lock.json').read_text(encoding='utf-8'));bp=json.loads((REPO/'ymzz/compliance/materials-addendum-04.json').read_text(encoding='utf-8'))
    require(base.stat().st_size==bp['archive']['bytes']and file_digest(base)==bp['archive']['sha256'],'OFFICE_BASE_ARCHIVE_PIN_MISMATCH')
    with zipfile.ZipFile(base)as z,zipfile.ZipFile(external)as ez:
        verify_zip(z,bp['entries']);verify_zip(ez,[{'path':'sources/'+r['file'],'sha256':r['sha256'],'bytes':r['bytes']}for r in p['sources']])
        require(ez.read('compliance/office013-all-external-sources.lock.json')==(REPO/'ymzz/compliance/office013-all-external-sources.lock.json').read_bytes(),'OFFICE_SOURCE_PROFILE_CHANGED')
        # Core archive's real preferred-source list, not a generated list claiming success.
        core_name='source/libreoffice-core-'+CORE+'.tar.gz';download=None
        with z.open(core_name)as stream,tarfile.open(fileobj=stream,mode='r|gz')as t:
            for member in t:
                if member.name=='core-'+CORE+'/download.lst':download=t.extractfile(member).read();break
        require(download is not None and digest(download)==p['downloadListSHA256'],'CORE_DOWNLOAD_LIST_CHANGED')
        native=json.loads(z.read('native-original-materials/prebuilds.json'));config=json.loads(z.read('native-original-materials/sources/core.json'))
        require(native['source']['revision']==CORE==config['revision']==p['core'],'NATIVE_CORE_REVISION_MISMATCH')
        validate_external_plan(p,parse_downloads(download.decode()),config['configure'])
        generated=('sources/core-changes.patch','sources/core-source.json','sources/core.json','sources/payload-shaping.json');source_names=[name for name in native['source']['files']if name not in generated];require(len(source_names)==len(set(source_names)),'DUPLICATE_PREFERRED_SOURCE')
        with tarfile.open(fileobj=io.BytesIO(z.read('source/dsh-libreoffice-kit-b19bb73c74ed893b8a5d1716d32df32a113ed31b.tar.gz')),mode='r:gz')as t:
            for name in source_names:
                require(name.startswith('sources/'),'UNEXPECTED_NATIVE_SOURCE_PATH');data=tar_source(t,name.removeprefix('sources/'));require(digest(data)==native['files'][name],'NATIVE_PREFERRED_SOURCE_MISMATCH '+name)
        for name in generated:
            data=z.read('native-original-materials/'+name);require(digest(data)==native['files'][name],'ORIGINAL_NATIVE_RECIPE_CHANGED '+name)
        resolver_sha=digest(z.read('ymzz-modifications/native-resolver.MPL-2.0.patch'))
    binding=None
    if inventory:
        x=json.loads(inventory.read_text(encoding='utf-8'));variant=x['officeSourceVariant'];require(variant['sourceRevision']=='b19bb73c74ed893b8a5d1716d32df32a113ed31b','INSTALLED_OFFICE_SOURCE_VARIANT_CHANGED')
        require(variant['sourceArchiveSHA256']=='33839347e44b8df44c59115b566e9664e7db04a612a8f37ee2b220d7e501c036'and variant['patchSHA256']==resolver_sha,'INSTALLED_ADAPTER_SOURCE_OR_PATCH_CHANGED')
        native_count=0
        for row in x['nativeFiles']:
            marker='/@deepseek-ai/libreoffice-kit-win32-x64/'
            if marker not in row['path']:continue
            relative=row['path'].split(marker,1)[1];require(native['files'].get(relative)==row['sha256'],'INSTALLED_ENGINE_BYTE_MISMATCH '+relative);native_count+=1
        require(native_count>0,'MISSING_ACTUAL_OFFICE_NATIVE_IMAGE')
        binding={'nativeRepresentationsMatched':native_count,'inventorySHA256':file_digest(inventory),'appAsarSHA256':x['appAsarSHA256'],'scope':'Supplied baseline inventory only; not a new exact-head Windows execution'}
    return {'schema':1,'core':CORE,'preferredNativeSourceFilesVerified':len(source_names),'exactExternalArchivesVerified':len(p['sources']),'disabledExternalEntriesAccounted':len(p['excluded']),'baseArchiveSHA256':file_digest(base),'externalArchiveSHA256':file_digest(external),'installedInventoryMatch':binding,'scope':'All source bytes and native build/configuration identities rechecked; conservative source superset. Original patches/notices retained. Does NOT assert all optional components ship, a modified native rebuild, complete product commercial clearance or new Windows GUI.','releaseCleared':False}
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--base',type=Path,required=True);p.add_argument('--external',type=Path,required=True);p.add_argument('--inventory',type=Path);p.add_argument('--output',type=Path);a=p.parse_args();result=verify(a.base,a.external,a.inventory);text=json.dumps(result,indent=2)+'\n'
    if a.output:a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(text,encoding='utf-8')
    print(text,end='')
if __name__=='__main__':main()
