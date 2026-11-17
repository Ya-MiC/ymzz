// MIT. Shared pure checks; no independent runtime or database.
import {createHash} from 'node:crypto';
export const sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export function assert(ok,code){if(!ok)throw new Error(code)}
