# 湛箴_ymzz Desktop（Tauri 2 壳）

给比赛和日常使用者的「下载即用」入口。**壳只负责窗口与生命周期，本体仍是完整、
未修改的 DeepSeek Harness 本地 web 服务**；本目录不包含任何模型调用、云服务或
重新实现。

## 架构

```
安装包（nsis / dmg；Linux 见 Known limitations）
└── Tauri 2 壳（desktop/src-tauri，Rust）
    ├── 读取 <app data>/desktop/ymzz-desktop.json（可选；缺省 43110 起扫描 20 个空闲端口）
    ├── 启动打包随附的运行时（全部来自上游已验证的打包链，见 resources/README.md）：
    │     node <backend>/dependencies/node/bin/node(.exe)
    │        node_modules/@deepseek-ai/dsh/lib/bin.js web --no-open --host 127.0.0.1 --port <port>
    │     环境变量：PORT、DSH_PRIMARY_RUNTIME=<backend 根>、DSH_TELEMETRY_DISABLED=1
    ├── 就绪探测两段：先打 `/`（任何 2xx/3xx 即服务在），
    │     再打 `/ymzz/state` —— 200/400/401/403 都算插件已挂载；404 = 插件缺失，
    │     超时后弹错退出（这是唯一能探测出插件死亡的信号：服务器对 `/` 永远回 200）
    ├── 就绪后把主窗口（1280×800，最小 960×640）导航到 http://127.0.0.1:<port>
    └── 应用退出时终止服务子进程
```

**插件如何被加载（已核实机制）**：`web` profile 的 bundle 层是
`@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`
（`packages/util/official-bundles/src/bundles.ts:14-16`）；web-app 层的
`packages/bundle/web-app/cordis.patch.yml:638` 插入 `@ymzz/dsh-product`，从运行时
自身的 `node_modules` 解析（`apps/cli/package.json:96` →
`packages/bundle/web-app/package.json:61` `workspace:*` →
`apps/desktop/scripts/pack-local-packages.ts:27-29` 打包、由
`apps/desktop/scripts/package-target.ts:491` 接线，最终落在
`targets/<target>/dsh/node_modules/`）。壳对 `DSH_PRIMARY_RUNTIME` 只传运行时根
目录，`dependencies/node/bin/node(.exe)` 由插件自己拼接
（`packages/ymzz/product/index.mjs:18-24`）。

打包内容与来源见 `desktop/resources/README.md`；壳的全部行为参数（端口、启动参数、
就绪探测方式、超时）都可由 `desktop/ymzz-desktop.json` 覆盖，代码里没有密钥、
没有绝对路径、没有遥测。

## 本地构建

前置：已安装 Rust（stable）、pnpm、Node 22；`packages/ymzz/product/icon-128.png`
存在。

```sh
# 1. 安装依赖 + 构建仓库产物
pnpm install --frozen-lockfile
pnpm build:artifacts

# 2. 运行上游 Desktop 打包链（build → 打包含 ymzz 插件的 tarball →
#    prepare:runtime / prepare:packages / prepare:dsh），产出
#    apps/desktop/.desktop-build/targets/<target>/
node desktop/scripts/prepare-upstream-runtime.mjs win-x64   # 或 mac-arm64 / mac-x64

# 3. 纯拷贝组装 Tauri 资源
node desktop/scripts/assemble-resources.mjs --target win-x64

# 4. 生成全套图标（仓库只有 128px 源图；正式发布前请替换高分辨率源图）
pnpm dlx @tauri-apps/cli@2.12.6 icon desktop/src-tauri/icons/app-icon.png -o desktop/src-tauri/icons

# 5. 本地打包
pnpm dlx @tauri-apps/cli@2.12.6 build --project-path desktop
```

只做快速检查时：`cd desktop/src-tauri && cargo check`。

## CI 产物与验收边界（重要）

- CI 产出的安装包是**自动构建的未验收 canary**：它们只证明「能编译、能打包」，
  不构成任何功能、安全或合规验收。
- **安装包未签名、未公证**：Windows 无 Authenticode 签名（SmartScreen 可能拦截），
  macOS 无 codesign / notarization（Gatekeeper 需右键打开或 `xattr -d` 放行）。
  安装包以 prerelease 形式附在 `desktop-v*` tag 对应的 GitHub Release 上。
- 桌面 GUI（安装、启动、窗口交互）尚未完成真人验收；在验收完成前，请以
  `pnpm` 源码运行方式为准。
- 桌面壳不改变 DSH 的任何行为边界；插件与面板的能力边界见
  `docs/knowledge-tagging.md`。

## Known limitations（已知限制，随第一轮真机反馈修）

- **Linux 不在本轮矩阵内**：上游链只支持 `win-x64` / `mac-arm64` / `mac-x64`
  （`apps/desktop/scripts/desktop-build-paths.mjs` 的 `SUPPORTED_TARGETS`）；
  `tauri.conf.json` 保留 `appimage` 目标，待上游有 Linux payload 再启用
  （assembler 的 `--from-nodejs-dist` 分支为该场景预留）。
- **端口抢占竞态**：壳先 `TcpListener::bind` 验空再立即释放，另一个进程仍可能在
  服务真正绑定前抢走该端口（有界竞争，失败会以就绪超时呈现）。
- **CSP 由 DSH 响应头接管**：`tauri.conf.json` 的 CSP 只作用于壳的本地启动页；
  导航到本地服务后，安全头以 DSH webserver 自己的响应为准。
- **后台线程 panic 无兜底**：启动/输出转发线程 panic 只会在线程内终止（进程仍在），
  现象是无窗口导航；待真机反馈决定是否加 panic 钩子与自动退出。
- **SIGKILL 孤儿**：正常退出会杀子进程，但应用被 SIGKILL/断电时，捆绑服务可能
  短暂残留（Node 侧无父进程心跳）。
- **`.assemble-temp` 在 backend 内**：fallback 分支的下载暂存目录位于打包资源
  目录内部，异常中断可能残留（脚本 `finally` 清理；正常流程无残留）。

## 后续可选集成

- [archify](https://github.com/tt-a1i/archify)（Apache-2.0，Agent Skill，非
  Rust/Tauri 项目）可用于生成架构图，作为发布说明的插图来源之一；它不是打包
  工具，与安装包生产线无关。其 DSH 插件为 `@tt-a1i/archify-dsh`。
