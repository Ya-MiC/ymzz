# Upstream sync / 同步上游

Keep only `master`. `origin` is `https://github.com/Ya-MiC/ymzz.git`; `upstream` is `https://github.com/deepseek-ai/deepseek-harness.git`.

Every clone must run once (repository-local, never global):

```sh
git config merge.ours.driver true
```

The root `.gitattributes` has the one requested additive line `README.md merge=ours`. The driver preserves our README when a merge invokes it; it does NOT guarantee every fast-forward/checkout leaves it unchanged. Review all sync diffs, licenses, plugin compatibility and release gates before pushing. Do not use `--force`, `reset --hard`, blind `pull` or arbitrary upstream auto-install. Do not rename `@deepseek-ai/*`.

M1 exact history: `gh repo fork --fork-name ymzz --default-branch-only --clone=false` found an existing stock fork in the account's network; GitHub CLI reused it under the requested `Ya-MiC/ymzz` name. Repository creation metadata remains 2026-08-15 11:14:41 KST (not newly created today). Its old master `47f943859bef60e4160492346772ded9b24f765a` was verified an ancestor, then fast-forwarded locally to official `39163dd30f703a79079e2d2446545cff3c453738`. No history was forced or discarded; the old `Ya-MiC/deepseek-harness` URL redirects to the same fork. A fresh clone used single-branch mode and both fetch specs are master-only. Upstream's own intervening file changes are its history, not authored ymzz core rewrites.

Our M1 diff against the current official baseline is restricted to README.md, the additive gitattributes line, allowed new root docs and new ymzz namespaces. Original root README bytes are retained in `ymzz/docs/upstream/README.md`. Old ymzz-zhanzhen/Loop repositories and branches are not merged, deleted or overwritten.
