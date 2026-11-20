#!/usr/bin/env node
// MIT. Offline hash-consistency check only. No imports/network/workspace access from capsule.
import fs from 'node:fs';
import {verifyAcceptanceCapsule} from '../../packages/ymzz/product/acceptance.mjs';
try{
 if(process.argv.length!==3)throw Error('USAGE_VERIFY_CAPSULE_FILE');
 const file=process.argv[2],st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>262144)throw Error('CAPSULE_FILE_INVALID');
 console.log(JSON.stringify(verifyAcceptanceCapsule(JSON.parse(fs.readFileSync(file,'utf8'))),null,2));
}catch(error){console.error(/^[A-Z_]+$/.test(error.message)?error.message:'CAPSULE_INVALID');process.exitCode=1}
