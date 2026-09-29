#!/usr/bin/env node
/**
 * lookup.mjs — check existing collective-knowledge before fresh discovery.
 *
 * Reads collective-knowledge/*.jsonl from the local skill install (and from a
 * cache at ~/.collective-learning/cache/<skill>/), filters by domain and type,
 * emits matching rows as RAW evidence.
 *
 * Substrate-faithful: returns matches AS-IS. The agent judges whether a recipe
 * is fresh enough, whether to follow it, or whether to fall back to discovery.
 *
 * Usage:
 *   lookup.mjs --skill unbrowse --domain priceline.com --type api-recipe
 *   lookup.mjs --skill collective-learning --domain priceline.com
 *   lookup.mjs --skill-dir ~/.claude/skills/collective-learning --domain priceline.com
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const argv = process.argv.slice(2);
function arg(name, def = null) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
}

const skill = arg("--skill");
const skillDir = arg("--skill-dir");
const domain = arg("--domain");
const type = arg("--type"); // api-recipe | failure-pattern | workaround | performance-optimization

const searchDirs = [];
if (skillDir) {
  searchDirs.push(path.join(skillDir, "collective-knowledge"));
}
if (skill) {
  searchDirs.push(path.join(os.homedir(), ".claude", "skills", skill, "collective-knowledge"));
  searchDirs.push(path.join(os.homedir(), ".collective-learning", "cache", skill));
}
if (searchDirs.length === 0) {
  console.error("[lookup] --skill or --skill-dir required");
  process.exit(2);
}

const matches = [];
for (const dir of searchDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".jsonl"));
  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
    for (const line of lines) {
      const s = line.trim();
      if (!s) continue;
      let row;
      try { row = JSON.parse(s); } catch { continue; }
      if (domain) {
        const d = (row.domain || row.target?.domain || "").toLowerCase();
        if (!d.includes(domain.toLowerCase())) continue;
      }
      if (type && row.type !== type) continue;
      matches.push({ source: path.join(dir, f), row });
    }
  }
}

console.log(`# lookup.mjs — ${matches.length} match(es) for domain=${domain||"*"} type=${type||"*"} skill=${skill||"-"}`);
for (const m of matches) {
  console.log(`\n## ${m.source}`);
  console.log(JSON.stringify(m.row, null, 2));
}

if (matches.length === 0) {
  console.log("(no matches — fresh discovery is justified)");
  process.exit(1);
}
