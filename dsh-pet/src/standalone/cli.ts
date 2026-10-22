#!/usr/bin/env node
/**
 * dsh-pet 独立版入口 —— 不需要任何宿主应用，直接养桌宠。
 *
 * 它把三件事串起来（每一步都复用项目自己的实现，没有第二份业务逻辑）：
 *   1. `./context` 造一个本地上下文，把宿主半侧（`src/host/index.ts` 的 `apply`）跑起来；
 *   2. `./server` 起一个 `node:http` 服务，把 `apply` 注册的 prefix handler 接上去
 *      （路由表仍然只有宿主那一份）；
 *   3. 宿主半侧的 `launchHelper` 探测 Electron、按配置拉起透明置顶小窗，
 *      并与宿主经 bridge 管道通信。
 *
 * 用法：
 *   npm start                       # 仓库里跑（先 npm run build）
 *   node lib/main.js --port 3081
 *   node lib/main.js --check        # 只体检，不开窗口
 *   npx dsh-pet-standalone          # 装好后直接跑（package.json 的 bin）
 *
 * 能力边界：动画、物理拖拽、右键菜单、多开、自定义素材与宠物种类全部可用；
 * 碎碎念与对话需要在本机设置页配置自己的大模型 API；余额查询需要宿主侧凭证，独立版不可用
 * （结构化失败 + 日志，不假装成功）。
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { flattenPetList, readAllConfig } from '../host/config';
import { dshHomeDir, packageRoot } from '../host/helper-process';
import { apply } from '../host/index';
import { runCheck, packageVersion } from './check';
import { createStandaloneAi } from './ai-provider';
import { createRequestSecurity } from './request-security';
import { writeStandaloneRuntime, readRuntimePid } from './runtime-state';
import {
  createStandaloneContext,
  createStandaloneLogger,
  type RegisteredRoute,
  type StandaloneLogger,
} from './context';
import { configPathsFor, describePets, isDesktopVisible, parseArgs, USAGE } from './options';
import { listenStandaloneServer } from './server';

/** 该 pid 的进程是否还活着（EPERM 表示存在但无权限查询，同样算活着） */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** 启动独立模式：先起服务拿到端口，再 `apply`（宿主据此拼桌面 Helper 的 configUrl） */
async function run(logger: StandaloneLogger, options: { port: number; multi: boolean }): Promise<void> {
  const home = dshHomeDir();
  const paths = configPathsFor(packageRoot, home);

  // 预检：包内默认配置读不到时宿主半边必然每请求失败；早给可操作的诊断，别让用户对着空桌面猜
  if (!existsSync(paths.defaultFile)) {
    logger.error(
      `包内默认配置缺失：${paths.defaultFile}。若你是在直接跑源码（包根被解析成了 src/），` +
        '请改用构建产物：npm run build 后 npm start（或 node lib/main.js）。',
    );
    process.exitCode = 1;
    return;
  }

  // 单实例保护：静默启动没有终端可提示，重复双击会开出第二个实例（两个托盘、两份宠物、抢端口）。
  // 上一次的 pid 还活着 → 直接说明并退出。
  if (!options.multi) {
    const running = readRuntimePid(home);
    if (running !== undefined && running !== process.pid && processAlive(running)) {
      logger.error(
        `桌宠已经在运行（pid ${running}）。要重新启动，请先从桌面托盘选择「退出桌宠」；` +
          '确实要同时开多份，请加 --multi。',
      );
      process.exitCode = 1;
      return;
    }
  }

  const routes: RegisteredRoute[] = [];
  const portRef = { value: options.port };
  const ai = createStandaloneAi(home, logger);
  const security = createRequestSecurity();
  const context = createStandaloneContext({
    port: () => portRef.value,
    logger,
    routes,
    ai,
    authenticatedUrl: security.authenticatedUrl,
    // 托盘「退出桌宠」→ HelperProcess 收到约定退出码 → 这里整体收尾。
    // 走转发器是因为 requestShutdown 要等 shutdown 定义之后才存在，而 ctx 在这里就要建好。
    onQuit: () => forwardShutdown(),
  });
  // /shutdown 的回调要在服务构造时给出去，而停机函数要在服务之后定义：
  // 用一个可替换的转发器解耦（服务构造时只拿到"将来会是谁"）。
  let forwardShutdown: () => void = () => {};
  const server = await listenStandaloneServer({
    routes,
    logger,
    port: options.port,
    security,
    ai,
    status: () => ({
      name: 'dsh-pet-standalone',
      pid: process.pid,
      pluginRoot: packageRoot,
      plugin: { root: packageRoot, version: packageVersion(packageRoot) },
      port: portRef.value,
      uptimeSec: Math.round(process.uptime()),
    }),
    onShutdown: () => forwardShutdown(),
  });
  portRef.value = server.port;
  let releaseRuntime: () => void;
  try {
    releaseRuntime = writeStandaloneRuntime(home, {
      port: server.port,
      token: security.token,
      settingsUrl: security.authenticatedUrl(`http://127.0.0.1:${server.port}`),
      pluginRoot: packageRoot,
    });
  } catch (error) {
    await context.dispose();
    await server.close();
    throw error;
  }

  let shuttingDown = false;
  const shutdown = async (reason: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`收尾（${reason}）…`);
    // 先释放插件注册的 effect（停桌面 Helper、清周期定时器），再关服务
    try {
      await context.dispose();
    } finally {
      await server.close();
      releaseRuntime();
    }
    logger.info('已退出。');
  };
  const requestShutdown = (reason: string): void => {
    shutdown(reason)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error(`收尾失败：${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      });
  };
  forwardShutdown = () => requestShutdown('POST /shutdown');
  process.on('SIGINT', () => requestShutdown('SIGINT'));
  process.on('SIGTERM', () => requestShutdown('SIGTERM'));

  // 起插件宿主半边：路由表、状态仓、桌面 Helper（含 bridge 管道）都在这一句里
  apply(context.ctx);

  let pets: Record<string, unknown>[] = [];
  let configSource = paths.userFile;
  try {
    pets = flattenPetList(readAllConfig(paths));
    if (!existsSync(paths.userFile)) configSource = `${paths.userFile}（不存在 → 用包内默认）`;
  } catch (error) {
    logger.warn(
      `读配置失败（服务照常运行，相关端点会显式报错）：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const desktopVisible = pets.filter(isDesktopVisible);
  for (const line of [
    '',
    '===== 桌面宠物 dsh-pet =====',
    `  版本        dsh-pet@${packageVersion(packageRoot)}  ${packageRoot}`,
    `  路由        http://127.0.0.1:${server.port}/dsh-pet-7340/`,
    `  配置        ${configSource}`,
    `  宠物        ${describePets(pets)}`,
    desktopVisible.length === 0
      ? '  桌面小窗    0 只：display 需要 desktop 或 both 才会出现透明小窗（服务仍在运行）'
      : `  桌面小窗    ${desktopVisible.length} 只`,
    ai.isReady()
      ? '  AI          本机 API 已启用；自动碎碎念遵循设置页开关'
      : '  AI          未配置或未启用，不发送模型请求；右键“打开设置”后在本机填写',
    '  设置页      右键宠物 →「打开设置」（自带本次运行令牌）',
    '  余额        需要宿主凭证，独立版不可用（会明确提示）',
    '  退出        托盘图标 →「退出桌宠」；或 Ctrl+C；或 POST /shutdown',
    '  日志        与本横幅同一份，另存于数据目录的 dsh-pet/standalone.log',
    '',
  ]) {
    logger.info(line);
  }
  if (context.failures.length > 0) {
    logger.warn(`初始化期间有 ${context.failures.length} 项失败（见上方日志）；路由仍可用，相关端点会显式报错`);
  }
}

/** CLI 入口 */
async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if ('error' in parsed) {
    console.error(`dsh-pet-standalone: ${parsed.error}\n`);
    console.error(USAGE);
    return 2;
  }
  const { options } = parsed;
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  const logger = createStandaloneLogger(join(dshHomeDir(), 'dsh-pet', 'standalone.log'));
  if (options.check) return runCheck(logger);
  await run(logger, options);
  return 0;
}

// 本文件就是可执行入口（package.json 的 bin 指向构建产物 lib/standalone.js），
// 因此无条件启动：不做 import.meta.main / argv[1] 比较之类的守卫 ——
// import.meta.main 要 Node 24+，而 argv[1] 比较在 pnpm 的 bin 符号链接下会判错。
main()
  .then((code) => {
    if (code !== 0) process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(`dsh-pet-standalone: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    process.exit(1);
  });
