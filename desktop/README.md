# 湛箴_ymzz Desktop（Tauri 2 壳）

给比赛和日常使用者的「下载即用」入口。**壳只负责窗口与生命周期，本体仍是完整、
未修改的 DeepSeek Harness 本地 web 服务**；本目录不包含任何模型调用、云服务或
重新实现。

## 架构

```
安装包（nsis / dmg / appimage）
└── Tauri 2 壳（desktop/src-tauri，Rust）
    ├── 读取 <app data>/desktop/ymzz-desktop.json（可选；缺省用 43110 起的空闲端口）
    ├── 用打包随附的官方 Node 运行时启动打包随附的 DSH 服务
    │     环境变量：PORT、DSH_PRIMARY_RUNTIME、DSH_TELEMETRY_DISABLED=1
    ├── 轮询 http://127.0.0.1:<port> 直到就绪（默认 30 秒，超时弹错并退出）
    ├── 就绪后把主窗口（1280×800，最小 960×640）导航到该地址
    └── 应用退出时终止服务子进程
```

打包内容见 `desktop/resources/README.md`；壳的全部行为参数（端口、启动参数、
就绪探测方式、超时）都可由 `desktop/ymzz-desktop.json` 覆盖，代码里没有密钥、
没有绝对路径、没有遥测。

## 本地构建

前置：已安装 Rust（stable）、pnpm、Node 22；`packages/ymzz/product/icon-128.png`
存在。

```sh
# 1. 仓库本体构建产物
pnpm install --frozen-lockfile
pnpm build:artifacts

# 2. 组装桌面资源（下载官方 Node、校验 SHA256、拷贝构建产物）
node desktop/scripts/assemble-resources.mjs

# 3. 生成全套图标（仓库只有 128px 源图；正式发布前请替换高分辨率源图）
pnpm dlx @tauri-apps/cli@latest icon desktop/src-tauri/icons/app-icon.png -o desktop/src-tauri/icons

# 4. 本地打包
pnpm dlx @tauri-apps/cli@latest build --project-path desktop
```

只做快速检查时：`cd desktop/src-tauri && cargo check`。

## CI 产物与验收边界（重要）

- CI 产出的安装包是**自动构建的未验收 canary**：它们只证明「能编译、能打包」，
  不构成任何功能、安全或合规验收。安装包会以 prerelease 形式附在
  `desktop-v*` tag 对应的 GitHub Release 上，并在说明里明确标注未验收。
- 桌面 GUI（安装、启动、窗口交互）尚未完成真人验收；在验收完成前，请以
  `pnpm` 源码运行方式为准。
- 桌面壳不改变 DSH 的任何行为边界；插件与面板的能力边界见
  `docs/knowledge-tagging.md`。

## 后续可选集成

- [archify](https://github.com/tt-a1i/archify)（Apache-2.0，Agent Skill，非
  Rust/Tauri 项目）可用于生成架构图，作为发布说明的插图来源之一；它不是打包
  工具，与安装包生产线无关。其 DSH 插件为 `@tt-a1i/archify-dsh`。
