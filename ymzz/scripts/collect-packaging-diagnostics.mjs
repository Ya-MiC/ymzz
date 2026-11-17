/** MIT. Publish only whitelisted, re-redacted phase failures; never read private launch/output logs. */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function redact(message, environment = process.env) {
  let text = String(message);
  const secrets = Object.entries(environment).filter(([name, value]) => /TOKEN|SECRET|PASSWORD|KEY|APPLE_ID/i.test(name) && value).map(([,value]) => value).sort((a,b) => b.length-a.length);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
  text = text.replace(/https?:\/\/[^\s<>"']+/g, value => {
    try { const url = new URL(value); return url.origin + url.pathname + (url.search || url.hash ? '?[REDACTED]' : ''); }
    catch { return '[REDACTED_URL]'; }
  });
  text = text.replace(/(authorization\s*[:=]\s*)(?:Bearer\s+|Basic\s+)?[^\s,;]+/gi, '$1[REDACTED]');
  text = text.replace(/((?:token|password|secret|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
  return text.slice(0, 12000);
}

export function collect(root, environment = process.env) {
  const directory = join(root, 'apps/desktop/.desktop-build/packaging-runs');
  const runs = existsSync(directory) ? readdirSync(directory, {withFileTypes:true}).filter(entry => entry.isDirectory()).map(entry => join(directory,entry.name)).filter(path => existsSync(join(path,'run.json'))).sort() : [];
  const latest = runs.at(-1);
  const report = {schema:1, sourceCommit:environment.GITHUB_SHA ?? null, runId:environment.GITHUB_RUN_ID ?? null, runAttempt:environment.GITHUB_RUN_ATTEMPT ?? null, measuredAt:new Date().toISOString(), packageConclusion:environment.YMZZ_PACKAGE_CONCLUSION ?? 'unknown', guiConclusion:environment.YMZZ_GUI_CONCLUSION ?? 'unknown', installedGuiQualified:environment.YMZZ_GUI_CONCLUSION === 'success', releaseCleared:false, scope:'Current run only. Skipped GUI is NOT success. Other artifact files can include preserved historical evidence; their scopes/dates remain authoritative.', readsPrivateLaunchOrOutputLogs:false, phases:[]};
  if (!latest) return {...report, packagingJournalPresent:false};
  const journal=join(latest,'events.jsonl');
  if (!existsSync(journal)) return {...report, packagingJournalPresent:false};
  for (const line of readFileSync(journal,'utf8').split('\n').filter(Boolean)) {
    const event=JSON.parse(line);
    if (event.type !== 'stage-end') continue;
    const phase={stage:/^[a-zA-Z0-9:_.\/-]{1,120}$/.test(event.stage ?? '') ? event.stage : '[invalid stage]', time:typeof event.time==='string' ? event.time : null};
    for (const key of ['success','code','signal','timedOut','fatalObserved','launchError','outputError','terminationCode','terminationError','elapsedMs']) {
      if (typeof event[key]==='boolean' || typeof event[key]==='number' || event[key]===null) phase[key]=event[key];
    }
    if (typeof event.error==='string') phase.error=redact(event.error,environment);
    report.phases.push(phase);
  }
  return {...report,packagingJournalPresent:true};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const root=resolve(process.argv[2] ?? '.');
  const report=collect(root);
  const output=join(root,'ymzz/docs/evidence/windows/qualification-run.json');
  mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({sourceCommit:report.sourceCommit,packageConclusion:report.packageConclusion,guiConclusion:report.guiConclusion,failedPhases:report.phases.filter(phase=>phase.success===false || phase.code!==undefined && phase.code!==0),releaseCleared:false},null,2));
}
