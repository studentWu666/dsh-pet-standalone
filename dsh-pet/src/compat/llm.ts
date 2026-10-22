/**
 * LLM 消息工厂与流式文本拼装（原 `@deepseek-ai/dsh-llm` 的等价实现）。
 *
 * `host/whisper.ts` 与 `host/chat.ts` 静态 import 了这四个名字：`BlockAssembler`、
 * `createUserMessage`、`createAssistantMessage`、`ReasoningEffortId`。
 * 独立版把它们收敛到本地纯函数实现（零网络、零宿主），模块图因此可以在没有
 * DeepSeek Harness 的环境里加载。
 *
 * 形状必须与调用方的用法严格一致：
 *   - `BlockAssembler.push(chunk)` 收集流式块，`blocks()` 返回文本块数组
 *     （调用方一律 `blocks().filter(b => b.type === 'text')`）
 *   - 两个消息工厂只负责包一层 `{ role, content, source }`
 *   - `ReasoningEffortId` 是"传什么就是什么"的标识工厂
 */

/** 消息的最小形状（角色、内容与来源标记；适配器回放不在独立版范围内） */
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: unknown;
  source: unknown;
}

/** 用户消息 */
export function createUserMessage(input: { content: unknown; source: unknown }): LlmMessage {
  return { role: 'user', content: input.content, source: input.source };
}

/** 助手消息（对话历史回放用） */
export function createAssistantMessage(input: { content: unknown; source: unknown }): LlmMessage {
  return { role: 'assistant', content: input.content, source: input.source };
}

/** 文本块（`BlockAssembler.blocks()` 的元素形状） */
export interface LlmTextBlock {
  type: 'text';
  text: string;
}

/** 流终止原因（调用方 `noTextReason(assembler.finish)` 读取它解释"为什么没有正文"） */
export interface LlmFinish {
  kind: 'stop' | 'max-tokens' | 'aborted' | 'error';
  failure?: { message?: string; code?: string };
}

/**
 * 流式文本拼装。
 *
 * 兼容两种块形状：
 *   - `{ type: 'text-delta', index, text }` —— 宿主契约形状（`host/whisper.ts`、`host/chat.ts`
 *     的测试与真实调用方都按它断言）
 *   - `{ type: 'text', text }`             —— 独立版本机模型通道（`standalone/ai-provider.ts`）的产出
 *
 * 终止块为 `{ type: 'finish', reason: { kind, failure } }`（reason 允许写成 finish，
 * 早期版本用过这个字段名）。
 */
export class BlockAssembler {
  private readonly chunks: string[] = [];

  /**
   * 终止原因。独立版的模型通道（standalone/ai-provider.ts）只产出文本块，
   * 结束时直接结束迭代、不补终止块，因此这里通常保持 `undefined` —— 调用方的
   * `noTextReason` 会把"无正文且无终止块"解释成「模型未返回文本」。
   */
  finish: LlmFinish | undefined;

  /** 收集一个块；非文本块（工具调用等）被忽略 */
  push(chunk: unknown): void {
    if (chunk === null || typeof chunk !== 'object') return;
    const record = chunk as { type?: unknown; text?: unknown; reason?: unknown; finish?: unknown };
    if ((record.type === 'text' || record.type === 'text-delta') && typeof record.text === 'string') {
      this.chunks.push(record.text);
      return;
    }
    if (record.type === 'finish') {
      const reason = record.reason ?? record.finish;
      if (reason !== null && typeof reason === 'object') this.finish = reason as LlmFinish;
    }
  }

  /** 当前已拼装的块列表 */
  blocks(): LlmTextBlock[] {
    const text = this.chunks.join('');
    return text === '' ? [] : [{ type: 'text', text }];
  }
}

/** reasoning effort 标识工厂 */
export function ReasoningEffortId(id: string): string {
  return id;
}
