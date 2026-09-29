#!/usr/bin/env node
/**
 * detect.mjs — surface contribution candidates from the metacognition store.
 *
 * Substrate-faithful: reads ~/.metacognition/candidates/*.json AS-IS,
 * emits them as evidence. Does NOT classify what is "contributable" — the
 * agent reading stdout judges in-thread which to file via contribute.mjs.
 *
 * Filters (all optional, all RAW — they limit the set, never decide value):
 *   --skill <name>           only candidates whose plan_slug or scaffold_dir mentions <name>
 *   --type <t>               candidate.type (default: any; common: harness-iteration, tool-sequence)
 *   --status <s>             candidate.status (e.g. failed, shipped, delegated)
 *   --since <YYYY-MM-DD>     candidate.detected_at >= date
 *   --json                   emit one JSON object per line (default: pretty table)
 *   --candidates-dir <path>  override default (~/.metacognition/candidates)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const argv = process.argv.slice(2);
function arg(name, def = null) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
}
function flag(name) { return argv.includes(name); }

const candDir = arg("--candidates-dir", path.join(os.homedir(), ".metacognition", "candidates"));
const wantSkill = arg("--skill");
const wantType = arg("--type");
const wantStatus = arg("--status");
const wantSince = arg("--since");
const asJson = flag("--json");

if (!fs.existsSync(candDir)) {
  console.error(`[detect] candidates dir not found: ${candDir}`);
  process.exit(2);
}

const files = fs.readdirSync(candDir).filter(f => f.endsWith(".json"));
const rows = [];
for (const f of files) {
  let cand;
  try { cand = JSON.parse(fs.readFileSync(path.join(candDir, f), "utf8")); }
  catch { continue; }

  if (wantType && cand.type !== wantType) continue;
  if (wantStatus && cand.status !== wantStatus) continue;
  if (wantSkill) {
    const blob = `${cand.plan_slug || ""} ${cand.scaffold_dir || ""} ${JSON.stringify(cand.sample_inputs || [])}`.toLowerCase();
    if (!blob.includes(wantSkill.toLowerCase())) continue;
  }
  if (wantSince && cand.detected_at && cand.detected_at < wantSince) continue;

  rows.push({ file: f, ...cand });
}

if (asJson) {
  for (const r of rows) console.log(JSON.stringify(r));
} else {
  console.log(`# detect.mjs — ${rows.length} candidate(s) from ${candDir}`);
  for (const r of rows) {
    const id = r.id || r.file;
    const t = r.type || "(no type)";
    const slug = r.plan_slug || r.sequence?.join(">") || "";
    const status = r.status ? `status=${r.status}` : "";
    const phase = r.phase ? `phase=${r.phase}` : "";
    console.log(`- ${id}  type=${t}  ${slug}  ${status}  ${phase}`);
  }
}
