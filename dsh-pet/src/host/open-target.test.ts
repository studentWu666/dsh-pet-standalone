/**
 * 「打开设置」工具项的契约测试（独立版：只有一条路径 —— 系统默认浏览器打开本机设置页）。
 *
 * 链路（改名/改判据只改一侧即失败）：
 *   宿主 index.ts 经 `ctx.connection.authenticatedUrl(origin)` 生成带令牌的设置页 URL
 *   → 注入 helper 的 DSH_PET_SITE_URL → main.js 的 openSite() 用 shell.openExternal 打开
 *   → 渲染端菜单项的 action 恒为 open-site（另一端只认这个动作名），文案为「打开设置」。
 *
 * 与插件形态的差别：不再有 `dsh://open` 唤醒宿主应用的分支，也没有 OPEN_TARGET 形态注入 ——
 * 独立版没有宿主应用可唤起。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 包内文件源码（守卫用；相对 src/host/ 解析） */
const readSource = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const host = readSource('./index.ts');
const main = readSource('../../runtime/electron-helper/main.js');
const sprite = readSource('../../runtime/electron-helper/sprite.js');
const constants = readSource('../../runtime/electron-helper/constants.js');

describe('「打开设置」只有一条路径：系统浏览器打开带令牌的本机设置页', () => {
  test('宿主：注入已鉴权的设置页 URL', () => {
    assert.ok(
      /DSH_PET_SITE_URL: siteUrl/.test(host),
      'launchHelper 必须把已鉴权的设置页 URL 注入 helper（否则浏览器打开会因缺令牌被拒）',
    );
    assert.ok(
      /ctx\.connection\.authenticatedUrl\(origin\)/.test(host),
      'URL 必须由 authenticatedUrl 生成（令牌只经子进程环境变量传递，不落盘、不进日志）',
    );
  });

  test('helper 主进程：pet:open-site 直接走 openSite', () => {
    assert.ok(
      /ipcMain\.on\('pet:open-site'[\s\S]*?openSite\(url\)/.test(main),
      '打开设置必须调用 openSite（系统默认浏览器），不得新建窗口',
    );
    assert.ok(
      /const openSite = \(url\) => \{[\s\S]*?shell\.openExternal\(target\)/.test(main),
      'openSite 必须用 shell.openExternal 打开',
    );
    assert.ok(!/dsh:\/\/open/.test(main), '独立版不得残留唤起宿主应用的 dsh:// 协议调用');
    assert.ok(!/DSH_PET_OPEN_TARGET/.test(main), '独立版不得残留宿主形态注入的读取');
  });

  test('渲染端：菜单文案为「打开设置」，动作名不变', () => {
    assert.ok(
      /label: '打开设置',\s*action: 'open-site'/.test(sprite),
      '菜单文案必须是「打开设置」，但 action 仍是 open-site',
    );
    assert.ok(!/OPEN_TARGET/.test(sprite), '渲染端不得残留 OPEN_TARGET 分支（独立版只有一种形态）');
    assert.ok(!/OPEN_TARGET/.test(constants), 'constants.js 不得再维护形态常量');
  });
});
