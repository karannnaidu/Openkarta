import Table from "cli-table3";
import kleur from "kleur";

export function formatPrice(minor: number | undefined, currency = "INR"): string {
  if (minor === undefined) return "—";
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function searchTable(
  rows: {
    agentId: string;
    agentDisplayName: string;
    itemId: string;
    title?: string;
    priceMinor?: number;
    currency?: string;
  }[],
): string {
  const t = new Table({
    head: [kleur.bold("Agent"), kleur.bold("Item"), kleur.bold("Title"), kleur.bold("Price")],
    style: { head: [], border: ["gray"] },
  });
  for (const r of rows) {
    t.push([
      r.agentDisplayName,
      kleur.dim(r.itemId),
      r.title ?? kleur.dim("(untitled)"),
      formatPrice(r.priceMinor, r.currency),
    ]);
  }
  return t.toString();
}

export function info(msg: string): void {
  process.stdout.write(`${kleur.cyan("•")} ${msg}\n`);
}
export function ok(msg: string): void {
  process.stdout.write(`${kleur.green("✓")} ${msg}\n`);
}
export function warn(msg: string): void {
  process.stderr.write(`${kleur.yellow("!")} ${msg}\n`);
}
export function error(msg: string): void {
  process.stderr.write(`${kleur.red("✗")} ${msg}\n`);
}
