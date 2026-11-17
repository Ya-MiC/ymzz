"""MIT. Source-only Windows LGPL rebuild/relink proof. No resulting binary is uploaded/shipped."""
import argparse, hashlib, json, os, shutil, subprocess, sys, tarfile, urllib.request, zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
work=a.work.resolve();work.mkdir(parents=True,exist_ok=True)
assert sys.platform=='win32','Native Windows MSVC required; no simulated success'
inputs=[]
def fetch(url,digest,name):
 dest=work/name
 if not dest.exists():
  with urllib.request.urlopen(url,timeout=90)as f:dest.write_bytes(f.read())
 assert hashlib.file_digest(dest.open('rb'),'sha256').hexdigest()==digest,name+' hash mismatch'
 inputs.append({'url':url,'sha256':digest,'bytes':dest.stat().st_size});return dest

def untar(archive,destination):
 destination.mkdir()
 with tarfile.open(archive)as t:t.extractall(destination,filter='data')
 return next(f for f in destination.iterdir()if f.is_dir())

def run(args,cwd=None,env=None):subprocess.run([str(x)for x in args],cwd=cwd,env=env,check=True,timeout=1200)
source=fetch('https://codeload.github.com/winlibs/libiconv/tar.gz/880a1fa8b5581e37e136a7b051947d3ea39097b6','89dd45d7f074ddae04dcd25cc4ceace3432c04b72dc36a6508854aac713f3eb6','iconv-source.tar.gz')
iconv=untar(source,work/'iconv-original-source')
header=iconv/'source/include/iconv.h';originalHeader=header.read_bytes();assert b'#define _LIBICONV_VERSION 0x0111' in originalHeader
project=iconv/'MSVC17/libiconv_static/libiconv_static.vcxproj'
run(['msbuild',project,'/t:Build','/p:Configuration=Release','/p:Platform=x64','/p:WindowsTargetPlatformVersion=10.0','/verbosity:minimal'])
library=next((iconv/'MSVC17').rglob('libiconv_a.lib'));linkdir=work/'modified-link-library';linkdir.mkdir();linklib=linkdir/'iconv_a.lib'
probe=work/'iconv-relink-probe.c';probe.write_text(r'''#include <iconv.h>
#include <string.h>
#include <stdlib.h>
int main(int argc,char **argv){
 if(argc!=2||_libiconv_version!=(int)strtol(argv[1],0,0))return 2;
 iconv_t c=iconv_open("UTF-8","ISO-8859-1");if(c==(iconv_t)-1)return 3;
 char input[]={'c','a','f',(char)0xe9,0};char *in=input;size_t left=4;char output[16]={0};char *out=output;size_t available=15;
 if(iconv(c,&in,&left,&out,&available)==(size_t)-1)return 4;iconv_close(c);
 return left==0&&memcmp(output,"caf\xc3\xa9",5)==0?0:5;
}
''',encoding='ascii')
def relink(expected):
 shutil.copyfile(library,linklib)
 executable=work/'iconv-relinked-test.exe'
 run(['cl','/nologo','/DLIBICONV_STATIC','/I'+str(iconv/'source/include'),probe,linklib,'/Fe:'+str(executable)],cwd=work)
 run([executable,expected],cwd=work)
relink('0x0111')
# Deliberately modify source metadata in a DERIVED TEST COPY only. This is NOT GNU iconv1.18.
modifiedHeader=originalHeader.replace(b'#define _LIBICONV_VERSION 0x0111',b'#define _LIBICONV_VERSION 0x0112');header.write_bytes(modifiedHeader)
run(['msbuild',project,'/t:Rebuild','/p:Configuration=Release','/p:Platform=x64','/p:WindowsTargetPlatformVersion=10.0','/verbosity:minimal'])
relink('0x0112')
# Rebuild the actual lxml extension against that modified library using supported --static paths.
base='https://github.com/lxml/libxml2-win-binaries/releases/download/2026.05.17/'
libs=[('libxml2-2.11.9.win64.zip','ff23c75d4b3991042f9bbe7fd38ccc50616349a3c1b583c328d996be22e52b64'),('libxslt-1.1.45.win64.zip','e6fcfa1cf6719630e83c39a5448687db65084b0a375af366c9a857b62c3e4bf7'),('zlib-1.3.2.win64.zip','e1c1bcaa1dea202057f96614565c5773ee9c9be7033b470f2b746ab8a9070f01')]
roots=[]
for name,digest in libs:
 archive=fetch(base+name,digest,name);target=work/name.removesuffix('.zip');target.mkdir()
 with zipfile.ZipFile(archive)as z:z.extractall(target)
 roots.append(next(d for d in target.iterdir()if d.is_dir()))
lxmlArchive=fetch('https://files.pythonhosted.org/packages/23/ad/28ecd7cb894d172f3c9c80a075eeeb2017ac62e3632cee05a5f9493547eb/lxml-6.1.3.tar.gz','45222d94ddd511536f3b2f7d9deae3b2339b4ce0f075f1ca25703b07cad9dd21','lxml-source.tar.gz')
lxml=untar(lxmlArchive,work/'lxml-source');env=os.environ.copy();env.pop('STATICBUILD',None);env.pop('STATIC_DEPS',None)
env['INCLUDE']=';'.join([str(iconv/'source/include'),*[str(r/'include')for r in roots],env.get('INCLUDE','')]);env['LIBRARY']=';'.join([str(linkdir),*[str(r/'lib')for r in roots]])
run([sys.executable,'setup.py','--static','--without-cython','build_ext','--inplace'],cwd=lxml,env=env)
code="import sys,json;sys.path.insert(0,sys.argv[1]);from lxml import etree;assert etree.ICONV_COMPILED_VERSION==(1,18),etree.ICONV_COMPILED_VERSION;assert etree.fromstring(b'<root>caf\\xe9</root>',etree.XMLParser(encoding='ISO-8859-1')).text=='caf\u00e9';print(json.dumps({'modifiedTestIconvCompiled':etree.ICONV_COMPILED_VERSION,'libxml':etree.LIBXML_COMPILED_VERSION,'libxslt':etree.LIBXSLT_COMPILED_VERSION,'lxml':etree.LXML_VERSION}))"
result=subprocess.run([sys.executable,'-I','-c',code,str(lxml/'src')],text=True,capture_output=True,timeout=60)
if result.returncode:raise RuntimeError('Actual rebuilt lxml verification failed: '+result.stderr)
report={'schema':1,'scope':'Native source-only modified-library/lxml rebuild and relink qualification; no product binary replacement/distribution','originalIconvGitlink':'880a1fa8b5581e37e136a7b051947d3ea39097b6','originalHeaderSHA256':hashlib.sha256(originalHeader).hexdigest(),'modifiedTestHeaderSHA256':hashlib.sha256(modifiedHeader).hexdigest(),'testOnlyMetadataModificationIsNotGNUIconv18':True,'originalAndModifiedStaticRelinkUTF8ConversionPassed':True,'actualModifiedLxmlRebuild':json.loads(result.stdout.strip().splitlines()[-1]),'inputs':inputs,'productionRuntimeChanged':False,'releaseCleared':False}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
