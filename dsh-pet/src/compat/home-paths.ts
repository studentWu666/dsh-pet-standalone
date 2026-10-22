/**
 * 主目录解析（原 `@deepseek-ai/dsh-home-paths` 的等价实现）。
 *
 * 独立版没有宿主提供这个包，因此直接复用本项目已有的同口径实现 `dshHomeDir()`
 * （host/helper-process.ts）—— 口径 = `process.env.DSH_HOME || <USERPROFILE|HOME>/.dsh`。
 *
 * 保留 DSH_HOME 环境变量只是沿用既有的用户配置位置，便于从旧版迁移；
 * 独立版不依赖任何 DeepSeek Harness 运行时。
 */
export { dshHomeDir as resolveAppHome } from '../host/helper-process';
