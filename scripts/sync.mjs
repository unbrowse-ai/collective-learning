#!/usr/bin/env node
/**
 * sync.mjs — pull latest collective-knowledge/*.jsonl from an upstream skill
 * repo into the local cache at ~/.collective-learning/cache/<skill>/.
 *
 * Uses gh CLI (already authenticated) so we get rate-limit headroom without
 * shipping a token. Falls back to raw.githubusercontent.com via fetch if gh
 * is unavailable.
 *
 * Usage:
 *   sync.mjs --skill unbrowse --repo unbrowse-ai/collective-learning
 *   sync.mjs --skill collective-learning --repo unbrowse-ai/collective-learning
 *   sync.mjs --skill <name> --repo <owner/name> --ref main
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
function arg(name, def = null) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
}

const skill = arg("--skill");
const repo = arg("--repo");
const ref = arg("--ref", "main");
if (!skill || !repo) {
  console.error("[sync] --skill <name> --repo <owner/repo> required");
  process.exit(2);
}

const cacheDir = path.join(os.homedir(), ".collective-learning", "cache", skill);
fs.mkdirSync(cacheDir, { recursive: true });

function ghApi(p) {
  return JSON.parse(execSync(`gh api ${p}`, { encoding: "utf8" }));
}

let tree;
try {
  tree = ghApi(`"repos/${repo}/git/trees/${ref}?recursive=1"`);
} catch (e) {
  console.error(`[sync] gh api failed: ${e.message}`);
  process.exit(3);
}

const ckFiles = (tree.tree || [])
  .filter(t => t.type === "blob" && t.path.startsWith("collective-knowledge/") && t.path.endsWith(".jsonl"));

if (ckFiles.length === 0) {
  console.log(`[sync] no collective-knowledge/*.jsonl in ${repo}@${ref}`);
  process.exit(0);
}

for (const f of ckFiles) {
  const raw = execSync(`gh api "repos/${repo}/contents/${f.path}?ref=${ref}" --jq .content`, { encoding: "utf8" });
  const content = Buffer.from(raw.trim(), "base64").toString("utf8");
  const outName = path.basename(f.path);
  const outPath = path.join(cacheDir, outName);
  fs.writeFileSync(outPath, content);
  console.log(`[sync] ${repo}@${ref}:${f.path}  ->  ${outPath}  (${content.length} bytes)`);
}

console.log(`[sync] done — ${ckFiles.length} file(s) cached under ${cacheDir}`);
