"""MIT. Replace a complete DERIVED NumPy namespace from an exact qualified wheel.
Never edits the pinned upstream archive/prepared source or relabels third-party notices.
"""
import argparse, hashlib, json, os, re, shutil, stat, tempfile, zipfile
from pathlib import Path, PurePosixPath
ORIGINAL_DLL_SHA256 = '9e3e5a4229c1ca39f10dc82bba9e2b2bf48037790932566f37aff1a7ccf3588f'
ROOTS = ('numpy', 'numpy.libs', 'numpy-2.3.5.dist-info')
def digest(data): return hashlib.sha256(data).hexdigest()
def regular_tree(root):
    if root.is_symlink() or getattr(root, 'is_junction', lambda: False)(): raise ValueError('NUMPY_PAYLOAD_LINK')
    if not root.exists(): return
    for base, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            file = Path(base) / name
            if file.is_symlink() or getattr(file, 'is_junction', lambda: False)(): raise ValueError('NUMPY_PAYLOAD_LINK')
def inventory(wheel, proof):
    if digest(wheel.read_bytes()) != proof['wheelSHA256']: raise ValueError('NUMPY_SOURCE_WHEEL_HASH')
    if proof['status'] != 'passed' or proof['sourceVersion'] != '2.3.5' or len(proof['checks']) != 3 or not all(row['passed'] for row in proof['checks']): raise ValueError('NUMPY_SOURCE_NOT_QUALIFIED')
    entries = {}
    with zipfile.ZipFile(wheel) as archive:
        for info in archive.infolist():
            if info.is_dir(): continue
            name = info.filename; parts = PurePosixPath(name).parts
            if not parts or name != PurePosixPath(name).as_posix() or name.startswith('/') or '\\' in name or ':' in name or any(p in ('.', '..', '') for p in parts) or parts[0] not in ROOTS or stat.S_ISLNK(info.external_attr >> 16): raise ValueError('NUMPY_WHEEL_PATH')
            if name in entries: raise ValueError('NUMPY_WHEEL_DUPLICATE')
            entries[name] = archive.read(info)
    expected_native = {row['file'].replace('\\','/'):row['sha256'] for row in proof['nativeImports']}
    actual_native = {n:digest(b) for n,b in entries.items() if n.lower().endswith(('.pyd','.dll'))}
    if not actual_native or actual_native != expected_native: raise ValueError('NUMPY_NATIVE_GRAPH_CHANGED')
    if any(re.search(r'openblas|gfortran|quadmath|libgcc|libgomp',dep,re.I) for row in proof['nativeImports'] for dep in row['dependencies']): raise ValueError('NUMPY_GNU_IMPORT')
    for row in proof['wheelLicenseFiles']:
        data = entries[row['path']]
        if digest(data) != row['sha256']: raise ValueError('NUMPY_NOTICE_HASH')
        if re.search(rb'GNU (?:GENERAL|LESSER GENERAL) PUBLIC LICENSE|GCC Runtime Library Exception|GPL-3\.0', data, re.I): raise ValueError('NUMPY_UNRESOLVED_LICENSE')
    metadata = entries['numpy-2.3.5.dist-info/METADATA'].decode('utf8')
    if not re.search(r'^Name: numpy\r?$',metadata,re.M|re.I) or not re.search(r'^Version: 2\.3\.5\r?$',metadata,re.M): raise ValueError('NUMPY_METADATA')
    return entries

def verify_installed(site, entries):
    for name,data in entries.items():
        file=site / name
        if not file.is_file() or digest(file.read_bytes()) != digest(data): raise ValueError('NUMPY_INSTALLED_FILE_CHANGED:'+name)
    wanted_native={n for n in entries if n.lower().endswith(('.pyd','.dll'))}
    found_native=set()
    for name in ROOTS:
        regular_tree(site/name)
        if (site/name).exists():
            for file in (site/name).rglob('*'):
                if file.is_file():
                    rel=file.relative_to(site).as_posix()
                    if rel not in entries and not ('__pycache__' in file.parts and file.suffix=='.pyc'): raise ValueError('NUMPY_UNEXPECTED_INSTALLED_FILE:'+rel)
                    if file.suffix.lower() in ('.pyd','.dll'): found_native.add(rel)
    if found_native != wanted_native: raise ValueError('NUMPY_UNEXPECTED_NATIVE_FILE')

