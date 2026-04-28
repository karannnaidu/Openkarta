import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import {
  type ChatTurn,
  chatOnce,
  createDispatcher,
  createOrchestrator,
  newState,
} from "@openkarta/orchestrator";
import { Command } from "commander";
import { info, error as printError } from "../output.js";
import { ORDERS_FILE } from "../storage.js";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-opus-4";

export function chatCommand(): Command {
  return new Command("chat")
    .description("Natural-language interface — point at any chat-completions endpoint")
    .option("--registry <url>", "override registry URL")
    .option(
      "--base-url <url>",
      "chat-completions base URL",
      process.env.OPENKARTA_LLM_BASE_URL ?? DEFAULT_BASE_URL,
    )
    .option("--model <id>", "model identifier", process.env.OPENKARTA_LLM_MODEL ?? DEFAULT_MODEL)
    .option("--api-key <key>", "API key (optional for local servers)")
    .action(
      async (opts: { registry?: string; baseUrl: string; model: string; apiKey?: string }) => {
        const apiKey =
          opts.apiKey ??
          process.env.OPENKARTA_LLM_API_KEY ??
          process.env.OPENROUTER_API_KEY ??
          process.env.OPENAI_API_KEY;

        const orch = createOrchestrator(opts.registry ? { registryUrl: opts.registry } : {});
        const state = newState();
        const dispatch = createDispatcher(orch, state, { ordersFile: ORDERS_FILE });

        const rl = createInterface({ input: stdin, output: stdout });
        info(`chat session started — model=${opts.model} via ${opts.baseUrl}`);
        info("Ctrl+C to exit");

        const history: ChatTurn[] = [];
        while (true) {
          let userInput: string;
          try {
            userInput = await rl.question("\nyou › ");
          } catch {
            rl.close();
            return;
          }
          if (!userInput.trim()) continue;
          history.push({ role: "user", text: userInput });
          try {
            const { history: nextHistory, finalText } = await chatOnce(history, dispatch, {
              baseURL: opts.baseUrl,
              model: opts.model,
              ...(apiKey ? { apiKey } : {}),
              onToolUse: (name) => info(`→ ${name}`),
            });
            history.length = 0;
            history.push(...nextHistory);
            process.stdout.write(`\nbot › ${finalText}\n`);
          } catch (err) {
            printError(err instanceof Error ? err.message : String(err));
          }
        }
      },
    );
}
