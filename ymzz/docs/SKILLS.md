# Product skills / 固定來源技能

The genuine full-DSH product plugin registers9 instruction skills with official `ctx.skills.register`: find-skills, agent-browser, grill-me, hyperframes-cli, hyperframes, modern-web-guidance, impeccable, hallmark and taste-skill.

`ymzz/skills/core-skills.lock.json` indexes the detailed package lock `packages/ymzz/product/core-skills.lock.json`, with exact source repositories/commit hashes, entrypoint hashes, retained license files and explicit exclusions. Reused selected MIT integration provenance is separately recorded in `packages/ymzz/product/PROVENANCE.json`; existing repositories are untouched. Each instruction entrypoint is checksum-checked at host startup. The copied approved files were also checksum-verified before integration; explicitly excluded executable/helper assets remain excluded, not silently declared installed.

This means **registered instructions**, NOT installed third-party CLIs, authenticated services, arbitrary plugin isolation, permission to execute downloaded commands, or paid-service availability. No bot/global `~/.agents`/skills/configuration is modified. Official upstream skills remain intact. Resource/source links remain in `RESOURCES.md`.

Preservation detail: all596 approved copied files retain their exact upstream SHA256, including intentional Markdown hard line breaks. A **pool-local `.gitattributes`, Markdown-only** whitespace exception preserves those immutable third-party bytes; our source lint/whitespace checks and all license gates remain active. `pinned-pool.test.mjs` verifies every copied file, not just entrypoints. No upstream source or hook is changed.
