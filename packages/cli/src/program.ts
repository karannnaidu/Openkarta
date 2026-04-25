import { Command } from 'commander';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('openkarta')
    .description('OpenKarta consumer CLI — discover agents, build carts, check out')
    .version('0.2.0');

  program.command('search')
    .description('not yet implemented')
    .action(() => { throw new Error('not implemented'); });

  return program;
}
