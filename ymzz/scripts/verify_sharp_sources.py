"""MIT. Check retained source bytes against actual native versions and original recipes.
No compilation or global commercial/release clearance is asserted by an inventory.
"""
import argparse,hashlib,io,json,re,tarfile,tomllib,zipfile
from pathlib import Path,PurePosixPath
REPO=Path(__file__).resolve().parents[2]
def digest(data):return hashlib.sha256(data).hexdigest()
def file_digest(file):
    with file.open('rb')as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def require(condition,message):
    if not condition:raise ValueError(message)
def safe_name(name):
    p=PurePosixPath(name)
    require(not p.is_absolute()and '\\'not in name and ':'not in name and all(x not in ('','..','.')for x in name.split('/')),'UNSAFE_MATERIAL_PATH '+name)
def validate_components(profile,native):
    rows=profile['components'];names=[r['component']for r in rows]
    require(len(set(names))==len(names),'DUPLICATE_COMPONENT')
    require(set(names)==set(native['versions']),'NATIVE_CONSTITUENT_SET_MISMATCH')
    for r in rows:
        require(r['version']==native['versions'][r['component']],'NATIVE_VERSION_MISMATCH '+r['component'])
        safe_name(r['file']);require('/'not in r['file'],'UNSAFE_ARCHIVE_NAME')
        require(re.fullmatch('[a-f0-9]{64}',r['sha256'])is not None and isinstance(r['bytes'],int)and r['bytes']>0,'INVALID_SOURCE_PIN')
def verify_zip(z,rows):
    names=[i.filename for i in z.infolist()];require(len(names)==len(set(names)),'DUPLICATE_ZIP_MEMBER')
    for i in z.infolist():
        safe_name(i.filename.rstrip('/'));require((i.external_attr>>16)&0o170000!=0o120000,'MATERIAL_SYMLINK')
    for r in rows:
        safe_name(r['path']);i=z.getinfo(r['path']);require(i.file_size==r['bytes'],'MATERIAL_SIZE_MISMATCH '+r['path'])
        with z.open(i)as f:h=hashlib.file_digest(f,'sha256').hexdigest()
        require(h==r['sha256'],'MATERIAL_SHA256_MISMATCH '+r['path'])
def recipe_member(z,archive,suffix):
    with tarfile.open(fileobj=io.BytesIO(z.read('preferred-sources/'+archive)),mode='r:*')as t:
        matches=[m for m in t.getmembers()if m.name.endswith('/'+suffix)]
        require(len(matches)==1 and matches[0].isfile(),'RECIPE_MEMBER_MISSING_OR_AMBIGUOUS '+suffix)
        return t.extractfile(matches[0]).read()
def fields(text,pkg):
    text=text.replace('$(PKG)',pkg)
    return dict(re.findall(r'^'+re.escape(pkg)+r'_(VERSION|CHECKSUM)\s*[:?]?=\s*(.*?)\s*$',text,re.M))