def apply_overlay(wheel, site, proof, marker, backup_parent):
    wheel=Path(wheel);site=Path(site).absolute();marker=Path(marker);backup_parent=Path(backup_parent).resolve(strict=True)
    for ancestor in (site,*site.parents):
        if ancestor.is_symlink() or getattr(ancestor,'is_junction',lambda:False)(): raise ValueError('NUMPY_PAYLOAD_LINK')
    site=site.resolve(strict=True)
    # Backup must never be inside the shipped runtime/payload.
    if site == backup_parent or site in backup_parent.parents: raise ValueError('NUMPY_BACKUP_INSIDE_PAYLOAD')
    regular_tree(site)
    entries=inventory(wheel,proof)
    if marker.exists():
        old=json.loads(marker.read_text())
        if old.get('wheelSHA256') != proof['wheelSHA256']: raise ValueError('NUMPY_OVERLAY_MARKER_CHANGED')
        verify_installed(site,entries)
        return old
    dll=site/'numpy.libs/libscipy_openblas64_-9e3e5a4229c1ca39f10dc82bba9e2b2b.dll'
    # Preflight exact old selected DLL, never treat a missing/unknown library as success.
    if not dll.is_file() or digest(dll.read_bytes()) != ORIGINAL_DLL_SHA256: raise ValueError('NUMPY_UNKNOWN_ORIGINAL_RUNTIME')
    if not all((site/n).is_dir() for n in ROOTS): raise ValueError('NUMPY_INCOMPLETE_ORIGINAL')
    backup=Path(tempfile.mkdtemp(prefix='ymzz-preserved-original-numpy-',dir=backup_parent));moved=[];installed=[]
    try:
        with tempfile.TemporaryDirectory(prefix='ymzz-source-numpy-stage-',dir=site.parent) as tmp:
            stage=Path(tmp)
            for name,data in entries.items():
                target=stage/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
            for name in ROOTS:
                os.replace(site/name,backup/name);moved.append(name)
            for name in ROOTS:
                if (stage/name).exists(): os.replace(stage/name,site/name);installed.append(name)
            verify_installed(site,entries)
        report={'schema':1,'component':'numpy','version':'2.3.5','derivedPayloadChanged':True,'originalPreparedRuntimeChanged':False,'originalNamespacesPreservedOutsidePayload':True,'wholeNamespaceReplacement':True,'wheelSHA256':proof['wheelSHA256'],'sourceSHA256':proof['sourceSHA256'],'qualifiedNativeImports':proof['nativeImports'],'installedFiles':[{'path':n,'sha256':digest(b)} for n,b in entries.items()],'originalLicenseTextsRetained':True,'scope':'Exact source-qualified complete NumPy namespace overlay only; embedded runtime and entire app qualification still required','performanceTradeoff':proof['tradeoff'],'releaseCleared':False}
        marker.parent.mkdir(parents=True,exist_ok=True);marker.write_text(json.dumps(report,indent=2)+'\n');return report
    except BaseException:
        for name in installed:
            if (site/name).exists(): shutil.rmtree(site/name)
        for name in reversed(moved): os.replace(backup/name,site/name)
        raise

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--wheel',type=Path,required=True);p.add_argument('--site',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--backup-parent',type=Path,required=True);a=p.parse_args()
    proof=json.loads((Path(__file__).resolve().parents[1]/'docs/evidence/numpy-source-44218703576-passed.json').read_text())
    result=apply_overlay(a.wheel,a.site,proof,a.output,a.backup_parent)
    print(json.dumps({'component':result['component'],'wholeNamespaceReplacement':True,'wheelSHA256':result['wheelSHA256'],'releaseCleared':False}))
