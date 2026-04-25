import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createOrchestrator, createDispatcher, newState, chatOnce, type ChatTurn } from '@openkarta/orchestrator';
import { ORDERS_FILE } from '../storage.js';
import { info, error as printError } from '../output.js';

export function chatCommand(): Command {
  return new Command('chat')
    .description('Natural-language interface (uses Anthropic; needs ANTHROPIC_API_KEY)')
    .option('--registry <url>', 'override registry URL')
    .option('--model <id>', 'Anthropic model id', 'claude-opus-4-7')
    .action(async (opts: { registry?: string; model: string }) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { printError('ANTHROPIC_API_KEY is not set'); process.exitCode = 1; return; }

      const orch = createOrchestrator(opts.registry ? { registryUrl: opts.registry } : {});
      const state = newState();
      const dispatch = createDispatcher(orch, state, { ordersFile: ORDERS_FILE });

      const rl = createInterface({ input: stdin, output: stdout });
      info('chat session started — Ctrl+C to exit');

      const history: ChatTurn[] = [];
      while (true) {
        let userInput: string;
        try {
          userInput = await rl.question('\nyou › ');
        } catch {
          // EOF (Ctrl+D) or stream closed — exit cleanly
          rl.close();
          return;
        }
        if (!userInput.trim()) continue;
        history.push({ role: 'user', text: userInput });
        try {
          const { history: nextHistory, finalText } = await chatOnce(history, dispatch, {
            apiKey,
            model: opts.model,
            onToolUse: (name) => info(`→ ${name}`),
          });
          history.length = 0;
          history.push(...nextHistory);
          process.stdout.write(`\nbot › ${finalText}\n`);
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err));
        }
      }
    });
}
