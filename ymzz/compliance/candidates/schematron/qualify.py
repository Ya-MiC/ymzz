"""MIT. Compare actual hash-locked Windows-wheel XSL to licensed candidates, never install either."""
import argparse, hashlib, json, platform, tempfile, zipfile
from pathlib import Path
from lxml import etree, isoschematron
from overlay import apply

p=argparse.ArgumentParser();p.add_argument('--wheel',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
root=Path(__file__).resolve().parent
provenance=json.loads((root/'PROVENANCE.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
assert hashlib.file_digest(a.wheel.open('rb'),'sha256').hexdigest()==provenance['originalWheelSHA256']
SCH='http://purl.oclc.org/dsdl/schematron'
XSD='http://www.w3.org/2001/XMLSchema'
RNG='http://relaxng.org/ns/structure/1.0'
checks=[]
with zipfile.ZipFile(a.wheel) as wheel, tempfile.TemporaryDirectory(prefix='ymzz-xsl-equivalence-') as td:
 directory=Path(td)
 staged=directory/'derived-payload'
 for entry in provenance['files']:
  path=staged/entry['originalWheelPath'];path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(wheel.read(entry['originalWheelPath']))
 overlay=apply(staged)
 assert all(not item['alreadyApplied'] for item in overlay['files'])
 assert all(item['alreadyApplied'] for item in apply(staged)['files'])
 # Deliberate unknown upstream change must fail before writing the other file.
 first=staged/provenance['files'][0]['originalWheelPath'];last=staged/provenance['files'][1]['originalWheelPath']
 first.write_bytes(wheel.read(provenance['files'][0]['originalWheelPath']));last.write_bytes(b'changed-upstream')
 try:apply(staged);raise AssertionError('Unexpected upstream change was accepted')
 except ValueError:pass
 assert sha(first.read_bytes())==provenance['files'][0]['originalSHA256']
 last.write_bytes(wheel.read(provenance['files'][1]['originalWheelPath']));apply(staged)
 class ConfinedResolver(etree.Resolver):
  def resolve(self,url,pubid,context):
   path=Path(url.removeprefix('file://')).resolve()
   if not path.is_relative_to(directory):raise ValueError('Fixture attempted out-of-root XML access')
   return self.resolve_filename(str(path),context)
 parser=etree.XMLParser(resolve_entities=False,no_network=True,load_dtd=False)
 parser.resolvers.add(ConfinedResolver())
 access=etree.XSLTAccessControl(read_file=True,write_file=False,create_dir=False,read_network=False,write_network=False)
 pattern='<sch:pattern id="p"><sch:rule context="i:root"><sch:assert test="@ok = &quot;yes&quot;" diagnostics="d">中文 assertion</sch:assert><sch:report test="@bad">Unexpected attribute</sch:report></sch:rule></sch:pattern>'
 header='<sch:title>Embedded rules</sch:title><sch:ns prefix="i" uri="urn:items"/><sch:ns prefix="i" uri="urn:items"/>'
 footer='<sch:phase id="selected"><sch:active pattern="p"/></sch:phase><sch:diagnostics><sch:diagnostic id="d">Check ok</sch:diagnostic></sch:diagnostics>'
 for entry in provenance['files']:
  original=wheel.read(entry['originalWheelPath']);candidate=(root/entry['candidate']).read_bytes()
  assert sha(original)==entry['originalSHA256'];assert sha(candidate)==entry['candidateSHA256']
  before=etree.XSLT(etree.fromstring(original,parser,base_url=str(directory/'original.xsl')),access_control=access)
  after=etree.XSLT(etree.parse(str(staged/entry['originalWheelPath']),parser),access_control=access)
  kind='rng' if 'RNG' in entry['candidate'] else 'xsd'
  def schema(body,include=''):
   if kind=='rng':return f'<rng:grammar xmlns:rng="{RNG}" xmlns:sch="{SCH}">{include}<rng:start><rng:element name="root"><rng:empty/></rng:element></rng:start>{body}</rng:grammar>'
   return f'<xs:schema xmlns:xs="{XSD}" xmlns:sch="{SCH}">{include}<xs:annotation><xs:appinfo>{body}</xs:appinfo></xs:annotation></xs:schema>'
  child=directory/f'child.{kind}';child.write_text(schema(pattern+footer))
  include=f'<rng:include href="{child.name}"/>' if kind=='rng' else f'<xs:include schemaLocation="{child.name}"/>'
  samples={'embedded':schema(header+pattern+footer),'included':schema(header,include),'empty':schema('')}
  if kind=='rng':samples['element-root']=f'<rng:element xmlns:rng="{RNG}" xmlns:sch="{SCH}" name="root">{header+pattern+footer}<rng:empty/></rng:element>'
  for name,source in samples.items():
   doc=etree.fromstring(source.encode(),parser,base_url=str(directory/f'main-{name}.{kind}'))
   old=before(doc);new=after(doc)
   oldbytes=etree.tostring(old,method='c14n');newbytes=etree.tostring(new,method='c14n')
   assert oldbytes==newbytes,(kind,name,'transformed output differs')
   if name!='empty':
    assert len(new.xpath('//sch:ns',namespaces={'sch':SCH}))==1
    validator=isoschematron.Schematron(new,phase='selected',store_report=True)
    assert validator.validate(etree.fromstring(b'<root xmlns="urn:items" ok="yes"/>'))
    assert not validator.validate(etree.fromstring(b'<root xmlns="urn:items" ok="no"/>'))
    # lxml's default validity policy counts failed assertions, not successful reports.
    assert validator.validate(etree.fromstring(b'<root xmlns="urn:items" ok="yes" bad="true"/>'))
    assert len(validator.validation_report.xpath('//*[local-name()="successful-report"]'))==1
   checks.append({'candidate':entry['candidate'],'case':name,'canonicalOutputSHA256':sha(newbytes),'byteEquivalentCanonicalOutput':True,'ruleValidationChecked':name!='empty'})
report={'schema':1,'scope':'Behavioral equivalence on box Linux lxml, using exact Windows-wheel reference transforms. NOT actual installed Windows payload proof.','platform':platform.system(),'lxml':etree.LXML_VERSION,'libxml':etree.LIBXML_COMPILED_VERSION,'libxslt':etree.LIBXSLT_COMPILED_VERSION,'wheelSHA256':provenance['originalWheelSHA256'],'checks':checks,'passed':True,'derivedStagingOverlayQualified':True,'idempotencyVerified':True,'unknownInputRejectedBeforeAnyWrite':True,'productionRuntimeReplaced':False,'packagedWindowsQualified':False,'releaseCleared':False}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
