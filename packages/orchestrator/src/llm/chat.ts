import type { DispatchFn } from "./dispatcher.js";
import { buildToolDefs } from "./tool-defs.js";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatLoopOptions {
  /** Base URL of the chat-completions endpoint, e.g. 'https://openrouter.ai/api/v1' or 'http://localhost:11434/v1'. */
  baseURL: string;
  /** Model identifier as the endpoint expects it, e.g. 'anthropic/claude-opus-4' or 'llama3.1:70b'. */
  model: string;
  /** Optional — local servers (Ollama, llama.cpp) often don't need a key. */
  apiKey?: string;
  systemPrompt?: string;
  maxIterations?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
  onToolUse?: (name: string, input: unknown) => void;
}

const DEFAULT_SYSTEM = `You are an OpenKarta consumer agent. You orchestrate calls across a federated registry of merchants using these tools.
Guidelines:
- Always search before adding to cart.
- A cart is bound to ONE agent and ONE item type. Don't try to mix.
- Quote before checkout. Show the price to the user before charging.
- Prefer explicit confirmation before checkout.`;

interface ToolCallShape {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCallShape[];
  tool_call_id?: string;
}

interface ChatCompletionResponse {
  choices?: {
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: ToolCallShape[];
    };
    finish_reason?: string;
  }[];
}

export async function chatOnce(
  history: ChatTurn[],
  dispatch: DispatchFn,
  opts: ChatLoopOptions,
): Promise<{ history: ChatTurn[]; finalText: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const tools = buildToolDefs().map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const messages: ChatMessage[] = [
    { role: "system", content: opts.systemPrompt ?? DEFAULT_SYSTEM },
    ...history.map<ChatMessage>((t) => ({ role: t.role, content: t.text })),
  ];

  const url = `${opts.baseURL.replace(/\/$/, "")}/chat/completions`;
  const maxIter = opts.maxIterations ?? 10;
  const maxTokens = opts.maxTokens ?? 1024;

  let finalText = "";
  for (let i = 0; i < maxIter; i++) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;

    const res = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: opts.model,
        messages,
        tools,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`chat endpoint ${res.status}: ${bodyText.slice(0, 500)}`);
    }

    const json = (await res.json()) as ChatCompletionResponse;
    const choice = json.choices?.[0];
    if (!choice?.message) throw new Error("chat response had no choices[0].message");
    const msg = choice.message;
    const toolCalls = msg.tool_calls ?? [];

    if (toolCalls.length === 0) {
      finalText = (msg.content ?? "").trim();
      messages.push({ role: "assistant", content: msg.content ?? "" });
      break;
    }

    messages.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      let parsedInput: Record<string, unknown>;
      try {
        parsedInput = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: `error: tool input for ${tc.function.name} was not valid JSON`,
        });
        continue;
      }
      opts.onToolUse?.(tc.function.name, parsedInput);
      try {
        const result = await dispatch(tc.function.name, parsedInput);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: `error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  if (finalText === "") {
    throw new Error(`chat loop exhausted: no final text response within ${maxIter} iterations`);
  }

  return {
    history: [...history, { role: "assistant", text: finalText }],
    finalText,
  };
}
