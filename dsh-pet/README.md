# dsh-pet（独立版）

> 原作者 **[PC2005-cloud](https://github.com/PC2005-cloud)** · 原始项目
> [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（MIT）
> 本项目是它的非官方独立版改造：桌宠本体（素材、渲染、物理、配置、素材流水线）均来自原作者，
> 改动仅限"去掉插件形态与宿主依赖"。归属与改动清单见 [../NOTICE](../NOTICE)。

桌面宠物本体。不依赖任何编辑器、IDE 或宿主应用：`npm start` 或绿色版双击后，桌面右上角出现一只透明置顶的大肥鱼。

完整文档（配置字段、pet pack、AI 设置、排障、素材流水线）见 [仓库根 README](../README.md)。

## 三条启动路径

```sh
# ① 从源码（前台，能看日志）
npm install && npm run build && npm start

# ② 静默启动（日常用这个：双击即可，不留终端窗口）
#    项目根目录的 启动桌宠.vbs

# ③ 绿色版（自带 node.exe，拷走即用）
npm run package:portable        # 产物在 dist/portable/，双击「静默启动.vbs」

# ④ 只体检，不建窗口
node lib/main.js --check
```

退出：桌面托盘图标 →「退出桌宠」（桌宠、托盘与后台服务一起收尾）。
重复双击会被单实例保护拦下；确实要多开用 `--multi`。
日志：`~/.dsh/dsh-pet/standalone.log`（静默运行时唯一的日志出口）。

## 这个目录里有什么

```
lib/                      构建产物：main.js（可执行入口）、index.js（库入口）
src/host/                 宿主半侧：路由表、配置聚合、状态仓、Helper 守护、bridge 管道
src/standalone/           独立版外壳：本地 HTTP 服务、CLI、本机 AI、设置页
src/shared/               两端共用纯逻辑（构建为 runtime/electron-helper/shared-core.js）
src/compat/               原先由宿主提供的模块的等价实现（home-paths / credentials / llm）
runtime/electron-helper/  透明置顶窗（Electron 主进程 + preload + 渲染端）
assets/                   config.jsonc、webm 动画、表情包、字体
scripts/                  构建（prepare）、打包（package-portable）、Electron 下载（ensure-electron）
```

## 能力边界

- 可用：动画链、点击/拖拽/甩抛、右键菜单、多开、自定义素材与宠物种类、本机 AI 碎碎念与对话。
- 不可用：余额（需宿主凭证）、会话工作状态、系统通知 —— 都会返回带 `reason` 的明确失败。

## 两个容易踩的坑

1. **GPU 进程崩溃**：受限环境（虚拟化 / 远程桌面 / 沙箱）里 Chromium 的 GPU 子进程会启动即崩，日志出现
   `GPU process isn't usable. Goodbye.`，桌宠反复消失。默认已用 `in-process-gpu` 规避；
   可设 `DSH_PET_GPU=software` 或 `DSH_PET_GPU=auto` 切换策略。
2. **与插件版并存**：独立版使用 `~/.dsh/dsh-pet/electron-profile` 作为自己的 Chromium profile，
   不会与已安装的插件版抢 `%APPDATA%\dsh-pet-electron-helper` 的 profile 锁。

## 许可

MIT，见 [LICENSE](LICENSE)。
