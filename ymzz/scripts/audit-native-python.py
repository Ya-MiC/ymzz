"""MIT. Audit actual DLL declarations beyond Python package-level BSD metadata; never execute a wheel."""
import argparse, hashlib, json, re, sys, zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--wheel',type=Path);p.add_argument('--root',type=Path);p.add_argument('--output',type=Path,required=True);p.add_argument('--enforce',action='store_true');a=p.parse_args()
if bool(a.wheel)==bool(a.root):p.error('exactly one of --wheel or --root required')
sha=lambda b:hashlib.sha256(b).hexdigest()
license_expression='GPL-3.0-or-later WITH GCC-exception-3.1'
if a.wheel:
    lock=json.loads((Path(__file__).resolve().parents[2]/'scripts/primary-runtime/lock.json').read_text())
    pin=next(w for w in lock['targets']['win-x64']['wheels']if 'numpy-'in w['url'])
    if hashlib.file_digest(a.wheel.open('rb'),'sha256').hexdigest()!=pin['sha256']:raise ValueError('LOCKED_NUMPY_WHEEL_HASH_MISMATCH')
    with zipfile.ZipFile(a.wheel)as z:
        licenses=[(n,z.read(n))for n in z.namelist()if 'numpy-'in n and n.endswith('.dist-info/LICENSE.txt')]
        native=[{'file':n,'sha256':sha(z.read(n)),'bytes':z.getinfo(n).file_size}for n in z.namelist()if re.search(r'(?:^|/)numpy\.libs/libscipy_openblas[^/]*\.dll$',n,re.I)]
    scope='Exact hash-verified locked Windows wheel, not installed GUI proof'
else:
    root=a.root.resolve(strict=True)
    licenses=[(f.relative_to(root).as_posix(),f.read_bytes())for f in root.rglob('LICENSE.txt')if 'numpy-'in f.as_posix()and '.dist-info/'in f.as_posix()]
    native=[{'file':f.relative_to(root).as_posix(),'sha256':hashlib.file_digest(f.open('rb'),'sha256').hexdigest(),'bytes':f.stat().st_size}for f in root.rglob('libscipy_openblas*.dll')if f.is_file()and not f.is_symlink()]
    scope='Actual prepared primary runtime payload, no interpreter execution'
if not licenses or not native:raise ValueError('NUMPY_NATIVE_LICENSE_OR_DLL_MISSING_AUDIT_INCOMPLETE')
findings=[{'file':n,'sha256':sha(b),'expression':license_expression,'vendorDeclaredStaticallyLinkedRuntime':True}for n,b in licenses if license_expression in b.decode('utf-8','replace')]
if not findings:raise ValueError('NATIVE_RUNTIME_LICENSE_CHANGED_REVIEW_REQUIRED')
r={'schema':1,'scope':scope,'package':'numpy','version':'2.3.5','nativeBinaries':native,'findings':findings,'ownerApproved':False,'policyReason':'LGPL/MPL approval does not cover a separate GPL-with-GCC-runtime-exception category. Owner decision required; not silently allowed.','doesNotMeanApplicationBecomesGPL':True,'exceptionMeaning':'The actual license grants eligible combinations permission to distribute non-GPL/proprietary independent modules. This is not plain GPL and is not LGPL.','releaseCleared':False}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k!='nativeBinaries'},indent=2))
if a.enforce:sys.exit(1)
