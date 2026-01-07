/**
 * Console.* audit script
 *
 * Finds remaining `console.*` usages (excluding comments and obvious false positives)
 * so we can migrate them to the structured logger.
 *
 * Usage:
 *   npx tsx scripts/find-console-logs.ts
 */

import fs from "fs";
import path from "path";

type Finding = {
  file: string;
  line: number;
  col: number;
  snippet: string;
};

const ROOT = path.resolve(process.cwd());
const TARGET_DIRS = ["src", "scripts"].map((d) => path.join(ROOT, d));

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
]);

const FILE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

// Simple heuristic: detect `console.` usage, ignore lines that look like comments.
const CONSOLE_RE = /\bconsole\.(log|info|warn|error|debug|trace)\b/;

function walk(dir: string, out: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(full, out);
      continue;
    }
    if (e.isFile()) {
      const ext = path.extname(e.name);
      if (FILE_EXTS.has(ext)) out.push(full);
    }
  }
  return out;
}

function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function auditFile(filePath: string): Finding[] {
  const rel = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const findings: Finding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;

    const match = CONSOLE_RE.exec(line);
    if (!match) continue;

    findings.push({
      file: rel,
      line: i + 1,
      col: match.index + 1,
      snippet: line.trim().slice(0, 200),
    });
  }

  return findings;
}

function main() {
  const files = TARGET_DIRS.flatMap((d) => (fs.existsSync(d) ? walk(d) : []));
  const findings = files.flatMap(auditFile);

  if (findings.length === 0) {
    console.log("✅ No console.* usages found in src/ and scripts/");
    return;
  }

  console.log(`⚠️ Found ${findings.length} console.* usages:\n`);
  for (const f of findings) {
    console.log(`${f.file}:${f.line}:${f.col}  ${f.snippet}`);
  }

  // Exit non-zero so it can be used in CI if desired.
  process.exitCode = 1;
}

main();

