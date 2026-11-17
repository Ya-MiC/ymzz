#!/usr/bin/env node
// MIT. Launch official complete DSH CLI with a separate product-owned profile, not a new runtime.
import {spawn} from 'node:child_process';import {homedir} from 'node:os';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const home=process.env.YMZZ_HOME||path.join(homedir(),'.ymzz');
const env={...process.env,DSH_HOME:home,DSH_AGENTS_HOME:process.env.YMZZ_AGENTS_HOME||path.join(home,'agents'),DSH_TELEMETRY_DISABLED:'1',DSH_CLIENT_TITLE:'湛箴_ymzz'};
const child=spawn(process.execPath,[path.join(root,'apps/cli/lib/bin.js'),'web',...process.argv.slice(2)],{cwd:root,env,stdio:'inherit',shell:false});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('error',()=>{console.error('湛箴_ymzz 無法啟動；請先 pnpm install 與 pnpm run build:artifacts。');process.exitCode=1});child.on('exit',code=>{process.exitCode=code??1});
