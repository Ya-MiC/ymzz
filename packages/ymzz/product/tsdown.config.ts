import {execFileSync} from 'node:child_process'
import path from 'node:path'
import {clientBundle} from '../../client/tsdown.client.ts'
export default clientBundle(import.meta.dirname,['index.mjs'],{lib:{hooks:{'build:done':()=>{execFileSync(process.execPath,[path.resolve(import.meta.dirname,'../../../ymzz/integrations/univer/build.mjs')],{stdio:'inherit'})}}}})
