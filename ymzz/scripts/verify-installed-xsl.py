"""MIT. Run with ACTUAL bundled Python: qualify loaded production lxml transforms, not a fixture copy."""
import argparse, hashlib, json
from pathlib import Path
from lxml import etree, isoschematron
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[1]
provenance=json.loads((root/'compliance/candidates/schematron/PROVENANCE.json').read_text())
package=Path(etree.__file__).resolve().parent
proof=[]
for entry in provenance['files']:
 file=package/entry['originalWheelPath'].removeprefix('lxml/')
 data=file.read_bytes();digest=hashlib.sha256(data).hexdigest()
 assert digest==entry['candidateSHA256'],f'Actual installed transform not replaced: {file.name}'
 assert b'Permission is hereby granted' in data and b'Rick Jelliffe and Topologi' in data
 proof.append({'file':entry['originalWheelPath'],'actualSHA256':digest,'expectedSHA256':entry['candidateSHA256'],'MITGrantAndOriginalCredits':True})
SCH='http://purl.oclc.org/dsdl/schematron'
body=f'<sch:pattern xmlns:sch="{SCH}" id="p"><sch:rule context="root"><sch:assert test="@ok = &quot;yes&quot;">中文 assertion</sch:assert></sch:rule></sch:pattern>'
samples={
 'RNG':f'<grammar xmlns="http://relaxng.org/ns/structure/1.0"><start><element name="root"><empty/></element></start>{body}</grammar>',
 'XSD':f'<schema xmlns="http://www.w3.org/2001/XMLSchema"><annotation><appinfo>{body}</appinfo></annotation></schema>'}
checks=[]
for name,source in samples.items():
 # This uses lxml's own actual installed Schematron extraction entry point, not a replacement test shim.
 validator=isoschematron.Schematron(etree.fromstring(source.encode()),store_report=True)
 assert validator.validate(etree.fromstring(b'<root ok="yes"/>'))
 assert not validator.validate(etree.fromstring(b'<root ok="no"/>'))
 checks.append({'kind':name,'actualInstalledSchematronExtractAndValidate':True,'validAndInvalidAssertionsPassed':True})
report={'schema':1,'scope':'Actual installed bundled Python/lxml production resource hashes and native extraction/validation','lxml':etree.LXML_VERSION,'iconvCompiled':etree.ICONV_COMPILED_VERSION,'libxmlCompiled':etree.LIBXML_COMPILED_VERSION,'libxsltCompiled':etree.LIBXSLT_COMPILED_VERSION,'files':proof,'checks':checks,'actualInstalledMITOverlayQualified':True,'releaseCleared':False}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
