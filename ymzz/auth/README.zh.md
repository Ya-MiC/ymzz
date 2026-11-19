# 网站帐户服务 — 参考

[English](README.md) | 中文

此独立私有服务使用 Node.js 24.15+、Better Auth（MIT）、Nodemailer（MIT-0）及内建 SQLite。GitHub Pages 官网维持公开静态网站，不需登入即可阅读；它不能执行认证后端。没有引入钱包、付费认证订阅或本机 agent（智能体）授权。后端主机、正式 HTTPS 网域和邮件服务尚未选定或配置；可优先使用既有资源，但不能保证所有正式部署都免费。此 Node 实作不能原样部署到 Cloudflare Workers，Workers/D1 是另行确认的部署决策。

## 功能与安全

`/account` 提供 Google 按钮登入（授权码、state、S256 PKCE，明确验证 ID token 签章、issuer、audience、到期时间）、五分钟有效且单次使用的邮箱验证码、确认后启用的验证器 TOTP、十个单次恢复码及登出。这不是自动弹出的 Google One Tap，不载入 Google 浏览器 SDK，不索取 Gmail/Drive 权限。Google 邮箱必须已验证。同邮箱不会偷偷合并帐户；应先登入，再明确连结同邮箱 Google 帐户。

邮箱码不是第二因素。已启用 TOTP 的帐户，每个新 Google／邮箱码工作阶段均须通过验证器或恢复码，伺服器才允许读取帐户或修改安全设定。Better Auth 预设不会对无密码登入套用其密码登入 2FA 拦截，因此本服务另外以 SQLite 的工作阶段验证纪录限制所有帐户请求。不可直接公开原始 provider handler；后续业务 API 必须使用同一检查。未使用的 provider API 和原始 session API 已封锁。重新设定验证器会清除旧验证纪录，不能以旧纪录绕过新因素。

正式 cookie 为 host-only、Secure、HttpOnly、SameSite=Lax，工作阶段最长十二小时；浏览器储存空间及 JSON 不保留登入 token。变更操作要求同源 Origin 与 JSON，没有跨网域 session API。邮箱验证码以杂凑储存，恢复码、TOTP 密钥与 OAuth token 加密储存；同一 TOTP 九十秒内不可跨工作阶段重用。IP、帐户和邮箱共用 SQLite 限流。全局寄信预算预设每小时 100 封（`MAIL_HOURLY_LIMIT`，可配置为 1 至 10000），投递失败也消耗预算。错误讯息不揭露帐户是否存在，邮件寄送失败不伪装成功，不记录密码、代码、回呼查询、token 或个资。SMTP 强制验证凭证的 TLS／STARTTLS。

## 部署前提与步骤

1. 确认实际帐户 HTTPS origin 与具持久磁碟的既有 Node 主机。帐户页与 API 必须同源，可与 GitHub Pages 分开；不要将 cookie 跨产品共享。本次没有新建主机、资料库、帐号或付费资源。
2. 执行 `npm ci --prefix ymzz/auth --ignore-scripts`，依 `.env.example` 在主机的秘密管理工具配置。Google／SMTP 缺少整组配置时各自停用；半套配置、弱密钥、不安全正式 origin 会阻止启动。秘密不得放进官网 JS、公开档案或 Git。
3. 在本人的 Google 专案建立 Web application OAuth client，回呼必须精确为 `<AUTH_ORIGIN>/api/auth/callback/google`，并完成同意画面、网域、隐私条款及测试／发布状态；测试模式应列出允许的测试用户。在后端配置 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`。程式不会代交 OAuth 表单。
4. 使用有权寄送交易邮件的既有 SMTP 寄件人，配置服务商要求的 SPF／DKIM／DMARC，以及 `SMTP_HOST`、`SMTP_PORT`（465 或 587）、`SMTP_USER`、`SMTP_PASSWORD`、`MAIL_FROM`；不得使用开放中继。
5. 设定 `AUTH_ORIGIN`、独立随机 `AUTH_SECRET`（至少 32 字元）、位于 web root 外的 `AUTH_DATABASE` 及 `PORT`。一致备份 SQLite／WAL 与加密密钥；遗失密钥将无法解密 TOTP／OAuth 资料。依序执行 `npm --prefix ymzz/auth run migrate`、`npm --prefix ymzz/auth run build`、`npm --prefix ymzz/auth start`。资料库迁移不会在 HTTP 请求时自动执行。每个 SQLite 资料库仅用单一 Node 执行个体及持久本机磁碟，不用暂存 serverless 磁碟或网路磁碟。
6. 以本机反向代理终止 HTTPS，转发至 `127.0.0.1:3100`，不要公开 Node 连接埠。只有代理会覆写单一 `X-Real-IP` 时才能设 `TRUST_PROXY=loopback`；否则不设，所有连线共用代理 IP 限流。开放注册前应加上边缘／全域邮件滥用限制及配额。资料保留／删除、监控、邮件额度与备份还原由部署者管理。
7. 在真实网域完成本人核准的 Google 登入、实际收信、新浏览器 TOTP／恢复码、登出、限流与备份还原验收后，才将 `ymzz/site/config.js` 的 `accountUrl` 从空字串改成 `<AUTH_ORIGIN>/account`。目前官网入口保持隐藏，不会偷偷请求尚未存在的服务；入口只是导页，不是跨域 API。不能把程式测试通过说成正式登入已开通。

## 验证与商用

执行 `npm --prefix ymzz/auth run build && npm --prefix ymzz/auth test` 可在记忆体 SQLite、拦截邮件回呼及合成签章 Google 回应下测试，不会实际寄信或连到 Google。`node ymzz/scripts/check-site.mjs` 检查官网。仅供本机人工查看时，可设 `NODE_ENV=development`、loopback `AUTH_ORIGIN`、独立本机测试密钥与暂存私有资料库；未配置的 provider 仍停用，正式环境不得开启 development。

独立 `package-lock.json` 锁定依赖与完整性，不改桌面 runtime 依赖图。所用开源协议允许商用，散布服务时保留依赖附带的授权声明；Google、SMTP、主机条款仍各自适用。
