import { Command } from 'commander';
import { searchCommand } from './commands/search.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('openkarta')
    .description('OpenKarta consumer CLI — discover agents, build carts, check out')
    .version('0.2.0');

  program.addCommand(searchCommand());
  return program;
}
