# Content-bound acceptance harness

[繁體中文](HARNESS.zh-Hant.md) · [Product](../../README.md)

## One implemented flow, not another runtime

**Real DSH task → protected Node test → human diff acceptance → content receipt → fresh explicit memory → portable metadata capsule.**

The full upstream DSH agent loop, tools, session persistence, approvals, UI slots and provider settings already exist. We do not replace them with an Agnes runtime or a second orchestrator. This increment fixes an actual gap in our plugin: its previous memory was a generic sentence and its exported report did not bind a human acceptance to exact tested content. Previously a file could change after acceptance and still be remembered without another content check.

Implemented in `packages/ymzz/product/acceptance.mjs`, connected to the real tool/review routes, not just an example wrapper:

1. Every owned test gate records the protected test hash, task revision, complete bounded workspace snapshot digest and digest of the returned test output. The real test still requires native DSH approval. Nothing runs from a capsule.
2. Human acceptance still requires the existing passing/fresh gate, exact snapshot and conflict checks. It adds an immutable content receipt and binds its hash to the local acceptance event. Event payloads are cloned so later mutable arrays cannot rewrite old facts by reference.
3. “Remember” rechecks all bounded files against the accepted snapshot, task revision and gate hash, and checks the local evidence anchor. Changed, added or removed files block memory. Memory records the receipt/snapshot and transport scope, not a generic unqualified success. It is a local explicit memory record, **not automatic training or model retrieval**. This checks freshness at commit time, not perpetual monitoring.
4. An accepted task's existing card offers **匯出這次驗收收據（JSON）**. The authenticated, CSRF-protected `/ymzz/evidence/capsule` POST requires explicit consent before reading the workspace. The capsule contains relative filenames/hashes, typed gate provenance and one local event anchor, not file contents, absolute workspace paths, nickname, prompt or credentials. Nothing is shared/uploaded automatically.
5. Export labels whether the current workspace matches, changed, or could not be rechecked. Historical acceptance remains exportable even if the directory disappeared; it is not a new successful test. Remember remains fail-closed. Older records lacking output hashes retain an explicit `legacy-result-output-hash-unavailable` gap, never fabricated output. Existing history is not deleted.

From the source checkout, inspect a user-exported capsule offline:

```sh
node ymzz/scripts/verify-acceptance-capsule.mjs /path/to/ymzz-acceptance-ID.json
```

The verifier checks content hashes, gate/snapshot consistency and the linked local event. **These are unsigned local hashes, not identity authentication, a full global ledger proof, an independent witness or an external completion receipt.** A hostile same-user writer who rewrites every hash is outside this guarantee. The verifier does not execute/import capsule content, contact a service, read the named workspace, or grant tool authority. It rejects malformed/oversized input and changed hashes. Screenshots or successful tests are not inferred from arbitrary model text.

## Agnes reference, and our deliberate difference

Public materials inspected2026-11-20 KST:

- [Requested Agnes page](https://agnes-ai.com/agnes-harness): readable fetch was empty, so no visual/layout claims were inferred from it.
- [Publisher repository README](https://github.com/AgnesAI-Labs/agnes-harness): describes a developer-preview, plugin-based FDE harness, not finished hosted software.
- [Why AGH](https://github.com/AgnesAI-Labs/agnes-harness/blob/main/docs/guide/why-agh.md): reusable business plugins, shared runtime and evidence-backed delivery; expressly not a performance ranking.
- [Execution evidence](https://github.com/AgnesAI-Labs/agnes-harness/blob/main/docs/guide/fact-chain.md): distinguishes facts, gaps, artifact references and external completion; history is read-only evidence, not authorization.
- [Security/trust](https://github.com/AgnesAI-Labs/agnes-harness/blob/main/docs/guide/security.md): trusted in-process plugins are not an OS sandbox; approval and package trust differ.

These are mutable public `main` documents, not a version we installed or benchmarked. We did not run Agnes, test its model quality, copy its code/art/brand, install a connector, or claim parity/superiority.

| Reference idea | Existing DSH capability retained | Our focused increment |
|---|---|---|
| Everything is a plugin | Existing agents/tools/approval/slots/skills | Personal local-first verification in the existing product plugin |
| Durable sessions/recovery | Native DSH persistence/resume already present | No duplicate session engine or automatic crash replay |
| Evidence and reusable knowledge | Native tool/session history | Hash-bound human acceptance plus freshness checked before explicit memory |
| Delivery/handoff | Existing local reports | Per-task metadata-only capsule with explicit historical gaps |
| Workbench | Official native layout and panels | Only add receipt text/button inside the existing task card; four Wenrun palettes unchanged |

## Verification and limits

`node --test packages/ymzz/product/tests/*.test.mjs` includes receipt, snapshot drift, test/revision/output mismatches, missing consent/anchor, legacy provenance, traversal/size, tampering and unsigned-identity boundaries. Packaging/integrity/signing/license regressions remain unchanged.

After `corepack pnpm run build:artifacts`, POSIX source/CI can exercise the **actual full DSH HTTP runtime**, real approved tools and Node tests with an explicit deterministic fake model:

```sh
python3 ymzz/scripts/test-harness-local.py --port 3092 --output /tmp/ymzz-harness-proof.json
```

It uses a new private profile, approves real tool requests, observes failing→repair→passing tests, accepts, changes only its synthetic project to prove memory rejection, restores it, remembers, exports and verifies a capsule, rejects a tampered capsule and stops only its own server. It does not use a browser, pay for inference, touch user projects or upload launch tokens. The dedicated manual `ymzz-harness.yml` CI uploads only synthetic proof JSON. Existing Windows GUI proof predates this new feature; no new feature GUI success is claimed until actually measured.

Scope is the owned bounded Node-test task path, not automatic attestation of every native DSH/Office/external tool. Office functionality and native source qualification remain separate. No automatic resume, wider filesystem/network sandbox, third-party signature, paid backend or AGH feature breadth is promised. No dependency/network egress was added. Loop remains a separate completed product.

**Release is still held by corresponding-source/material closure for the actual selected Office/libvips payload.** This feature does not set release/license flags, republish older binaries, or turn the website into a false installer download. Commercial/dependency obligations and full Windows qualification remain independent gates.


## Explicit receipt context for the next local-model task

Workspace tasks default to no receipt. Select one accepted local receipt and preview it to recheck bounded workspace contents, receipt integrity and ledger anchoring without requesting a model. Relative filenames and hashes can be sensitive. Only pressing Run attaches the metadata to the native DSH task. The source must be the same workspace; rechecking happens before task creation and again after agent creation immediately before followup, never by trusting a cached preview. Consent, exact receipt selection, current content and ledger/anchor checks fail closed.

The metadata is labeled untrusted historical data, not instructions or tool authority. Strings inside filenames are data. It excludes source contents, original prompts and absolute workspace paths; provenance preserves fixture and legacy gaps. New tasks still need their own tests, individual tool approvals and human review. This is explicit single-receipt handoff, not automatic retrieval, imported capsule execution, training, permanent freshness or verified model quality. Unit/HTTP checks do not qualify browser or Windows GUI interaction.

Native route integration tests run after the complete artifact build: `node --test packages/ymzz/product/tests/integration/*.test.mjs`. They exercise the real plugin with a mock agent handle and need built workspace packages; they are not live-model tests.
