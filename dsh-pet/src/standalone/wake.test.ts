/**
 * 「把已有实例叫醒」的行为契约。
 *
 * 这条链路的意义全在失败路径上：用户双击启动器时，真正发生的事是「另一个进程已经在跑」。
 * 如果这里静默失败，用户看到的就是「双击没反应」——所以每个分支（在跑但宠物已可见 /
 * 需要恢复 / 令牌不对 / 端口不应答）都必须有确定结果，且**绝不抛异常**把启动器带崩。
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ROUTE_PREFIX } from '../host/index.ts';
import { wakeRunningInstance } from './wake.ts';

const TOKEN = 'test-token-abc';

interface Recorded {
  /** 收到的 /pet-display 请求体（按顺序） */
  displays: Array<{ id: string; display: string }>;
}

/** 造一个只实现 config / pet-display 两个端点的假宿主 */
function startFakeHost(
  pets: Array<{ id: string; display: string }>,
  options: { token?: string; petDisplayStatus?: number } = {},
): Promise<{ port: number; recorded: Recorded; close: () => Promise<void> }> {
  const recorded: Recorded = { displays: [] };
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const authorized = req.headers['x-dsh-pet-token'] === (options.token ?? TOKEN);
    const json = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (!authorized) return json(403, { error: 'forbidden' });
    if (url.pathname === `${ROUTE_PREFIX}/config`) {
      // 成品聚合的形状：顶层是条目，宠物在各自的 pets 数组里
      return json(200, { main: { pets } });
    }
    if (url.pathname === `${ROUTE_PREFIX}/pet-display` && req.method === 'POST') {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        recorded.displays.push(JSON.parse(raw) as { id: string; display: string });
        json(options.petDisplayStatus ?? 200, { ok: (options.petDisplayStatus ?? 200) === 200 });
      });
      return;
    }
    json(404, { error: 'not-found' });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        port,
        recorded,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

describe('把已有实例叫醒：双击启动器 = 把收起的宠物放回桌面', () => {
  test('display=web 的宠物：改成 both（保留网页位），并报告已恢复', async () => {
    const host = await startFakeHost([{ id: 'main', display: 'web' }]);
    try {
      const result = await wakeRunningInstance(host.port, TOKEN);
      assert.equal(result.reachable, true);
      assert.deepEqual(result.restored, ['main']);
      assert.deepEqual(host.recorded.displays, [{ id: 'main', display: 'both' }]);
    } finally {
      await host.close();
    }
  });

  test('display=none 的宠物：改成 desktop（没有网页位可保留）', async () => {
    const host = await startFakeHost([{ id: 'main', display: 'none' }]);
    try {
      const result = await wakeRunningInstance(host.port, TOKEN);
      assert.deepEqual(result.restored, ['main']);
      assert.deepEqual(host.recorded.displays, [{ id: 'main', display: 'desktop' }]);
    } finally {
      await host.close();
    }
  });

  test('宠物本来就在桌面上：一个写请求都不发（重复双击必须幂等）', async () => {
    const host = await startFakeHost([
      { id: 'main', display: 'desktop' },
      { id: 'test1', display: 'both' },
    ]);
    try {
      const result = await wakeRunningInstance(host.port, TOKEN);
      assert.equal(result.reachable, true);
      assert.equal(result.alreadyVisible, true);
      assert.deepEqual(result.restored, []);
      assert.deepEqual(host.recorded.displays, [], '已可见时不得再写 display（会白重启一次 Helper）');
    } finally {
      await host.close();
    }
  });

  test('多只宠物里只改收起的那些', async () => {
    const host = await startFakeHost([
      { id: 'main', display: 'desktop' },
      { id: 'test1', display: 'none' },
    ]);
    try {
      const result = await wakeRunningInstance(host.port, TOKEN);
      assert.deepEqual(result.restored, ['test1']);
      assert.deepEqual(host.recorded.displays, [{ id: 'test1', display: 'desktop' }]);
    } finally {
      await host.close();
    }
  });

  test('令牌不对：reachable=false，且不写任何 display', async () => {
    const host = await startFakeHost([{ id: 'main', display: 'none' }], { token: 'another-token' });
    try {
      const result = await wakeRunningInstance(host.port, TOKEN);
      assert.equal(result.reachable, false);
      assert.deepEqual(host.recorded.displays, []);
    } finally {
      await host.close();
    }
  });

  test('端口没人应答：reachable=false，不抛（启动器必须能干净退出）', async () => {
    const host = await startFakeHost([{ id: 'main', display: 'none' }]);
    const { port } = host;
    await host.close();
    const result = await wakeRunningInstance(port, TOKEN);
    assert.equal(result.reachable, false);
    assert.deepEqual(result.restored, []);
  });

  test('写 display 被宿主拒绝：不谎报恢复成功', async () => {
    const host = await startFakeHost([{ id: 'main', display: 'none' }], { petDisplayStatus: 500 });
    try {
      const result = await wakeRunningInstance(host.port, TOKEN);
      assert.equal(result.reachable, true);
      assert.deepEqual(result.restored, [], '宿主 500 时不得把自己算成已恢复');
    } finally {
      await host.close();
    }
  });
});
