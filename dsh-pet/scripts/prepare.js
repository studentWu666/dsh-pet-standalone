#!/usr/bin/env node
/**
 * prepare.js —— 构建完整产物（独立版）
 *
 * 做什么：
 *   1. `npm run bundle`             —— tsdown 把 src → lib（main.js / index.js）
 *   2. `npm run build:desktop-core` —— src/shared → runtime/electron-helper/shared-core.js
 *      （经典 script，全局 window.PetShared；桌面小窗与宿主共用同一份纯逻辑源码）
 *   3. 收敛 package.json 的 files 白名单（幂等：跑一次即定格，再跑结果不变）
 *
 * 素材说明：随包只发 webm（VP9-alpha）。Safari/HEVC(mov) 兼容由仓库保留的流水线
 * （scripts/encode_hevc_alpha.sh + hevc_alpha_encoder.swift + .github/workflows/hevc-alpha.yml）
 * 支持，fork 后自行启用，不参与默认发布流程。
 *
 * 用法：node scripts/prepare.js（npm run build）
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PKG = join(ROOT, 'package.json');

/** 跑一条 npm 脚本；Windows 下 npm 是 npm.cmd，spawnSync 不能直接执行 .cmd，用 shell 兜一层 */
function npmScript(name, label) {
  console.log(`[prepare] ${label}...`);
  const command = process.platform === 'win32' ? `cmd /c npm run ${name}` : `npm run ${name}`;
  const result = spawnSync(command, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`[prepare] ${label} 失败 (exit ${result.status})`);
    process.exit(1);
  }
}

npmScript('bundle', '构建 lib（tsdown）');
npmScript('build:desktop-core', '构建桌面共享核心（window.PetShared）');

// files 白名单：本步骤每次都会覆盖 package.json 的 files，
// 所以"只在 package.json 里加一行"是无效的，必须改这里。
const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
const keep = [
  'lib',
  'runtime/electron-helper',
  'assets/webm',
  'assets/fonts',
  'assets/pic',
  // 表情包：host 只从包内 assets/memes 读图、与配置的 memes 键配对，漏掉则配图功能整体失效
  'assets/memes',
  'assets/config.jsonc',
  'assets/logo.png',
  'scripts/ensure-electron.mjs',
];
writeFileSync(PKG, JSON.stringify({ ...pkg, files: keep }, null, 2) + '\n', 'utf8');
console.log(`[prepare] ✓ package.json files=[${keep.join(', ')}]`);
console.log('[prepare] 完成：npm start（或 node lib/main.js）启动桌宠');
