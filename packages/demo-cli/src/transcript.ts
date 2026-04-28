import chalk from "chalk";

export interface TranscriptStep {
  step: number;
  action: "discover" | "search" | "quote" | "checkout" | "status" | "cancel";
  summary: string;
  detail: Record<string, unknown>;
}

export const printTranscript = (label: string, steps: TranscriptStep[]): void => {
  console.log(chalk.bold(`\n=== ${label} ===\n`));
  for (const s of steps) {
    console.log(
      `${chalk.dim(`[${s.step}]`)} ${chalk.cyan(s.action.padEnd(8))} ${chalk.green(s.summary)}`,
    );
    for (const [k, v] of Object.entries(s.detail)) {
      const value = typeof v === "string" ? v : JSON.stringify(v);
      console.log(`    ${chalk.dim(k)}: ${value}`);
    }
  }
  console.log();
};
