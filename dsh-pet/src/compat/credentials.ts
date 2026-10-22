/**
 * 凭证引用（原 `@deepseek-ai/dsh-credentials` 的等价实现）。
 *
 * 余额接口只需构造一个交给 `credentials.resolve()` 的引用；独立版没有凭证后端，
 * `resolve()` 恒返回 `undefined`，因此引用本身不需要任何结构，原样返回即可 ——
 * 余额路由会走到「未登记接口 / 缺凭证」的明确失败分支，而不是崩掉。
 */

/** 引用原样返回（独立版不解析系统凭证，只保证模块图可加载） */
export function credentialRef(ref: unknown): unknown {
  return ref;
}