def verify(profile,native,constituents,rust,inventory=None):
    validate_components(profile,native)
    rust_profile=json.loads((REPO/'ymzz/compliance/materials-addendum-05.json').read_text(encoding='utf-8'))
    require(rust.stat().st_size==rust_profile['archive']['bytes']and file_digest(rust)==rust_profile['archive']['sha256'],'RUST_ARCHIVE_PIN_MISMATCH')
    rows=[{'path':'sources/'+r['file'],'bytes':r['bytes'],'sha256':r['sha256']}for r in profile['components']]
    with zipfile.ZipFile(constituents)as z,zipfile.ZipFile(rust)as rz:
        verify_zip(z,rows);verify_zip(rz,rust_profile['entries'])
        require(z.read('compliance/sharp-win32-sources.lock.json')==(REPO/'ymzz/compliance/sharp-win32-sources.lock.json').read_bytes(),'SOURCE_PROFILE_CHANGED')
        for r in profile['recipeArchives']:
            data=rz.read('preferred-sources/'+r['file']);require(len(data)==r['bytes']and digest(data)==r['sha256'],'RECIPE_ARCHIVE_CHANGED')
        ov=profile['override'];overrides=recipe_member(rz,ov['archive'],ov['member']);require(digest(overrides)==ov['sha256'],'OVERRIDE_RECIPE_CHANGED')
        for r in profile['components']:
            record=r['recipe'];recipe=recipe_member(rz,record['archive'],record['member']);require(digest(recipe)==record['sha256'],'ORIGINAL_RECIPE_CHANGED '+r['component'])
            effective=fields(recipe.decode(),r['recipePackage']);effective.update(fields(overrides.decode(),r['recipePackage']))
            require(effective.get('VERSION')==r['version']and effective.get('CHECKSUM')==r['sha256'],'RECIPE_SOURCE_PIN_MISMATCH '+r['component'])
        lock=tomllib.loads(rz.read('original-recipe-and-evidence/patched-Cargo.lock').decode());crate_rows={r['path']:r for r in rust_profile['entries']if r['path'].startswith('rust-crates/')};registry=[]
        for p in lock['package']:
            if 'source'not in p:continue
            require(p['source'].startswith('registry+'),'UNACCOUNTED_RUST_SOURCE '+p['name'])
            name='rust-crates/'+p['name']+'-'+p['version']+'.crate';require(name in crate_rows and crate_rows[name]['sha256']==p['checksum'],'PATCHED_CARGO_SOURCE_MISSING '+name);registry.append(name)
        require(set(registry)==set(crate_rows),'EXTRA_OR_MISSING_RUST_CRATE')
        original={r['path']:r for r in native['files']}
        for name in ('LICENSE','versions.json'):
            data=z.read('native-original/'+name);require(digest(data)==original[name]['sha256'],'ORIGINAL_NOTICE_OR_VERSIONS_CHANGED '+name)
        require(json.loads(z.read('native-original/versions.json'))==native['versions'],'ACTUAL_NATIVE_VERSIONS_CHANGED')
    native_match=None
    if inventory:
        actual=json.loads(inventory.read_text(encoding='utf-8'));checks={r['path']:r for r in actual['sharp']['originalUpstreamBytesMatched']}
        for r in native['files']:
            c=checks.get(r['path'],{});require(c.get('sha256')==r['sha256']and c.get('bytes')==r['bytes']and c.get('matched')is True,'INSTALLED_NATIVE_PIN_MISMATCH '+r['path'])
        require(re.fullmatch('[a-f0-9]{64}',actual['appAsarSHA256'])is not None,'MISSING_ASAR_BINDING')
        native_match={'inventorySHA256':file_digest(inventory),'appAsarSHA256':actual['appAsarSHA256'],'scope':'Only the supplied installed inventory; not a new Windows qualification'}
    return {'schema':1,'sourceConstituentsVerified':len(rows),'originalRecipePinsVerified':len(rows),'patchedRustCratesVerified':len(registry),'sourceArchiveSHA256':file_digest(constituents),'rustArchiveSHA256':file_digest(rust),'installedInventoryMatch':native_match,'scope':'Rehashed original sources, recipes, patches, Rust closure and native version/notice identity. No source compilation, modified DLL test, Office/global material clearance or new GUI result.','releaseCleared':False}
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--constituents',type=Path,required=True);p.add_argument('--rust',type=Path,required=True);p.add_argument('--inventory',type=Path);p.add_argument('--output',type=Path);a=p.parse_args()
    profile=json.loads((REPO/'ymzz/compliance/sharp-win32-sources.lock.json').read_text(encoding='utf-8'));native=json.loads((REPO/'ymzz/compliance/sharp-win32-native.lock.json').read_text(encoding='utf-8'));result=verify(profile,native,a.constituents,a.rust,a.inventory);text=json.dumps(result,indent=2)+'\n'
    if a.output:a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(text,encoding='utf-8')
    print(text,end='')
if __name__=='__main__':main()
