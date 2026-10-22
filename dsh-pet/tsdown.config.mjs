// tsdown 配置（src → lib）
//
// 独立版只有两份产物，都是纯 Node ESM：
//   1) main  —— `src/standalone/cli.ts` 编译为 `lib/main.js`：可执行入口（package.json 的 bin / start）。
//      它自己起本地 HTTP 服务、跑宿主半侧（`apply`）、拉起 Electron 透明小窗。
//   2) index —— `src/host/index.ts` 编译为 `lib/index.js`：宿主半侧（路由表 + 状态仓 + Helper 守护），
//      供需要嵌入本项目的调用方按库引用。
//
// 与插件形态的差别：没有浏览器半侧产物，也不需要把任何模块外部化给宿主 ——
// 原先三个 `@deepseek-ai/*` 包已由 `src/compat/*` 提供同口径实现，因此这里没有 alias。
import { defineConfig } from 'tsdown';

const shared = {
  format: ['esm'],
  platform: 'node',
  // 只支持 Node ≥ 22.12（package.json 的 engines 已声明），目标可以用 es2022：
  // es2020 会把 class field 一类语法降级成 `_defineProperty(...)`，进而把 `@oxc-project/runtime`
  // 拖成一条裸 import —— 那个包不在本包依赖里，跑起来会 ERR_MODULE_NOT_FOUND。
  target: 'es2022',
  dts: false,
  outDir: 'lib',
  clean: false,
  external: [/^@electron\//, /^node:/],
};

export default defineConfig([
  {
    ...shared,
    entry: { main: 'src/standalone/cli.ts' },
  },
  {
    ...shared,
    entry: { index: 'src/host/index.ts' },
  },
]);
