# dsh-pet 独立版 🐾

> **原作者：[PC2005-cloud](https://github.com/PC2005-cloud)**
> **原始项目：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)**（DeepSeek Harness 插件，MIT）
>
> 本项目是它的**非官方独立版改造**：桌宠本体（动画素材、渲染逻辑、物理拖拽、配置体系、素材生成流水线）
> 全部来自原作者；本次改造只做一件事——**去掉插件形态与宿主依赖**，让它成为可独立运行的桌面应用。
> 改动的具体清单见文末「从插件版改造的清单」。原项目版权与许可见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
>
> 如果你想要的是**原版插件**（嵌在 DeepSeek Harness 网页/桌面应用里），请直接去原仓库，不要用本仓库。

一只住在桌面上的蓝色大肥鱼：待机呼吸、随机动作（打瞌睡、玩魔方、吃火锅……）、屏幕漫游、点击 Q 弹、拖拽甩抛反弹、右键菜单点播，一百余个透明动画随时无缝衔接；接上你自己的大模型 API 后还会定时碎碎念、陪你聊天。

**它不依赖任何编辑器、IDE 或宿主应用**——就是一只桌宠，双击即出现透明置顶小窗。

---

## 快速开始

### 方式一：绿色版（推荐，无需安装 Node）

```sh
npm install          # 首次准备依赖
npm run build        # 构建 lib 与桌面共享核心
npm run package:portable
```

产物在 `dsh-pet/dist/portable/`，整个目录可拷到任意位置：

| 文件 | 用途 |
| --- | --- |
| `启动桌宠.cmd` | 前台启动，能看到日志（排障用） |
| `静默启动.vbs` | 后台启动，只有桌宠、没有控制台窗口 |
| `node.exe` | 自带 Node 运行时，不依赖系统 Node |

双击任一启动脚本，桌宠即出现在桌面右上角。首次启动会自动下载 Electron 运行时（约 100 MB，缓存在数据目录，之后秒开）。

### 方式二：从源码运行

```sh
npm install
npm run build
npm start                  # 前台运行（能看日志，排障用；留一个终端窗口）
node lib/main.js --check   # 只体检：配置来源、宠物清单、Electron 状态
node lib/main.js --port 3100
```

要求 Node.js ≥ 22.12（绿色版自带运行时，不需要）。

日常使用不必开终端：双击 `dsh-pet/启动桌宠.vbs`，它在后台静默拉起桌宠，不留控制台窗口。

---

## 启动与退出（不需要留终端）

| 场景 | 做法 |
| --- | --- |
| 日常启动（绿色版） | 双击 `静默启动.vbs` —— 无控制台窗口 |
| 日常启动（源码版） | 双击 `dsh-pet/启动桌宠.vbs` —— 无控制台窗口 |
| 想看日志再启动 | 双击 `启动桌宠.cmd` / 终端 `npm start`（日志同时写文件） |
| **退出** | 桌面托盘图标 →「退出桌宠」 —— 桌宠、托盘与后台服务一起收尾 |
| 重复双击 | 被单实例保护拦下，不会开出第二只宠物 |
| 排查 | `~/.dsh/dsh-pet/standalone.log`（静默运行时唯一的日志出口，超 10 MB 自动轮转） |

两点说明：

- 后台服务必须有一个宿主进程常驻（它负责路由、状态与拉起 Electron 窗口）。静默启动只把这个进程的
  控制台窗口隐藏，不是"没有进程"——所以要退出请走托盘，而不是关窗口。
- 托盘菜单里同时列着全部宠物（勾选 = 当前显示在桌面上），点一下即可显示/隐藏，这是隐藏运行时
  唯一的可视化入口。

### 方式三：全局安装

```sh
npm install -g .
dsh-pet
```

---

## 能做什么 / 不做什么

| 能力 | 状态 |
| --- | --- |
| 动画链、待机呼吸、随机动作、转向、漫游 | ✅ |
| 点击、拖拽、甩抛、反弹、多开同屏 | ✅ |
| 右键菜单点播动作、回到初始位置、重载配置 | ✅ |
| 自定义动画素材、添加全新宠物种类（pet pack） | ✅ |
| 碎碎念与对话（自带 API Key） | ✅ 需在设置页配置 |
| 余额查询 | ❌ 需要宿主侧凭证，点击会明确提示不可用 |
| 会话工作状态联动 | ❌ 独立版没有宿主会话事件 |
| 系统通知 | ❌ 原实现由宿主网页半侧驱动 |

设计原则：**不可用的能力明确失败，不伪造成功**。所有失败都带 `reason`，能在气泡或日志里看到原因。

