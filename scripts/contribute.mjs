#!/usr/bin/env node
/**
 * contribute.mjs — file an agent-discovered contribution to the target skill
 * repo as a GitHub PR or issue.
 *
 * Substrate-faithful: takes a candidate JSON (from detect.mjs / hand-written)
 * and a routing decision (--as issue|pr), then files it. Does NOT decide
 * which candidates are worth filing — that is the agent's judgment.
 *
 * Two modes:
 *   issue  : gh issue create against the skill repo, structured body
 *   pr     : clone repo, branch agent/<type>-<slug>, append to
 *            collective-knowledge/<type>s.jsonl, push, gh pr create
 *
 * Dry-run modes:
 *   --dry-run         print the gh commands that would run, no API calls
 *   --sandbox-repo R  file against R instead of the canonical skill repo
 *                     (still hits api.github.com — the http-curl channel
 *                     verify gate wants this, not --dry-run)
 *
 * Usage:
 *   contribute.mjs --skill unbrowse --skill-repo unbrowse-ai/unbrowse \
 *                  --type api-recipe --candidate ./recipe.json --as issue
 *   contribute.mjs --skill collective-learning \
 *                  --skill-repo unbrowse-ai/collective-learning \
 *                  --type api-recipe --candidate ./recipe.json --as pr
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
function arg(name, def = null) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
}
function flag(name) { return argv.includes(name); }

const skill = arg("--skill");
const skillRepo = arg("--skill-repo");
const type = arg("--type", "api-recipe");
const candidatePath = arg("--candidate");
const as = arg("--as", "issue");
const dryRun = flag("--dry-run");
const sandboxRepo = arg("--sandbox-repo");

if (!skill || !skillRepo) {
  console.error("[contribute] --skill <name> --skill-repo <owner/repo> required");
  process.exit(2);
}
const targetRepo = sandboxRepo || skillRepo;

let candidate = {};
if (candidatePath && fs.existsSync(candidatePath)) {
  candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
} else if (candidatePath) {
  console.error(`[contribute] --candidate path not found: ${candidatePath}`);
  process.exit(2);
}

function describe(c) {
  const domain = c.target?.domain || c.domain || "(no domain)";
  const service = c.target?.service || c.service || "";
  return `${domain}${service ? " — " + service : ""}`;
}

const title = `[agent-discovery] ${type}: ${describe(candidate)}`;
const labels = ["agent-discovery", type];

const bodyLines = [
  "## Agent-Discovered Knowledge",
  "",
  `**Type:** ${type}`,
  `**Target:** ${describe(candidate)}`,
  `**Discovery date:** ${candidate.discovery?.date || candidate.detected_at || new Date().toISOString().slice(0,10)}`,
  "",
  "### Candidate JSON",
  "```json",
  JSON.stringify(candidate, null, 2),
  "```",
  "",
  "---",
  "_Auto-filed by contribute.mjs. Verify before merging into the knowledge base._",
];
const body = bodyLines.join("\n");

function ghIssueCreate() {
  const cmd = ["gh", "issue", "create",
    "--repo", targetRepo,
    "--title", title,
    "--label", labels.join(","),
    "--body", body];
  if (dryRun) {
    console.log("[dry-run]", JSON.stringify(cmd));
    return { ok: true, dryRun: true };
  }
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf8" });
  console.log(r.stdout || "");
  if (r.status !== 0) {
    console.error(r.stderr || "");
    return { ok: false, exit: r.status };
  }
  return { ok: true, url: (r.stdout || "").trim() };
}

function ghPrCreate() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `clcontrib-${Date.now()}-`));
  const slug = `${type}-${(candidate.target?.domain || candidate.domain || "untargeted").replace(/[^a-z0-9]+/gi,"-")}`;
  const branch = `agent/${slug}`;
  const ckFile = path.join(tmpRoot, "collective-knowledge", `${type}s.jsonl`);
  if (dryRun) {
    console.log("[dry-run] gh repo clone " + targetRepo + " " + tmpRoot);
    console.log("[dry-run] cd " + tmpRoot + "; git checkout -b " + branch);
    console.log("[dry-run] append candidate to " + ckFile);
    console.log("[dry-run] gh pr create --repo " + targetRepo + " --title " + JSON.stringify(title));
    return { ok: true, dryRun: true, branch };
  }
  try {
    execSync(`gh repo clone ${targetRepo} ${tmpRoot}`, { stdio: "pipe" });
    execSync(`git -C ${tmpRoot} checkout -b ${branch}`, { stdio: "pipe" });
    fs.mkdirSync(path.dirname(ckFile), { recursive: true });
    fs.appendFileSync(ckFile, JSON.stringify(candidate) + "\n");
    execSync(`git -C ${tmpRoot} add .`, { stdio: "pipe" });
    execSync(`git -C ${tmpRoot} commit -m ${JSON.stringify("Add agent-discovered " + type + ": " + describe(candidate))}`, { stdio: "pipe" });
    execSync(`git -C ${tmpRoot} push -u origin HEAD`, { stdio: "pipe" });
    const out = execSync(`gh pr create --repo ${targetRepo} --title ${JSON.stringify(title)} --label ${JSON.stringify(labels.join(","))} --body ${JSON.stringify(body)}`, { encoding: "utf8" });
    return { ok: true, url: out.trim() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const result = as === "pr" ? ghPrCreate() : ghIssueCreate();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
