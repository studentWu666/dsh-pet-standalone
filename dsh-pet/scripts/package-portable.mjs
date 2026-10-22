#!/usr/bin/env node
/**
 * package-portable.mjs —— 打出一个「绿色版」目录：不依赖系统 Node、不依赖任何宿主应用。
 *
 * 产物结构（dist/portable/）：
 *   node.exe                 运行时（从当前 Node 复制，同平台同架构）
 *   启动桌宠.cmd              双击前台运行（能看到日志，便于排障）
 *   静默启动.vbs              双击后台运行（无控制台窗口，只有桌宠）
 *   lib/ runtime/ assets/ package.json node_modules/
 *
 * 为什么不需要 electron-builder：桌宠的界面进程（Electron）本来就由运行时按需下载到
 * 数据目录（默认 ~/.dsh/electron），主进程只是一份纯 Node 程序 —— 复制 node.exe 即可自包含。
 * Electron 运行时（约 100MB）首次启动时下载，或复用已有缓存。
 *
 * 用法：node scripts/package-portable.mjs
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'dist', 'portable');

/** 需要进绿色版的运行时资源（assets/preview 只在 README 展示动画，不入包） */
const ASSET_ENTRIES = ['webm', 'fonts', 'pic', 'memes', 'config.jsonc', 'logo.png'];

const log = (message) => console.log(`[portable] ${message}`);

/**
 * 递归复制目录。
 * 不用 `fs.cpSync`：在本仓库所在的含中文路径下它会异常终止整个进程（rc=127，无错误输出），
 * 逐文件复制稳定且没有这个坑。
 */
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else if (entry.isFile()) copyFileSync(source, target);
  }
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(path) : statSync(path).size;
  }
  return total;
}

if (!existsSync(join(ROOT, 'lib', 'main.js'))) {
  console.error('[portable] 缺少构建产物 lib/main.js，请先跑 npm run build');
  process.exit(1);
}

log('清理旧产物…');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

log('复制程序与资源…');
copyTree(join(ROOT, 'lib'), join(OUT, 'lib'));
copyTree(join(ROOT, 'runtime', 'electron-helper'), join(OUT, 'runtime', 'electron-helper'));
for (const entry of ASSET_ENTRIES) {
  const from = join(ROOT, 'assets', entry);
  if (!existsSync(from)) continue;
  const target = join(OUT, 'assets', entry);
  if (statSync(from).isDirectory()) copyTree(from, target);
  else {
    mkdirSync(join(OUT, 'assets'), { recursive: true });
    copyFileSync(from, target);
  }
}

// package.json 只保留运行时需要的字段：bin/scripts 在绿色版里没有意义
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
writeFileSync(
  join(OUT, 'package.json'),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      type: pkg.type,
      main: pkg.main,
      license: pkg.license,
      dependencies: pkg.dependencies,
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

log('复制 Node 运行时…');
copyFileSync(process.execPath, join(OUT, 'node.exe'));

log('复制生产依赖（不联网，按 npm 依赖树逐包复制）…');
const listed = spawnSync('npm ls --omit=dev --parseable --all', {
  cwd: ROOT,
  encoding: 'utf8',
  shell: true,
});
if (listed.status !== 0) {
  console.error('[portable] 解析生产依赖失败：', listed.stderr || listed.stdout);
  process.exit(1);
}
const packages = listed.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.includes('(empty)'));
let copied = 0;
for (const packagePath of packages) {
  const rel = relative(ROOT, packagePath);
  // 只搬 node_modules 里的包（含嵌套 node_modules），跳过仓库自身
  if (!rel.split(/[\\/]/).includes('node_modules')) continue;
  const target = join(OUT, rel);
  if (existsSync(target)) continue;
  copyTree(packagePath, target);
  copied += 1;
}
log(`已复制 ${copied} 个依赖包`);

writeFileSync(
  join(OUT, '启动桌宠.cmd'),
  [
    '@echo off',
    'chcp 65001 >nul',
    'cd /d "%~dp0"',
    '"%CD%\\node.exe" lib\\main.js %*',
    'if errorlevel 1 pause',
    '',
  ].join('\r\n'),
  'utf8',
);
writeFileSync(
  join(OUT, '静默启动.vbs'),
  [
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'Set shell = CreateObject("WScript.Shell")',
    'base = fso.GetParentFolderName(WScript.ScriptFullName)',
    'shell.CurrentDirectory = base',
    'shell.Run """" & base & "\\node.exe"" lib\\main.js", 0, False',
    '',
  ].join('\r\n'),
  'utf8',
);

log(`完成：${OUT}`);
log(`体积：${(dirSize(OUT) / 1024 / 1024).toFixed(1)} MB（Electron 运行时首次启动时下载到数据目录）`);
