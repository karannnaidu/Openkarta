// Quick Lighthouse JSON summarizer for the mobile-friendliness audit.
// Usage: node scripts/lh-summarize.js <file.json> [<file2.json> ...]
const fs = require('fs');
const cats = ['performance', 'accessibility', 'best-practices', 'seo'];
for (const file of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const scores = cats.map((c) => `${c.padEnd(15)} ${Math.round(j.categories[c].score * 100)}`);
  console.log(`\n== ${file} ==`);
  for (const s of scores) console.log(s);
  const fails = [];
  for (const a of Object.values(j.audits)) {
    if (a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'notApplicable') {
      fails.push({ score: a.score, id: a.id, title: a.title });
    }
  }
  fails.sort((x, y) => x.score - y.score);
  console.log(`-- failing audits (${fails.length}) --`);
  for (const f of fails) console.log(`  ${f.score.toFixed(2)}  ${f.id.padEnd(38)} — ${f.title}`);
}
