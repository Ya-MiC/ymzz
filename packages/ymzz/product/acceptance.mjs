// MIT. Content-bound local acceptance, not an identity signature or an OS sandbox.
import {createHash} from 'node:crypto';
const check=(ok,code)=>{if(!ok)throw new Error(code)};
const hashPattern=/^[a-f0-9]{64}$/;
const sha=value=>createHash('sha256').update(value).digest('hex');
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 check(value===null||['string','boolean','number'].includes(typeof value),'EVIDENCE_VALUE_INVALID');
 check(typeof value!=='number'||Number.isFinite(value),'EVIDENCE_VALUE_INVALID');return value;
}
export const evidenceHash=value=>sha(JSON.stringify(canonical(value)));
function files(snapshot){
 check(snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot),'EVIDENCE_SNAPSHOT_INVALID');
 const rows=Object.entries(snapshot).sort(([a],[b])=>a<b?-1:a>b?1:0);check(rows.length>0&&rows.length<=64,'EVIDENCE_SNAPSHOT_INVALID');
 return rows.map(([name,hash])=>{
  check(name.length<=160&&!name.startsWith('/')&&!name.includes('\\')&&!name.includes(':')&&name.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/[\x00-\x1f]/.test(p))&&hashPattern.test(hash),'EVIDENCE_FILE_INVALID');return{path:name,sha256:hash};
 });
}
export function createAcceptanceReceipt(task,snapshot,ledgerHead,{now=Date.now()}={}){
 check(!task.pendingWrite,'PENDING_WRITE_REQUIRES_ROLLBACK');
 const gate=task.gates?.at(-1);check(gate?.passed===true&&gate.exitCode===0&&task.gateRevision===task.revision,'FRESH_GATE_REQUIRED');
 const rows=files(snapshot);check(evidenceHash(snapshot)===evidenceHash(task.gateSnapshot),'GATE_SNAPSHOT_CHANGED');
 check(snapshot[task.testFile]===task.testHash,'PROTECTED_TEST_CHANGED');check(hashPattern.test(ledgerHead),'EVIDENCE_LEDGER_INVALID');
 if(gate.evidence)check(gate.evidence.testSHA256===task.testHash&&gate.evidence.revision===task.revision&&gate.evidence.snapshotSHA256===evidenceHash(snapshot)&&hashPattern.test(gate.evidence.outputSHA256),'GATE_EVIDENCE_MISMATCH');
 const payload={schema:1,kind:'ymzz-local-acceptance',taskId:task.id,revision:task.revision,boundAtKST:new Date(now+9*3600000).toISOString().replace('Z','+09:00'),files:rows,snapshotSHA256:evidenceHash(snapshot),protectedTest:{path:task.testFile,sha256:task.testHash},gateSHA256:evidenceHash(gate),gate:{passed:true,exitCode:0,outputSHA256:gate.evidence?.outputSHA256??null,provenance:gate.evidence?'recorded-node-test-result':'legacy-result-output-hash-unavailable'},model:{transport:task.mode,liveInference:task.mode==='offline-fixture'?false:'not-established'},ledgerHead,scope:'Content hashes and one local acceptance; not a signature, external completion receipt or complete session history'};
 return{payload,sha256:evidenceHash(payload)};
}
export function verifyAcceptanceReceipt(receipt){
 check(receipt?.payload?.schema===1&&receipt.payload.kind==='ymzz-local-acceptance'&&hashPattern.test(receipt.sha256)&&evidenceHash(receipt.payload)===receipt.sha256,'RECEIPT_INTEGRITY_INVALID');
 const p=receipt.payload;check(p.gate?.passed===true&&p.gate.exitCode===0&&hashPattern.test(p.gateSHA256)&&hashPattern.test(p.ledgerHead),'RECEIPT_PROOF_INVALID');
 check(Array.isArray(p.files)&&p.files.length<=64&&new Set(p.files.map(f=>f.path)).size===p.files.length,'RECEIPT_FILES_INVALID');
 const snapshot=Object.fromEntries(p.files.map(f=>[f.path,f.sha256]));files(snapshot);check(evidenceHash(snapshot)===p.snapshotSHA256&&snapshot[p.protectedTest?.path]===p.protectedTest.sha256,'RECEIPT_PROOF_INVALID');return receipt;
}
export function requireFreshReceipt(task,snapshot){
 const receipt=verifyAcceptanceReceipt(task.acceptanceReceipt),p=receipt.payload;
 check(p.taskId===task.id&&p.revision===task.revision&&p.protectedTest.path===task.testFile&&p.protectedTest.sha256===task.testHash&&p.gateSHA256===evidenceHash(task.gates.at(-1)),'RECEIPT_TASK_MISMATCH');
 check(evidenceHash(snapshot)===p.snapshotSHA256,'ACCEPTED_WORKSPACE_CHANGED');return receipt;
}
export function createAcceptanceCapsule(task,events,{ledgerValid,consent,snapshot}={}){
 check(consent===true,'REPORT_CONSENT_REQUIRED');check(ledgerValid===true,'EVIDENCE_CHAIN_INVALID');check(task.state==='accepted','ACCEPT_FIRST');
 const receipt=verifyAcceptanceReceipt(task.acceptanceReceipt),anchor=events.find(e=>e.id===task.id&&['accepted','legacy-acceptance-receipt-bound'].includes(e.kind)&&e.payload?.receiptSHA256===receipt.sha256);
 check(anchor&&anchor.prev===receipt.payload.ledgerHead,'RECEIPT_ANCHOR_MISSING');
 const payload={schema:1,kind:'ymzz-acceptance-capsule',receipt:structuredClone(receipt),anchor:structuredClone(anchor),workspaceAtExport:snapshot===undefined?'unavailable-not-rechecked':evidenceHash(snapshot)===receipt.payload.snapshotSHA256?'matches-accepted-snapshot':'changed-since-acceptance',privacy:'Relative filenames and hashes only; no file contents, absolute workspace path, prompt or credentials. Historical acceptance does not attest current files.'};
 const capsule={payload,sha256:evidenceHash(payload)};verifyAcceptanceCapsule(capsule);return capsule;
}
export function verifyAcceptanceCapsule(capsule){
 check(capsule?.payload?.schema===1&&capsule.payload.kind==='ymzz-acceptance-capsule'&&evidenceHash(capsule.payload)===capsule.sha256,'CAPSULE_INTEGRITY_INVALID');
 check(['matches-accepted-snapshot','changed-since-acceptance','unavailable-not-rechecked'].includes(capsule.payload.workspaceAtExport),'CAPSULE_STATUS_INVALID');
 const{receipt,anchor}=capsule.payload;verifyAcceptanceReceipt(receipt);check(anchor&&anchor.id===receipt.payload.taskId&&['accepted','legacy-acceptance-receipt-bound'].includes(anchor.kind)&&anchor.payload?.receiptSHA256===receipt.sha256&&anchor.prev===receipt.payload.ledgerHead,'RECEIPT_ANCHOR_MISSING');
 const{hash,...body}=anchor;check(sha(JSON.stringify(body))===hash,'CAPSULE_ANCHOR_INVALID');return{valid:true,scope:'local-hash-consistency-only',taskId:receipt.payload.taskId,receiptSHA256:receipt.sha256,workspaceAtExport:capsule.payload.workspaceAtExport,identitySignatureVerified:false,externalCompletionVerified:false};
}
