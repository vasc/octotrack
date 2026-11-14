// Rehearses a migration on a copy of the real database, never the original, and prints what it kept or lost.
// Usage: bun scripts/rehearse-migration.ts [path to octo.db]   (defaults to ~/.octotrack/octo.db)
import { mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { rehearseCopy } from "../packages/server/src/rehearse.ts";

const source = process.argv[2] ?? join(homedir(), ".octotrack", "octo.db");
const work = mkdtempSync(join(tmpdir(), "octo-rehearsal-"));
const { copy, report } = rehearseCopy(source, work);

const changed = (before: Record<string, number>, after: Record<string, number>) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .sort()
    .filter((key) => before[key] !== after[key])
    .map((key) => `  ${key}: ${before[key] ?? 0} → ${after[key] ?? 0}`);

console.log(`Rehearsed on a copy: ${copy}`);
console.log(`Refs checked: ${report.before.refs.length}`);
console.log(
  `Events ${report.before.events} → ${report.after.events}, links ${report.before.links} → ${report.after.links}, agents ${report.before.agents} → ${report.after.agents}`,
);
const drift = changed(report.before.openDriftByRule, report.after.openDriftByRule);
console.log(
  drift.length === 0 ? "Open drift by rule: unchanged" : `Open drift by rule:\n${drift.join("\n")}`,
);
if (report.problems.length === 0) {
  console.log("Nothing lost.");
} else {
  console.log(`Problems:\n${report.problems.map((problem) => `  ${problem}`).join("\n")}`);
  process.exitCode = 1;
}
