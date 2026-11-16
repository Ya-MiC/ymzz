# Network inventory / 新增對外請求

M1 adds **zero runtime network requests** and zero telemetry. No runtime code, polling, update channel, analytics or payment service is added/enabled. README hyperlinks are user navigation, not background requests.

Development operations: git/gh contact github.com / api.github.com for explicitly requested source/fork/settings/read-only release checks. These are maintainer actions, not shipped telemetry. pnpm dependency downloads and upstream runtime networking are not falsely described as zero-network; M2 has not run in this checkout. Future added runtime requests must list endpoint, purpose, consent, data sent, timeout and a setting to disable them before merging. Never include keys or local auth launch tokens in evidence.
