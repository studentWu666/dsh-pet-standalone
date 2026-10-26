import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { writePrivateJson } from './ai-storage';

interface RuntimeDetails {
  port: number;
  token: string;
  settingsUrl: string;
  pluginRoot: string;
}

/** 只给本机启动器的能力文件；HTTP health 不得包含其 token/settingsUrl。 */
export function writeStandaloneRuntime(home: string, details: RuntimeDetails): () => void {
  const directory = join(home, 'dsh-pet');
  mkdirSync(directory, { recursive: true });
  const file = join(directory, 'standalone-runtime.json');
  try {
    writePrivateJson(file, {
      name: 'dsh-pet-standalone',
      pid: process.pid,
      startedAt: new Date().toISOString(),
      ...details,
    });
  } catch (error) {
    throw new Error('无法安全写入桌宠运行状态，请检查数据目录的访问权限。', { cause: error });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      const current = JSON.parse(readFileSync(file, 'utf8')) as { pid?: number; token?: string };
      if (current.pid === process.pid && current.token === details.token) unlinkSync(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new Error('清理桌宠运行状态失败；请检查数据目录，未删除其他进程的状态。', { cause: error });
    }
  };
}

/**
 * 上一次运行留下的 pid（文件不存在 / 内容损坏 / pid 非法时返回 undefined）。
 *
 * 用途：单实例保护。静默启动（托盘 / vbs）没有终端可提示，用户重复双击很容易开出第二个实例
 * —— 两个宿主、两个托盘图标、两份宠物，互相抢端口。启动时读它并确认进程还活着即可判断。
 */
export function readRuntimePid(home: string): number | undefined {
  try {
    const parsed = JSON.parse(readFileSync(join(home, 'dsh-pet', 'standalone-runtime.json'), 'utf8')) as {
      pid?: unknown;
    };
    return typeof parsed.pid === 'number' && Number.isInteger(parsed.pid) && parsed.pid > 0 ? parsed.pid : undefined;
  } catch {
    return undefined;
  }
}

/** 已有实例的回环握手信息（端口 + 本次运行的令牌） */
export interface RuntimeHandshake {
  pid: number;
  port: number;
  token: string;
}

/**
 * 读上一次运行留下的端口与令牌，用于「把已有实例叫醒」（见 standalone/wake.ts）。
 * 任一字段缺失/非法即返回 undefined —— 老版本写的文件可能没有这些字段，不能因此崩启动器。
 */
export function readRuntimeHandshake(home: string): RuntimeHandshake | undefined {
  try {
    const parsed = JSON.parse(readFileSync(join(home, 'dsh-pet', 'standalone-runtime.json'), 'utf8')) as {
      pid?: unknown;
      port?: unknown;
      token?: unknown;
    };
    const pid = parsed.pid;
    const port = parsed.port;
    const token = parsed.token;
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return undefined;
    if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) return undefined;
    if (typeof token !== 'string' || token.length === 0) return undefined;
    return { pid, port, token };
  } catch {
    return undefined;
  }
}
