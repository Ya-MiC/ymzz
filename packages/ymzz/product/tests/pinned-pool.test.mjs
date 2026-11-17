// MIT. Byte-for-byte upstream source guard, stronger than normalizing vendored Markdown.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
test('all immutable approved skill files retain exact source SHA256 including original Markdown whitespace',()=>{const lock=JSON.parse(fs.readFileSync(path.join(root,'core-skills.lock.json'),'utf8'));let count=0;for(const s of lock.skills)for(const f of s.files){if(f.excluded)continue;const bytes=fs.readFileSync(path.join(root,s.destination,f.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,s.id+'/'+f.path);count++}assert.equal(count,596)});
