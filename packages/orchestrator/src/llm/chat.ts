import Anthropic from '@anthropic-ai/sdk';
import { buildToolDefs } from './tool-defs.js';
import type { DispatchFn } from './dispatcher.js';

export interface ChatTurn { role: 'user' | 'assistant'; text: string; }

export interface ChatLoopOptions {
  apiKey: string;
  model?: string;             // default: 'claude-opus-4-7'
  systemPrompt?: string;
  maxIterations?: number;     // safety guard, default 10
  onToolUse?: (name: string, input: unknown) => void;
}

const DEFAULT_SYSTEM = `You are an OpenKarta consumer agent. You orchestrate calls across a federated registry of merchants using these tools.
Guidelines:
- Always search before adding to cart.
- A cart is bound to ONE agent and ONE item type. Don't try to mix.
- Quote before checkout. Show the price to the user before charging.
- Prefer explicit confirmation before checkout.`;

const DEFAULT_MODEL = 'claude-opus-4-7';

export async function chatOnce(
  history: ChatTurn[],
  dispatch: DispatchFn,
  opts: ChatLoopOptions,
): Promise<{ history: ChatTurn[]; finalText: string }> {
  const anthropic = new Anthropic({ apiKey: opts.apiKey });
  // buildToolDefs() returns AnthropicToolDef[] whose shape is aligned to Anthropic.Tool
  const tools = buildToolDefs() as Anthropic.Tool[];
  const messages: Anthropic.MessageParam[] = history.map((t) => ({ role: t.role, content: t.text }));
  const maxIter = opts.maxIterations ?? 10;

  let finalText = '';
  for (let i = 0; i < maxIter; i++) {
    const resp = await anthropic.messages.create({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: 1024,
      system: opts.systemPrompt ?? DEFAULT_SYSTEM,
      tools,
      messages,
    });

    const textBlocks = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
    const toolUses   = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (toolUses.length === 0) {
      finalText = textBlocks.map((b) => b.text).join('\n').trim();
      messages.push({ role: 'assistant', content: resp.content });
      break;
    }

    messages.push({ role: 'assistant', content: resp.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      opts.onToolUse?.(tu.name, tu.input);
      // tu.input is typed as unknown in the SDK; guard before casting
      if (typeof tu.input !== 'object' || tu.input === null) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          is_error: true,
          content: `tool input for ${tu.name} is not an object`,
        });
        continue;
      }
      try {
        const result = await dispatch(tu.name, tu.input as Record<string, unknown>);
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          is_error: true,
          content: err instanceof Error ? err.message : String(err),
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  if (finalText === '') {
    throw new Error(
      `chat loop exhausted: model did not produce a final text response within ${maxIter} iterations`,
    );
  }

  return {
    history: [...history, { role: 'assistant', text: finalText }],
    finalText,
  };
}