---

## 右键菜单

右键宠物即可：

- **打开设置** —— 系统默认浏览器打开本机设置页（URL 自带本次运行的访问令牌，不会泄露给其它站点）
- **查看余额** —— 独立版固定返回「当前服务商暂不支持余额查询」（provider = `standalone`）
- **碎碎念 / 对话** —— 手动触发，不受自动碎碎念开关限制
- **回到初始位置**
- **显示位置** —— 仅桌面 / 两者 / 都不显示（改 `display` 字段）
- **重载配置** —— 改完配置文件后重新加载，窗口按最新配置重建

---

## 配置

配置文件位置（沿用 `$DSH_HOME`，默认 `~/.dsh`，便于从插件版迁移）：

```
~/.dsh/dsh-pet/
├─ main-config.jsonc          ← 用户配置（覆盖包内默认）
├─ main-animation/webm/*.webm ← 主宠物素材
├─ memes/                     ← 表情包
├─ electron-profile/          ← 独立版的 Chromium profile（与插件版隔离）
├─ ai-settings.json           ← 本机 AI 配置（密钥私有权限写入）
└─ pet/                       ← 额外宠物种类（pet pack）
```

包内默认配置是 `dsh-pet/assets/config.jsonc`，格式与用户配置完全一致；用户配置里出现的字段**整体替换**默认值，没写的字段回落默认。

### 宠物实例字段

```jsonc
"pets": [
  {
    "id": "main",
    "size": 462,                  // 宽度 px（高度自动 = 宽度 × 9/16）
    "balanceEnabled": true,       // 是否触发余额动画（独立版无凭证，通常无效果）
    "display": "desktop",         // web / desktop / both / none —— 独立版只有 desktop 与 both 会显示
    "position": { "corner": "top-right", "marginX": 24, "marginY": 100 },
    "fixedEnabled": false,        // 固定：不自己漫游
    "whisperEnabled": true,       // 自动碎碎念（还需在设置页启用 AI）
    "workStatusEnabled": false    // 会话状态联动（独立版无事件，建议关闭）
  }
]
```

其余可自由编辑的高级字段：`animations`（动画池）、`animationWeights`（播放权重）、`eventsRefreshSec`（刷新周期）、`physics`（拖拽手感）等，结构见 `assets/config.jsonc`。

### 添加全新宠物种类（pet pack）

在 `~/.dsh/dsh-pet/pet/` 下放一对「配置 + 素材目录」：

```
pet/
├─ pig-config.json     ← 命名词干 = 种类名
└─ pig-animation/      ← 该种类的素材（webm）
```

规则：素材只查自己的目录（绝不落到主宠物素材）；`animations` / `animationWeights` 必须写全；配置非法会显式报错并跳过，不影响其它宠物。

---

## 本机 AI 设置

右键宠物 →「打开设置」，填写：

- **接口协议**：OpenAI 兼容 / Anthropic
- **接口地址**（Base URL，支持 `http://` 与 `https://`）
- **模型名称**、**API 密钥**（只写不读，留空保留旧值）
- **自动碎碎念开关与间隔**（默认关闭；开启会产生 API 费用）

设置页只监听 `127.0.0.1`，除静态资源外的所有请求都要带本次运行的令牌（`X-DSH-Pet-Token`）。密钥以私有权限写入 `~/.dsh/dsh-pet/ai-settings.json`，日志与接口响应都不会回显它。

---

## 开发

```sh
npm install
npm run build         # tsdown → lib/ + 桌面共享核心
npm run typecheck     # tsc --noEmit + 测试项目
npm test              # node:test（900+ 断言）
npm run lint
npm run format
```

目录结构：

```
src/host/         宿主半侧：路由表、配置聚合、状态仓、Electron Helper 守护与 bridge 管道
src/standalone/   独立版外壳：本地 HTTP 服务、命令行、本机 AI、设置页、运行时状态文件
src/shared/       两端共用的纯逻辑（构建成 runtime/electron-helper/shared-core.js）
src/compat/       原先由宿主提供的三个模块的等价实现（home-paths / credentials / llm）
runtime/electron-helper/  透明置顶窗（Electron 主进程 + preload + 渲染端，手写 JS）
scripts/          构建、打包、素材处理流水线
```

产物：

- `lib/main.js` —— 可执行入口（`bin: dsh-pet`）
- `lib/index.js` —— 宿主半侧的库入口（供嵌入方按库引用）
- `runtime/electron-helper/shared-core.js` —— 桌面共享核心（`window.PetShared`）

---

## 排障

