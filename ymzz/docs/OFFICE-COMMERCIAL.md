# Office：實際功能與商用邊界 / actual functionality and commercial use

2026-11-18 KST. This is an engineering/compliance finding, not individual legal advice.

## 能否商用？ / Commercial use?

**MPL-2.0 本身允許公司使用、收費及與其他授權組合；不是「Office 不能商用」。但這個確切安裝包尚未通過對應來源與整體授權閘，現在不能稱為可合規分發的完成品。**

Mozilla's [official FAQ Q5, Q7–Q8, Q11](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) permits use by individuals/companies for any purpose. A Larger Work need not all become MPL. Outside redistribution still needs accurate notices and access to the corresponding MPL Source Code Form ([MPL1.13,3.1–3.4](https://www.mozilla.org/en-US/MPL/2.0/)). New ymzz MIT code does not relicense Office, native engines or their dependencies.

## 真實功能，不是 mock / actual unmocked operations

`node ymzz/scripts/qualify-office.mjs` mounts the real upstream `@deepseek-ai/dsh-office-kit` service in a real Cordis context, without replacing its converter, and checks four real operations with newly generated synthetic documents:

1. DOCX → PDF, actual PDF bytes/header.
2. DOCX page1 → PNG, actual PNG bytes and dimensions.
3. DOCX → ODT, actual retained document text.
4. XLSX formula `SUM(A1:B1)` with2+3, deliberately stale cached0 → recalculated5 in the actual output workbook.

[Measured Linux/WASM0.2.3 result](evidence/office-local-1118.json): all four pass. This is not Windows installed proof, a GUI editing test, or a guarantee about every legacy Office format/font/fidelity. The single Windows qualification workflow now independently extracts an owned temporary COPY of the actual installed `app.asar` with upstream ASAR tooling and runs the same real provider with its actual bundled Node/native engine. It retains source archive/Node hashes, never changes installed resources, and still runs if the separate GUI check fails.

## 精確未解項 / precise remaining source gap

The exact npm adapter0.2.3 has root MPL-2.0,103 files and no source maps/TypeScript implementation; the official public repository remains0.1.3 at `b19bb73c74ed893b8a5d1716d32df32a113ed31b` (freshly checked2026-11-18). The native engine supplies real C++ source recipes/patches, but that does not establish matching preferred adapter source. `lib/editor.js` explicitly identifies bundled source modules including `native-process`, `editor-protocol`, `editor-transport`; those preferred sources are not in the entire available public archive.

Fresh full DSH import-graph inspection confirms its Office wrapper imports the root `createConverter` API, not the editor/frame-forwarding subpaths. Nevertheless, unused MPL files in a shipped package are still distributed: silently deleting them or substituting0.1.3 without native/format equivalence is NOT a compliance fix. Frame-forwarding has its own actual MIT grant and is not falsely treated as MPL. The root NOTICE's historical source coordinates were followed: the public DSH tree API for4438b67 and public commit pages for21261bee/adapter2ae2de8 returned422; they did not supply missing preferred sources. That is not proof those sources never existed.

**Necessary material:** verifiable matching preferred Source Code Form/build inputs for the shipped0.2.3 MPL adapter, or a separately proven feature-equivalent supported source-complete implementation. A policy waiver cannot manufacture third-party source rights. No maintainer has been contacted; generated JS is not relabeled preferred TS. See [exact prior boundary evidence](../compliance/research/office-matching-source-bounded-check.json).

Separately, the NumPy/OpenBLAS DLL is actually `GPL-3.0-or-later WITH GCC-exception-3.1`, not bare GPL and not MIT. Eligible non-GPL/proprietary combinations can be permitted by that exception; the owner's exact category decision remains unapproved. This is separate from MPL commercial permission and the approved LGPL/MPL exceptions. No binary is uploaded or published while either hold remains.
