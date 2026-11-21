"""MIT. Producer code identity, NOT a license waiver or Authenticode claim.
Only Electron metadata/icon/version resources and exact V1 fuse state bytes may vary.
Executable sections, imports, loader behavior and unknown resources must remain equal.
"""
import argparse,hashlib,json,struct,xml.etree.ElementTree as ET
from pathlib import Path
SENTINEL=b'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'
def require(ok,error):
 if not ok:raise ValueError(error)
def sha(data):return hashlib.sha256(data).hexdigest()
def parse(data):
 def u16(i):return struct.unpack_from('<H',data,i)[0]
 def u32(i):return struct.unpack_from('<I',data,i)[0]
 require(data[:2]==b'MZ','PE_MZ');pe=u32(60);require(data[pe:pe+4]==b'PE\0\0','PE_SIGNATURE');opt=pe+24;require(u16(opt)==0x20b,'PE_64BIT_REQUIRED');count=u16(pe+6);size=u16(pe+20);require(0<count<=96 and size>=240,'PE_SECTION_BOUND');sections={}
 for n in range(count):
  i=opt+size+n*40;name=data[i:i+8].rstrip(b'\0').decode('ascii');virtual=u32(i+8);rva=u32(i+12);length=u32(i+16);offset=u32(i+20);flags=u32(i+36);require(name not in sections and offset+length<=len(data),'PE_SECTION_INVALID');require(virtual<=1024*1024*1024,'PE_SECTION_VIRTUAL_BOUND');sections[name]={'name':name,'virtual':virtual,'rva':rva,'length':length,'offset':offset,'flags':flags,'data':data[offset:offset+length]}
 def address(rva,length=1):
  found=[s for s in sections.values()if s['rva']<=rva and rva+length<=s['rva']+s['length']];require(len(found)==1,'PE_RVA_BOUND');s=found[0];return s['offset']+rva-s['rva']
 require(u32(opt+108)==16,'PE_DIRECTORIES');directories=[(u32(opt+112+i*8),u32(opt+116+i*8))for i in range(16)];resources={};base=address(directories[2][0]);visited=set()
 def resource_name(value):
  if not value&0x80000000:return value
  at=base+(value&0x7fffffff);length=u16(at);require(length<=512,'PE_RESOURCE_NAME_BOUND');return data[at+2:at+2+length*2].decode('utf-16-le')
 def walk(relative,key=()):
  require(len(key)<=3 and relative not in visited and len(visited)<10000,'PE_RESOURCE_TREE');visited.add(relative);at=base+relative;entries=u16(at+12)+u16(at+14);require(entries<10000,'PE_RESOURCE_COUNT')
  for n in range(entries):
   at=base+relative+16+n*8;name=resource_name(u32(at));target=u32(at+4);path=key+(name,)
   if target&0x80000000:walk(target&0x7fffffff,path)
   else:
    require(len(path)==3 and path not in resources,'PE_RESOURCE_DUPLICATE_OR_DEPTH');entry=base+target;rva=u32(entry);length=u32(entry+4);where=address(rva,length);resources[path]=data[where:where+length]
 walk(0)
 end=max(s['offset']+s['length']for s in sections.values());overlay=data[end:];critical=data[pe+4:pe+6]+data[pe+18:pe+24]+data[opt:opt+8]+data[opt+16:opt+56]+data[opt+60:opt+64]+data[opt+68:opt+112]
 return {'sections':sections,'resources':resources,'directories':directories,'critical':critical,'overlay':overlay}
def fuse_normalize(original,candidate):
 require(original.count(SENTINEL)==candidate.count(SENTINEL),'PE_FUSE_COUNT_CHANGED')
 if SENTINEL not in original:return candidate,[]
 require(original.count(SENTINEL)==1,'PE_FUSE_AMBIGUOUS');at=original.index(SENTINEL);require(candidate.index(SENTINEL)==at,'PE_FUSE_MOVED');start=at+len(SENTINEL);require(original[start:start+2]==candidate[start:start+2]and original[start]==1,'PE_FUSE_VERSION_OR_LENGTH_CHANGED');length=original[start+1];require(length>=8,'PE_FUSE_LENGTH');out=bytearray(candidate);changes=[]
 for i in range(min(length,8)):
  pos=start+2+i
  if original[pos]==candidate[pos]:continue
  require(original[pos]in b'01'and candidate[pos]in b'01','PE_UNSUPPORTED_FUSE_STATE');out[pos]=original[pos];changes.append(i)
 return bytes(out),changes
