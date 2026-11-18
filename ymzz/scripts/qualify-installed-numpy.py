"""MIT. Exact actual installed source-wheel verification and embedded Python acceptance.
Component proof only: never waives Office/whole-app source or license gates.
"""
import argparse, hashlib, importlib.util, json, os, re, subprocess, sys, tempfile
from pathlib import Path
HERE=Path(__file__).resolve()
spec=importlib.util.spec_from_file_location('numpy_overlay',HERE.parents[1]/'packaging/numpy_source_overlay.py');overlay=importlib.util.module_from_spec(spec);spec.loader.exec_module(overlay)
PROBE=r'''import json, pathlib, sys
import numpy as np
import pandas as pd
site=pathlib.Path(sys.argv[1]).resolve();assert pathlib.Path(np.__file__).resolve().is_relative_to(site)
assert np.__version__=='2.3.5'
a=np.array([[4.,1.],[1.,3.]]);b=np.array([1.,2.]);x=np.linalg.solve(a,b)
assert np.allclose(a@x,b)
c=np.linalg.cholesky(a);assert np.allclose(c@c.T,a)
u,s,v=np.linalg.svd(a);assert np.allclose((u*s)@v,a)
q,r=np.linalg.qr(a);assert np.allclose(q@r,a)
w,z=np.linalg.eigh(a);assert np.allclose(a@z,z*w)
x,*_=np.linalg.lstsq(a,b,rcond=None);assert np.allclose(a@x,b)
wave=np.arange(16,dtype=float);assert np.allclose(np.fft.ifft(np.fft.fft(wave)).real,wave)
assert np.array_equal(np.random.default_rng(42).integers(0,100,32),np.random.default_rng(42).integers(0,100,32))
f=pd.DataFrame({'group':['a','b','a'],'value':[1.,3.,4.]});assert f.groupby('group')['value'].sum().to_dict()=={'a':5.,'b':3.}
assert np.allclose(f['value'].to_numpy().mean(),8/3)
f.to_csv('數值 驗證.csv',index=False);assert pd.read_csv('數值 驗證.csv').shape==(3,2)
print(json.dumps({'passed':True,'numpy':np.__version__,'pandas':pd.__version__,'python':sys.version,'numpyPath':str(pathlib.Path(np.__file__).resolve()),'checks':['solve','cholesky','svd','qr','eigh','lstsq','fft','random','pandas groupby/array/Chinese-space CSV']}))
'''
def qualify(root,wheel):
 root=Path(root).absolute();wheel=Path(wheel)
 # This only accepts an actual installed Windows primary runtime, not a marker alone.
 site=root/'dependencies/python/Lib/site-packages';python=root/'dependencies/python/python.exe'
 if not python.is_file():raise ValueError('INSTALLED_EMBEDDED_PYTHON_MISSING')
 marker=root.parent.parent/'licenses/ymzz/numpy-source-overlay.json'
 selected=json.loads(marker.read_text());proof=json.loads((HERE.parents[1]/'docs/evidence/numpy-source-44218703576-passed.json').read_text())
 if selected.get('wheelSHA256')!=proof['wheelSHA256'] or selected.get('wholeNamespaceReplacement')is not True:raise ValueError('INSTALLED_NUMPY_SELECTION_UNQUALIFIED')
 entries=overlay.inventory(wheel,proof);overlay.regular_tree(site);overlay.verify_installed(site,entries)
 unwanted=[str(f.relative_to(root))for f in root.rglob('*')if f.is_file()and re.search(r'(?:openblas|gfortran|quadmath|libgcc|libgomp).*\.(?:dll|pyd)$',f.name,re.I)]
 if unwanted:raise ValueError('UNRESOLVED_GNU_NATIVE_PAYLOAD:'+','.join(unwanted))
 with tempfile.TemporaryDirectory(prefix='湛箴 數值 中文 空格 ') as cwd:
  run=subprocess.run([str(python),'-I','-c',PROBE,str(site)],cwd=cwd,text=True,encoding='utf8',capture_output=True,timeout=180)
  if run.returncode:raise RuntimeError('ACTUAL_EMBEDDED_NUMPY_ACCEPTANCE_FAILED:'+run.stdout[-4000:]+run.stderr[-4000:])
  actual=json.loads(run.stdout.strip())
  if actual.get('passed')is not True:raise ValueError('ACTUAL_EMBEDDED_NUMPY_ACCEPTANCE_INCOMPLETE')
 overlay.verify_installed(site,entries)
 return {'schema':1,'status':'passed','scope':'Actual installed complete NumPy namespace and embedded Python only; not entire application/source clearance','wheelSHA256':proof['wheelSHA256'],'sourceSHA256':proof['sourceSHA256'],'wholeNamespaceReplacement':True,'fileCount':len(entries),'nativeBinaries':proof['nativeImports'],'originalLicenseTextsVerified':True,'gnuRuntimeFound':False,'ownerCategoryWaiverUsed':False,'embeddedAcceptance':actual,'performanceTradeoff':proof['tradeoff'],'componentQualified':True,'releaseCleared':False}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--qualified-wheel',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 result={'status':'failed','componentQualified':False,'releaseCleared':False}
 try:result=qualify(a.root,a.qualified_wheel)
 except Exception as exc:result['error']=str(exc)
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));sys.exit(0 if result.get('componentQualified')else 1)
