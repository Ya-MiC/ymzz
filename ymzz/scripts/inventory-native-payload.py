"""MIT. Read EVERY actual shipped PE/WASM file and original notice bytes.
Inspection evidence is not a corresponding-source or license-policy waiver.
"""
import argparse,hashlib,json,re,struct
from email.parser import BytesParser
from pathlib import Path
EXTENSIONS={'.exe','.dll','.node','.pyd','.wasm'}
def sha(file):
 with file.open('rb')as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def pe_imports(data):
 def u16(n):return struct.unpack_from('<H',data,n)[0]
 def u32(n):return struct.unpack_from('<I',data,n)[0]
 if data[:2]!=b'MZ':raise ValueError('NATIVE_PE_MZ_MISSING')
 pe=u32(0x3c)
 if data[pe:pe+4]!=b'PE\0\0':raise ValueError('NATIVE_PE_SIGNATURE')
 machine=u16(pe+4);count=u16(pe+6);size=u16(pe+20);opt=pe+24;magic=u16(opt)
 if magic not in (0x10b,0x20b):raise ValueError('NATIVE_PE_OPTIONAL_HEADER')
 directory=opt+(112 if magic==0x20b else 96);number=u32(opt+(108 if magic==0x20b else 92));imagebase=struct.unpack_from('<Q'if magic==0x20b else'<I',data,opt+(24 if magic==0x20b else 28))[0]
 sections=[]
 for i in range(count):
  at=opt+size+i*40;virtual_size=u32(at+8);rva=u32(at+12);raw_size=u32(at+16);raw=u32(at+20);sections.append((rva,max(virtual_size,raw_size),raw,raw_size))
 def offset(rva):
  for start,length,raw,raw_size in sections:
   if start<=rva<start+length:
    result=raw+rva-start
    if result>=len(data)or rva-start>=raw_size:raise ValueError('NATIVE_PE_RVA_OUTSIDE_RAW_DATA')
    return result
  if 0<=rva<len(data)and rva<u32(opt+60):return rva
  raise ValueError('NATIVE_PE_UNMAPPED_RVA')
 def string(rva):
  start=offset(rva);end=data.find(b'\0',start,min(len(data),start+1024))
  if end<0:raise ValueError('NATIVE_PE_IMPORT_NAME_BOUND')
  return data[start:end].decode('ascii')
 imports=[];delay=[]
 for index,width,target in [(1,20,imports),(13,32,delay)]:
  if number<=index:continue
  rva=u32(directory+index*8);bound=u32(directory+index*8+4)
  if not rva:continue
  at=offset(rva)
  # Windows uses the null descriptor terminator; some valid producers leave
  # the directory's informational Size at zero. Still bound reads by file/4096.
  for i in range(4096):
   row=data[at+i*width:at+(i+1)*width]
   if len(row)!=width:raise ValueError('NATIVE_PE_IMPORT_TABLE_BOUND')
   if not any(row):break
   name=struct.unpack_from('<I',row,12 if index==1 else 4)[0]
   if index==13 and not(struct.unpack_from('<I',row,0)[0]&1):name-=imagebase
   target.append(string(name))
  else:raise ValueError('NATIVE_PE_IMPORT_TABLE_UNTERMINATED')
 return {'machine':hex(machine),'format':'PE32+'if magic==0x20b else'PE32','imports':sorted(set(imports)),'delayImports':sorted(set(delay))}
def inspect(roots):
 natives=[];notices=[];packages={};python_distributions=[]
 for label,root in roots:
  root=Path(root).resolve(strict=True)
  for file in sorted(root.rglob('*')):
   if file.is_symlink()or getattr(file,'is_junction',lambda:False)():raise ValueError('NATIVE_PAYLOAD_LINK_REJECTED:'+str(file))
   if not file.is_file():continue
   rel=file.relative_to(root).as_posix()
   if any(re.search(r'^(?:licen[sc]e|licenses|copying|notice|third.party)(?:[._-]|$)',part,re.I)for part in Path(rel).parts):notices.append({'root':label,'path':rel,'sha256':sha(file),'bytes':file.stat().st_size})
   if file.name=='METADATA'and file.parent.name.endswith('.dist-info'):
    metadata=BytesParser().parsebytes(file.read_bytes(),headersonly=True);python_distributions.append({'root':label,'path':rel,'name':metadata.get('Name'),'version':metadata.get('Version'),'licenseExpression':metadata.get('License-Expression'),'legacyLicenseField':metadata.get('License'),'metadataSHA256':sha(file)})
   with file.open('rb')as stream:magic=stream.read(8)
   if file.suffix.lower()not in EXTENSIONS and magic[:2]!=b'MZ'and magic[:4]!=b'\0asm':continue
   entry={'root':label,'path':rel,'sha256':sha(file),'bytes':file.stat().st_size};data=file.read_bytes()
   if file.suffix.lower()=='.wasm'or data[:4]==b'\0asm':
    if data[:8]!=b'\0asm\x01\0\0\0':raise ValueError('NATIVE_WASM_SIGNATURE:'+rel)
    entry['format']='WebAssembly'
   else:entry.update(pe_imports(data))
   parent=file.parent
   while parent==root or root in parent.parents:
    manifest=parent/'package.json'
    if manifest.is_file():
     key=(label,parent.relative_to(root).as_posix())
     if key not in packages:
      m=json.loads(manifest.read_text(encoding='utf8'));packages[key]={'root':label,'directory':key[1],'name':m.get('name'),'version':m.get('version'),'declaredLicense':m.get('license'),'manifestSHA256':sha(manifest)}
     entry['npmPackage']=packages[key]['name'];entry['packageDirectory']=key[1];break
    if parent==root:break
    parent=parent.parent
   if 'site-packages/'in rel:
    entry['pythonNamespace']=rel.split('site-packages/',1)[1].split('/',1)[0]
   natives.append(entry)
 return {'schema':1,'scope':'Complete actual installed outer native files PLUS all native files extracted from the exact actual app.asar, including unpacked entries. Duplicate outer/archive representations are explicit. No license approval inferred from substrings.','status':'inspected','packagedNativePayloadInspected':True,'nativeFileRepresentations':len(natives),'nativeFiles':natives,'nativePackages':list(packages.values()),'pythonDistributions':python_distributions,'originalNoticeFiles':notices,'correspondingSourceMaterialsVerified':False,'releaseCleared':False}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--installed',type=Path,required=True);p.add_argument('--asar-copy',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 r=inspect([('actual-installed',a.installed),('actual-app-asar',a.asar_copy)])
 if not r['nativeFiles']:raise ValueError('NATIVE_INVENTORY_EMPTY')
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items()if k not in ('nativeFiles','nativePackages','pythonDistributions','originalNoticeFiles')},indent=2))