| 现象 | 处理 |
| --- | --- |
| 首次启动卡在「下载 Electron」 | 默认用 npmmirror 镜像；可设 `DSH_PET_ELECTRON_MIRROR`、`DSH_PET_ELECTRON_VERSION`，或直接用 `DSH_PET_ELECTRON_PATH` 指定现成 electron.exe |
| 桌宠反复消失、日志出现 `GPU process isn't usable. Goodbye.` | 受限环境（虚拟化 / 远程桌面 / 沙箱）里 GPU 子进程会启动即崩。默认已用 `in-process-gpu` 规避；必要时设 `DSH_PET_GPU=software` 或 `DSH_PET_GPU=auto` |
| 同时装了插件版，两者互相干扰 | 独立版使用自己的 Chromium profile（`~/.dsh/dsh-pet/electron-profile`），不会再抢 `%APPDATA%\dsh-pet-electron-helper` 的锁 |
| 看不到宠物 | `node lib/main.js --check` 看 `display` 是否为 `desktop`/`both`，以及当前是否有图形显示环境 |
| 双击没反应 / 提示「已经在运行」 | 单实例保护：先从桌面托盘「退出桌宠」，或用任务管理器结束 `node.exe` / `electron.exe`；确实要多开用 `--multi` |
| 静默启动后想排查 | 看 `~/.dsh/dsh-pet/standalone.log`；或改用 `启动桌宠.cmd` / `npm start` 前台运行 |
| 端口被占用 | 默认 3080 起自动向后顺延 25 个端口，也可 `--port` 指定 |

---

## 素材生成链（可选）

仓库保留了完整的「从零生成自己的宠物」流水线：

```
① 提示词（prompts/） → ② 素材生成链（scripts/*.py、video/） → ③ 运行中的桌宠
```

- `scripts/watermark_step01.py` → `chroma_step02.py` → `encode_preview_gifs.py` 等：源视频绿幕抠像 → 透明 webm
- `scripts/encode_hevc_alpha.sh` + `hevc_alpha_encoder.swift`：Safari / HEVC 兼容变体（`.github/workflows/hevc-alpha.yml`），fork 后自行启用
- `prompts/` 里的提示词用于生成动作素材

随包默认只发 webm（VP9-alpha），Chromium 系与 Electron 桌面窗共用同一份格式。

---

## 从插件版改造的清单

| 项 | 处理 |
| --- | --- |
| `cordis.patch.yml`（配置树挂载声明） | 删除 |
| `package.json` 的 `dsh` 字段（bundle / compatibility / client.inject） | 删除 |
| `@deepseek-ai/*` peerDependencies | 删除，改为 `src/compat/` 三个本地等价实现 |
| 浏览器半侧（`src/client/`，React overlay + DSH 插槽/资源注入） | 删除；界面全部由 Electron 透明窗与设置页承担 |
| `exports["./client"]`、DSH 模块加载器 `window.__ModuleLoader__` | 删除 |
| 构建期 alias 换 shim | 改为源码内直接 import（`src/compat/`） |
| 「打开网站 / 打开软件」双形态菜单 | 统一为「打开设置」，删除 `dsh://open` 分支 |
| `openapi.yaml` / `API.md` / `CORDIS.md` / `tools/cordis-probe` | 删除 |
| 发布门禁脚本（prepack-check / gen-types / check-openapi） | 删除；`files` 白名单由 `scripts/prepare.js` 收敛 |
| 无退出入口（原形态靠关掉宿主应用） | 新增托盘「退出桌宠」：helper 以约定退出码 88 退出，宿主停止守护并整体收尾 |
| 必须留一个终端窗口 | 新增 `启动桌宠.vbs` / `静默启动.vbs`（无控制台）、日志落盘 `standalone.log`、单实例保护、`--multi` 覆盖 |
| 与插件版共用 Chromium profile | 改为独立 `electron-profile`，并默认 `in-process-gpu` 规避 GPU 崩溃 |

保留不变：路由表、配置聚合、状态仓、动画/物理/菜单的共享纯逻辑、Electron 透明窗、bridge 管道、测试与素材流水线。

---

## 许可与归属

- 原始作品：**dsh-pet**，作者 **[PC2005-cloud](https://github.com/PC2005-cloud)**，MIT 许可
  （https://github.com/PC2005-cloud/dsh-pet）
- 本仓库：非官方独立版改造，维护者 studentWu666，同样以 MIT 发布
- 原始版权行 `Copyright (c) 2026 PC2005-cloud` 在 [LICENSE](LICENSE) 中原样保留；
  完整归属说明与改动清单见 [NOTICE](NOTICE)

再分发时请同时保留 LICENSE 的原始版权行与 NOTICE 的归属说明。