def manifest(data):
 root=ET.fromstring(data.decode('utf-8-sig'))
 for e in root.iter():
  if e.tag.endswith('assemblyIdentity'):e.attrib.pop('name',None)
  if e.text is not None and not e.text.strip():e.text=None
  if e.tail is not None and not e.tail.strip():e.tail=None
 return ET.tostring(root)
def asar_header_digest(file):
 with Path(file).open('rb')as stream:
  prefix=stream.read(16);require(len(prefix)==16,'ASAR_HEADER_PREFIX');pickle_size,header_size,payload_size,string_size=struct.unpack('<IIII',prefix);require(pickle_size==4 and 8<=header_size<=64*1024*1024 and payload_size==header_size-4 and string_size<=header_size-8,'ASAR_HEADER_BOUNDS');raw=stream.read(string_size);require(len(raw)==string_size,'ASAR_HEADER_TRUNCATED');value=json.loads(raw.decode('utf-8'));require(isinstance(value,dict)and isinstance(value.get('files'),dict),'ASAR_HEADER_SCHEMA');return sha(raw)
def compare(original,candidate,reference_sha,asar_header_sha):
 require(sha(original)==reference_sha,'UNREVIEWED_ELECTRON_PRODUCER');a=parse(original);b=parse(candidate);require(a['critical']==b['critical'],'PE_LOADER_FIELDS_CHANGED');require(set(a['sections'])==set(b['sections']),'PE_SECTION_SET_CHANGED');fuses=[];immutable=[]
 for name,s in a['sections'].items():
  t=b['sections'][name];require(s['flags']==t['flags'],'PE_SECTION_FLAGS_CHANGED '+name)
  if name=='.rsrc':require(not(t['flags']&0x20000000),'PE_RESOURCE_EXECUTABLE');continue
  require(s['virtual']==t['virtual']and(s['rva']==t['rva']or name=='.reloc'),'PE_SECTION_LAYOUT_CHANGED '+name);data,changed=fuse_normalize(s['data'],t['data']);require(data==s['data'],'PE_CODE_OR_IMMUTABLE_DATA_CHANGED '+name);fuses+=changed;immutable.append({'section':name,'sha256':sha(data)})
 for i,(old,new)in enumerate(zip(a['directories'],b['directories'])):
  if i in(2,4):continue
  require(old==new,'PE_DIRECTORY_CHANGED '+str(i))
 require(not b['overlay']or not any(b['overlay'])or b['overlay']==a['overlay'],'PE_UNREVIEWED_OVERLAY')
 require(set(a['resources'])-set(b['resources'])<= {k for k in a['resources']if k[0]in(3,14,16)},'PE_RESOURCE_REMOVED');allowed=[];integrity=0
 for key,data in b['resources'].items():
  if key[0]in(3,14,16):allowed.append(list(key));continue
  if key[0]=='INTEGRITY':
   require(key[1]=='ELECTRONASAR','PE_UNKNOWN_INTEGRITY_RESOURCE');value=json.loads(data.decode());require(value==[{'file':'resources\\app.asar','alg':'SHA256','value':asar_header_sha}],'PE_ACTUAL_ASAR_HEADER_NOT_BOUND');integrity+=1;continue
  if key[0]==24:require(key in a['resources']and manifest(data)==manifest(a['resources'][key]),'PE_MANIFEST_BEHAVIOR_CHANGED');continue
  require(a['resources'].get(key)==data,'PE_UNKNOWN_RESOURCE_CHANGED')
 require(integrity==1,'PE_EXACT_ASAR_INTEGRITY_RESOURCE_REQUIRED')
 return {'schema':1,'codeIdentityVerified':True,'referenceSHA256':reference_sha,'actualExecutableSHA256':sha(candidate),'actualAsarHeaderSHA256':asar_header_sha,'immutableSections':immutable,'fuseStateIndicesChanged':fuses,'metadataResourceKeys':allowed,'limits':'Electron code/producer identity only, not original-grant/source clearance, new app GUI proof, signature or a policy exception.','releaseCleared':False}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--reference',type=Path,required=True);p.add_argument('--actual',type=Path,required=True);p.add_argument('--reference-sha256',required=True);p.add_argument('--asar-header-sha256',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();r=compare(a.reference.read_bytes(),a.actual.read_bytes(),a.reference_sha256,a.asar_header_sha256);a.output.write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8');print(json.dumps(r,indent=2))
