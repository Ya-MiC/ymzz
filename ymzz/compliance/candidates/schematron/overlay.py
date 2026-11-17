"""MIT. Hash-locked derived-payload overlay; immutable wheel/upstream sources are never edited."""
import argparse, hashlib, json, os, tempfile
from pathlib import Path

HERE=Path(__file__).resolve().parent

def apply(runtime_root):
    root=Path(runtime_root)
    if root.is_symlink() or not root.is_dir():raise ValueError('Invalid derived payload root')
    root=root.resolve()
    provenance=json.loads((HERE/'PROVENANCE.json').read_text())
    operations=[]
    for entry in provenance['files']:
        destination=root/entry['originalWheelPath']
        if any(path.is_symlink() for path in [destination,*destination.parents] if path!=root.parent):
            raise ValueError('Symlink in derived payload path')
        if not destination.resolve().is_relative_to(root) or not destination.is_file():raise ValueError('Missing/conflicting derived payload transform')
        replacement=(HERE/entry['candidate']).read_bytes()
        if hashlib.sha256(replacement).hexdigest()!=entry['candidateSHA256']:raise ValueError('Candidate source hash mismatch')
        old_hash=hashlib.sha256(destination.read_bytes()).hexdigest()
        if old_hash not in [entry['originalSHA256'],entry['candidateSHA256']]:raise ValueError('Unexpected original payload hash; review required')
        operations.append((destination,replacement,entry,old_hash))
    # Validate BOTH inputs before any write. Never accept a changed upstream transform silently.
    changed=[]
    for destination,replacement,entry,old_hash in operations:
        if old_hash!=entry['candidateSHA256']:
            fd,temporary=tempfile.mkstemp(prefix='.ymzz-mit-xsl-',dir=destination.parent)
            try:
                with os.fdopen(fd,'wb') as f:f.write(replacement)
                os.chmod(temporary,destination.stat().st_mode)
                os.replace(temporary,destination)
            finally:
                if os.path.exists(temporary):os.unlink(temporary)
        assert hashlib.sha256(destination.read_bytes()).hexdigest()==entry['candidateSHA256']
        changed.append({'path':entry['originalWheelPath'],'beforeSHA256':old_hash,'afterSHA256':entry['candidateSHA256'],'license':'MIT','source':entry['source'],'alreadyApplied':old_hash==entry['candidateSHA256']})
    return {'schema':1,'scope':'Explicitly selected derived payload only; not a full installer/compliance qualification','files':changed,'releaseCleared':False}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--derived-payload-root',type=Path,required=True);args=parser.parse_args()
    print(json.dumps(apply(args.derived_payload_root),indent=2))
