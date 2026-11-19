# Deployment integration update

The website is integrated into the same `master`. A dedicated `.github/workflows/ymzz-pages.yml` validates and uploads only `ymzz/site`; Pages was explicitly enabled through the normal API for THIS new repository. No inherited workflow or old Loop environment was enabled/changed. Actual live deployment evidence follows only after Actions succeeds.

Latest owner correction: Loop is a completed, separate project-management product; the site is a visual reference only. All three languages and fallback HTML state this; no application/data migration is provided. Release API networking is off by default and manual-only.

---

# 湛箴_ymzz official website

Source lives in [`ymzz/site/`](../site/). This is the product-specific official site for **湛箴_ymzz**, not 稟冊 and not the upstream DeepSeek Harness `website/` tree.

## Public URL (proposed, not live yet)

Expected URL after GitHub Pages is enabled for this public repository:

**https://ya-mic.github.io/ymzz/**

The repository `homepage` field is already set to that URL. A read-only check on 2026-11-17 (Asia/Seoul) found:

| Observation | Actual result |
|---|---|
| `GET /repos/Ya-MiC/ymzz` | `has_pages: false`, `default_branch: master`, `homepage: https://ya-mic.github.io/ymzz/`, public |
| `GET /repos/Ya-MiC/ymzz/pages` | HTTP 404 — Pages is not configured |
| `GET /repos/Ya-MiC/ymzz/environments` | `total_count: 0` — no `github-pages` environment on this repo |
| `GET /repos/Ya-MiC/ymzz/releases` | empty array (no public releases) |
| Inherited workflows | Present under `.github/workflows/*` and **all `disabled_manually`** (including upstream `docs-pages.yml` and `desktop-rollout.yml`) |
| Live `https://ya-mic.github.io/ymzz/` | Not deployed (expected 404 until Pages is enabled) |

Do **not** enable those inherited upstream workflows. Do **not** point Pages at the upstream `website/` or `docs/` trees. Do **not** change Pages, environment, or domain settings on [ymzz-loop](https://ya-mic.github.io/ymzz-loop/) or other family sites.

## How to deploy (parent / maintainer)

1. Leave this documentation workflow file in `ymzz/docs/github-pages.workflow.yml` until you are ready.
2. Copy it to `.github/workflows/ymzz-pages.yml` (a new, non-inherited workflow name).
3. In GitHub: **Settings → Pages → Source: GitHub Actions**. This is a normal UI/API enablement step. The proposed workflow does **not** set `enablement: true`, so it will not quietly create Pages behind your back.
4. The first `workflow_dispatch` or `master` push that touches `ymzz/site/**` should create a `github-pages` environment if GitHub needs one. There is currently no protection rule to preserve on this repository.
5. Confirm the site is served as a **project site**, so asset and page URLs work under the `/ymzz/` prefix. HTML in `ymzz/site/` uses **relative** paths (`style.css`, `start.html`) plus canonical URLs of `https://ya-mic.github.io/ymzz/…`.

Loop's own Pages (for comparison only; do not modify):

- `GET /repos/Ya-MiC/ymzz-loop/pages` returned `build_type: workflow`, `html_url: https://ya-mic.github.io/ymzz-loop/`, `https_enforced: true`, `cname: null`, source metadata still mentioning `main` `/`.
- Loop has an existing `github-pages` environment with no protection rules.
- Loop's `pages.yml` currently deploys the `site/` tree; that is a different repository.

## Honest download policy

The main call to action is **run from source** until a non-draft, non-prerelease GitHub Release contains uploaded installer assets. The page must not advertise 稟冊 draft installers, private artifacts, or empty download buttons as if 湛箴_ymzz were already packaged.

## Tests

From the repository root:

```sh
node ymzz/scripts/check-site.mjs
```

The script checks in-repo HTML/CSS/JS only (IDs, `/ymzz/` prefix rules, no trackers, four themes, installer honesty, CSP). Live family-site curl is optional and is recorded by the operator, not required for the unit check.

## Design sources

- Visual / layout grammar: the public Loop site https://ya-mic.github.io/ymzz-loop/ and its `site/` source
- Color, motion, hit targets, four palettes: https://github.com/Ya-MiC/ymzz-wenrun-design-skill (`assets/tokens/tokens.css`)

## Website accounts

The separately hosted [account service](../auth/README.md) owns Google sign-in, email OTP and authenticator 2FA. GitHub Pages never handles credentials or authentication cookies; its account navigation remains disabled until the actual backend origin and production flows pass acceptance.
