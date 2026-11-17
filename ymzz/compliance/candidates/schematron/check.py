"""MIT. Candidate provenance and unchanged executable XML structure, not payload replacement proof."""
from pathlib import Path
import hashlib,json,xml.etree.ElementTree as E
root=Path(__file__).resolve().parent
j=json.loads((root/'PROVENANCE.json').read_text())
def node(e):
 text=e.text or''
 if e.tag!='{http://www.w3.org/1999/XSL/Transform}text':text=text.strip()
 return[e.tag,sorted(e.attrib.items()),text,[node(c)for c in e],(e.tail or'').strip()]
for f in j['files']:
 p=root/f['candidate'];b=p.read_bytes();assert len(b)<16384
 assert hashlib.sha256(b).hexdigest()==f['candidateSHA256']
 assert b'Permission is hereby granted' in b and b'The MIT License' in b
 ns=sorted(set(E.iterparse(p,events=('start-ns',))))
 structure=[ns,node(E.parse(p).getroot())]
 assert hashlib.sha256(json.dumps(structure,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==f['structuralSHA256']
 assert f['matchesActualShippedTransformIgnoringCommentsFormatting'] is True
 print(f['candidate']+': exact source/license and identical active XML structure PASS; NOT applied to payload')
assert j['payloadReplacementQualified'] is False
