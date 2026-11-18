"""MIT. Candidate-only exact NumPy source build with its supported internal C BLAS/LAPACK.
No product files changed and no resulting wheel/DLL published. Slower backend is explicit.
"""
import argparse, hashlib, json, os, re, subprocess, sys, tarfile, urllib.request, zipfile
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--work',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);a=parser.parse_args()
assert sys.platform=='win32' and sys.version_info[:2]==(3,12),'Actual Windows CPython3.12/MSVC required'
work=a.work.resolve();work.mkdir(parents=True,exist_ok=True);a.output.parent.mkdir(parents=True,exist_ok=True)
report={'schema':1,'status':'pending','sourceVersion':'2.3.5','productionRuntimeChanged':False,'releaseCleared':False,'scope':'Exact upstream NumPy supported internal C BLAS/LAPACK candidate, not an approved product replacement','tradeoff':'Upstream warns some linear algebra may be up to100x slower; no silent performance equivalence claim','checks':[]}
def save():a.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def run(args,**kwargs):
 print('RUN',' '.join(str(x) for x in args),flush=True)
 return subprocess.run([str(x) for x in args],check=True,timeout=1200,**kwargs)
try:
 url='https://files.pythonhosted.org/packages/76/65/21b3bc86aac7b8f2862db1e808f1ea22b028e30a225a34a5ede9bf8678f2/numpy-2.3.5.tar.gz';digest='784db1dcdab56bf0517743e746dfb0f885fc68d948aba86eeec2cba234bdf1c0';archive=work/'numpy-2.3.5.tar.gz'
 if not archive.exists():
  with urllib.request.urlopen(url,timeout=90) as src:archive.write_bytes(src.read())
 assert hashlib.sha256(archive.read_bytes()).hexdigest()==digest
 report.update(sourceURL=url,sourceSHA256=digest,python=sys.version);save()
 sources=work/'preferred-source'
 if not sources.exists():
  sources.mkdir()
  with tarfile.open(archive) as t:t.extractall(sources,filter='data')
 source=sources/'numpy-2.3.5';assert (source/'numpy/linalg/lapack_lite/LICENSE.txt').is_file()
 wheelhouse=work/'wheelhouse';wheelhouse.mkdir(exist_ok=True)
 # Exact source's meson.options/meson.build explicitly support fallback C routines.
 # Explicit non-existent external-library names make required:false detection fail;
 # allow-noblas=true retains NumPy's own C BLAS + LAPACK-lite implementations.
 build=[sys.executable,'-m','pip','wheel',source,'--no-deps','--wheel-dir',wheelhouse,'-Csetup-args=-Dblas=none','-Csetup-args=-Dlapack=none','-Csetup-args=-Dallow-noblas=true']
 env=os.environ.copy();env['CC']='cl';env['CXX']='cl';env['PYTHONUTF8']='1';env['CMAKE_BUILD_PARALLEL_LEVEL']='2'
 wheels=list(wheelhouse.glob('numpy-2.3.5-cp312-cp312-win_amd64.whl'))
 if not wheels:
  run(build,env=env)
  wheels=list(wheelhouse.glob('numpy-2.3.5-cp312-cp312-win_amd64.whl'))
 else:print('Reusing existing successful source-build cache; every license/import/numerical gate still runs',flush=True)
 assert len(wheels)==1,wheels
 wheel=wheels[0];report.update(wheelSHA256=hashlib.sha256(wheel.read_bytes()).hexdigest(),wheelBytes=wheel.stat().st_size,buildArguments=[str(x) for x in build[7:]]);save()
 with zipfile.ZipFile(wheel) as z:
  names=z.namelist();assert not any('openblas' in n.lower() or re.search(r'lib(gcc|gfortran|quadmath)',n,re.I) for n in names)
  licenses=[n for n in names if 'license' in n.lower() or 'copying' in n.lower()]
  assert licenses
  report['wheelLicenseFiles']=[{'path':n,'sha256':hashlib.sha256(z.read(n)).hexdigest()} for n in licenses]
  # Do not rewrite or drop any source/binary notices. This proof fails for any
  # actual GNU-runtime appendix, rather than relabeling a generated wheel BSD.
  for n in licenses:
   text=z.read(n).decode('utf-8',errors='replace')
   assert not re.search(r'GNU (?:GENERAL|LESSER GENERAL) PUBLIC LICENSE|GCC Runtime Library Exception|GPL-3\.0',text,re.I),'Unexpected unresolved runtime license in '+n
  report['checks'].append({'operation':'actual built wheel inventory and original notice scan','passed':True})
 install=work/'安裝 NumPy 中文 空格'
 run([sys.executable,'-m','pip','install','--no-deps','--target',install,wheel])
 imports=[]
 for binary in [*install.rglob('*.pyd'),*install.rglob('*.dll')]:
  result=subprocess.run(['dumpbin','/DEPENDENTS',str(binary)],check=True,capture_output=True,text=True,timeout=30)
  dependencies=sorted(set(re.findall(r'^\s+([A-Za-z0-9_.-]+\.dll)\s*$',result.stdout,re.M|re.I)))
  assert not any(re.search(r'openblas|gfortran|quadmath|libgcc|libgomp',n,re.I) for n in dependencies),(binary,dependencies)
  imports.append({'file':str(binary.relative_to(install)),'dependencies':dependencies,'sha256':hashlib.sha256(binary.read_bytes()).hexdigest()})
 report['nativeImports']=imports;report['checks'].append({'operation':'actual PE imported-DLL graph has no OpenBLAS/GNU runtime','passed':True});save()
 run([sys.executable,'-m','pip','install','pytest>=7,<10','hypothesis>=6.24.1,<7'])
 probe=r'''import sys,json,importlib.metadata
sys.path.insert(0,sys.argv[1])
import numpy as np
assert np.__version__=='2.3.5'
config=np.show_config(mode='dicts')
# Exact NumPy2.3.5 __config__.py.in _cleanup removes false/empty values.
# Require the explicitly selected 'none' backend, not an unknown missing schema.
for name in ('blas','lapack'):
 dependency=config['Build Dependencies'][name]
 assert dependency.get('name')=='none' and dependency.get('found',False) is False,config
from numpy.testing import assert_allclose
A=np.array([[4.,1.],[1.,3.]]);b=np.array([1.,2.]);assert_allclose(A@np.linalg.solve(A,b),b)
assert_allclose(np.linalg.cholesky(A)@np.linalg.cholesky(A).T,A)
u,s,vh=np.linalg.svd(A);assert_allclose((u*s)@vh,A)
q,r=np.linalg.qr(A);assert_allclose(q@r,A);assert_allclose(np.linalg.det(A),11.)
assert_allclose(np.linalg.eigvalsh(A),[2.381966011250105,4.618033988749895])
assert_allclose(A@np.linalg.lstsq(A,b,rcond=None)[0],b)
z=np.arange(16.);assert_allclose(np.fft.ifft(np.fft.fft(z)).real,z)
assert np.isfinite(np.random.default_rng(42).normal(size=100)).all()
print(json.dumps({'actualVersion':np.__version__,'backendConfig':config,'solveCholeskySVDQREigenLeastSquaresFFTAndRandomPassed':True,'testToolVersions':{n:importlib.metadata.version(n) for n in ['pytest','hypothesis']}}))
import pytest
raise SystemExit(pytest.main(['--pyargs','numpy.linalg.tests','numpy.fft.tests','numpy.random.tests','-q','--tb=short','--maxfail=3']))
'''
 run([sys.executable,'-I','-c',probe,install],cwd=work)
 report['checks'].append({'operation':'actual upstream linalg/fft/random suites plus explicit solve/cholesky/SVD/QR/eigen/lstsq/FFT/random acceptance','passed':True})
 report['status']='passed';save()
except BaseException as error:
 report.update(status='failed',error={'type':type(error).__name__,'message':str(error)});save();raise
