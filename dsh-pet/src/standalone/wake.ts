/**
 * 把「已经跑着的那个实例」叫醒。
 *
 * 场景：用户双击启动器时，上一个实例还在（单实例保护会拦下新进程）。原先的做法是
 * 打一行日志就退出 —— 静默启动（vbs / 托盘）没有控制台，用户看到的就是「双击没反应」；
 * 如果他先前从托盘把宠物收起来了，托盘图标还可能在 Windows 的隐藏图标区里，于是直觉就是
 * 「坏了，桌宠打不开了」。
 *
 * 这里的取舍：**双击 = 我要看到桌宠**。因此不改「再开一个实例」这条路，而是回头请求
 * 已有实例把收起的宠物放回桌面（`display` 从 web/none 改回含 desktop）。它本来就在桌面上时
 * 什么也不做（幂等），所以重复双击永远不会叠出第二只。
 *
 * 只走 127.0.0.1 + 那次运行的令牌（运行状态文件里），不引入任何新的攻击面：
 * 令牌本来就等价于本机登录态，只写在本机数据目录、只用于本机回环。
 */
import { ROUTE_PREFIX } from '../host/index';

/** 请求已有实例的超时：启动器不能被一个卡住的旧进程拖住 */
const WAKE_TIMEOUT_MS = 3000;

/** 已有实例的宠物（只保留叫醒所需的两个字段） */
export interface RunningPet {
  id: string;
  display: string;
}

/** 叫醒结果：`restored` 为空表示「本来就在桌面上，无需动作」 */
export interface WakeResult {
  /** 是否成功与已有实例完成了一次对话 */
  reachable: boolean;
  /** 被放回桌面的宠物 id */
  restored: string[];
  /** 读配置/写显示都成功，但没有任何宠物需要恢复 */
  alreadyVisible: boolean;
}

/** 从成品聚合（{ <条目>: <整份文档> }）里拍平出宠物列表 —— 形状与宿主的 flattenPetList 一致 */
function petsOf(merged: unknown): RunningPet[] {
  if (merged === null || typeof merged !== 'object') return [];
  const pets: RunningPet[] = [];
  for (const entry of Object.values(merged as Record<string, unknown>)) {
    if (entry === null || typeof entry !== 'object') continue;
    const list = (entry as { pets?: unknown }).pets;
    if (!Array.isArray(list)) continue;
    for (const pet of list) {
      if (pet === null || typeof pet !== 'object') continue;
      const id = String((pet as { id?: unknown }).id ?? '').trim();
      if (!id) continue;
      pets.push({ id, display: String((pet as { display?: unknown }).display ?? '') });
    }
  }
  return pets;
}

/** 起点是 web 时保留网页位（→ both），否则一律 desktop（none → desktop） */
const displayAfterWake = (display: string): string => (display === 'web' ? 'both' : 'desktop');

const endpoint = (port: number, path: string): string => `http://127.0.0.1:${port}${ROUTE_PREFIX}/${path}`;

/**
 * 请求已有实例把收起的宠物放回桌面。
 *
 * 任何一步失败都只是 `reachable: false`（调用方照旧打日志），绝不抛：
 * 启动器在「已有实例「忙/半死/万一是别的程序占了端口」」时也必须能干净退出。
 */
export async function wakeRunningInstance(port: number, token: string, signal?: AbortSignal): Promise<WakeResult> {
  const headers = { 'x-dsh-pet-token': token };
  const timeout = (): AbortSignal => {
    const own = AbortSignal.timeout(WAKE_TIMEOUT_MS);
    return signal ? AbortSignal.any([signal, own]) : own;
  };

  let pets: RunningPet[];
  try {
    const response = await fetch(endpoint(port, 'config'), { headers, signal: timeout() });
    if (!response.ok) return { reachable: false, restored: [], alreadyVisible: false };
    pets = petsOf(await response.json());
  } catch {
    return { reachable: false, restored: [], alreadyVisible: false };
  }

  const hidden = pets.filter((pet) => pet.display !== 'desktop' && pet.display !== 'both');
  if (hidden.length === 0) return { reachable: true, restored: [], alreadyVisible: true };

  const restored: string[] = [];
  for (const pet of hidden) {
    try {
      const response = await fetch(endpoint(port, 'pet-display'), {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ id: pet.id, display: displayAfterWake(pet.display) }),
        signal: timeout(),
      });
      if (response.ok) restored.push(pet.id);
    } catch {
      // 单只失败不影响其它宠物：调用方据 restored 说明结果
    }
  }
  return { reachable: true, restored, alreadyVisible: false };
}
