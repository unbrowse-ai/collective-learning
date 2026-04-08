---
name: collective-learning
description: Meta-pattern that any skill can adopt to contribute agent-discovered knowledge (API recipes, workarounds, failure patterns) back to the skill's open source repo via GitHub PRs/issues. Enables collective intelligence across all agents using a skill.
user-invocable: true
---

# Collective Learning

When an agent discovers something useful while using a skill — an API endpoint, a workaround, a failure pattern — that knowledge should flow back to every agent who uses that skill. This meta-pattern defines how.

North star: **compilable, programmatic API access patterns** — browser/CDP hacking is last resort.

## 1. Discovery Protocol

### Trigger Conditions

An agent SHOULD file a contribution when any of these occur:

| Signal | Detection | Example |
|--------|-----------|---------|
| **Workaround** | Success after 3+ failed attempts at the same goal | CDP crashes on Priceline → curl GraphQL directly |
| **API Recipe** | Agent constructs a working curl/fetch call to an undocumented endpoint | Discovered `datapi.jup.ag/v1/assets/search` |
| **Failure Pattern** | Same error 3+ times across tool calls, or error matches a known-bad pattern | PerimeterX blocks all CDP sessions on site X |
| **Performance Win** | Agent finds a path that skips 5+ tool calls vs the default approach | Skip browser, mine JS bundle for schema, curl API |

### Detection Logic (for hooks or post-session analysis)

```bash
# After session, scan metacognition data for contribution candidates
node ~/.claude/skills/collective-learning/scripts/detect.mjs \
  --session-id "$SESSION_ID" \
  --min-failed-attempts 3 \
  --output ~/.collective-learning/candidates.jsonl
```

The script checks:
1. Tool call chains where success followed 3+ failures on the same target
2. New API endpoints not in the skill's known recipes
3. Error patterns that repeated 3+ times
4. Sessions where final approach used <30% of the tool calls attempted

## 2. Contribution Format

Every contribution is a JSON document following this schema. Machine-readable so other agents consume it directly.

### `contribution.schema.json`

```json
{
  "version": "1.0",
  "type": "api-recipe | workaround | failure-pattern | performance-optimization",
  "skill": "unbrowse",
  "skill_repo": "github.com/unbrowse-ai/unbrowse",
  "target": {
    "domain": "priceline.com",
    "service": "hotel search",
    "tags": ["graphql", "anti-bot", "cdp-hostile"]
  },
  "discovery": {
    "date": "2026-04-07",
    "agent": "claude-opus-4-6",
    "session_tool_calls": 62,
    "failed_approaches": [
      {
        "method": "CDP browser automation",
        "error": "PerimeterX blocked all interactions",
        "tool_calls_wasted": 18
      },
      {
        "method": "CDP with stealth flags",
        "error": "Empty page snap, bot detection triggered",
        "tool_calls_wasted": 12
      }
    ],
    "working_approach": {
      "method": "Login for cookies → mine JS bundles → curl GraphQL API",
      "steps": [
        "1. Use `unbrowse login priceline.com` to get session cookies",
        "2. Fetch JS bundles from assets.pclncdn.com (unprotected CDN)",
        "3. Extract GraphQL queries and variable shapes from bundles",
        "4. curl the API with session cookies: `curl -H 'Cookie: ...' -d '{\"query\": ...}' https://www.priceline.com/graphql`"
      ],
      "tool_calls_used": 8
    }
  },
  "recipe": {
    "endpoint": "https://www.priceline.com/graphql",
    "method": "POST",
    "headers": {"Content-Type": "application/json"},
    "auth": "session cookies from browser login",
    "body_template": "{\"query\": \"query HotelSearch($input: HotelSearchInput!) { ... }\", \"variables\": {}}",
    "notes": "Schema discovered from JS bundles on CDN, not from browser inspection"
  },
  "savings": {
    "tool_calls_before": 62,
    "tool_calls_after": 8,
    "reduction": "87%"
  }
}
```

## 3. GitHub Integration

### Filing a Contribution

```bash
# File as GitHub issue with structured body
gh issue create \
  --repo "$SKILL_REPO" \
  --title "[agent-discovery] API recipe: priceline.com hotel search via GraphQL" \
  --label "agent-discovery,api-recipe" \
  --body "$(cat <<'EOF'
## Agent-Discovered Knowledge

**Type:** api-recipe
**Domain:** priceline.com
**Confidence:** high (verified working)

### What Failed
- CDP browser automation: PerimeterX blocked all interactions (18 tool calls wasted)
- CDP with stealth flags: Empty page snap (12 tool calls wasted)

### What Works
Login for cookies → mine JS bundles from CDN → curl GraphQL API directly

### Recipe
```
curl -X POST https://www.priceline.com/graphql \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookies_from_login>" \
  -d '{"query": "query HotelSearch($input: HotelSearchInput!) { ... }", "variables": {}}'
```

### Reproduction
1. `unbrowse login priceline.com` → extract cookies
2. Fetch `https://assets.pclncdn.com/webpack/...` → grep for `query.*Hotel`
3. Use extracted query with cookies via curl

### Machine-Readable
```json
<full contribution.schema.json here>
```

---
*Auto-filed by agent session. Verify before merging into skill knowledge base.*
EOF
)"
```

### Standard Labels

Create these labels on any skill repo that opts in:

```bash
for label in "agent-discovery" "api-recipe" "failure-pattern" "workaround" "performance-optimization" "verified" "needs-verification"; do
  gh label create "$label" --repo "$SKILL_REPO" --force 2>/dev/null
done
```

### Filing as PR (for verified recipes)

When the agent has high confidence (recipe tested and working), file a PR that adds the recipe directly to the skill's knowledge base:

```bash
# Clone, branch, add recipe, PR
git clone "https://github.com/$SKILL_REPO" /tmp/skill-contrib
cd /tmp/skill-contrib
git checkout -b "agent/api-recipe-priceline-graphql"

# Add to the skill's collective knowledge file
cat >> collective-knowledge/api-recipes.jsonl << 'RECIPE'
{"domain":"priceline.com","type":"api-recipe","method":"POST","endpoint":"https://www.priceline.com/graphql","auth":"session-cookies","discovery_date":"2026-04-07","steps":["login for cookies","mine JS bundles from CDN","curl GraphQL"],"tags":["graphql","anti-bot","cdp-hostile"]}
RECIPE

git add . && git commit -m "Add agent-discovered API recipe: priceline.com GraphQL"
git push -u origin HEAD

gh pr create \
  --title "[agent-discovery] API recipe: priceline.com GraphQL" \
  --label "agent-discovery,api-recipe" \
  --body "Auto-discovered API access pattern. See contribution JSON for details."
```

## 4. Skill Opt-In

Any skill opts in by adding two things:

### A. `collective-knowledge/` directory

```
skill-name/
├── SKILL.md
├── collective-knowledge/
│   ├── api-recipes.jsonl      # One recipe per line, machine-readable
│   ├── failure-patterns.jsonl # Known failure modes to avoid
│   └── CONTRIBUTING.md        # Instructions for agent contributions
└── scripts/
```

### B. Collective Learning section in SKILL.md

Add this block to the skill's SKILL.md:

```markdown
## Collective Learning

This skill accepts agent-discovered knowledge via the `collective-learning` meta-pattern.

### Before attempting a task, check prior discoveries:
1. Read `collective-knowledge/api-recipes.jsonl` for known API access patterns
2. Read `collective-knowledge/failure-patterns.jsonl` for known failures to avoid
3. Check open issues: `gh issue list --repo REPO --label agent-discovery`
4. Only then attempt fresh discovery

### After discovering something new:
1. Validate the discovery works reliably
2. Run: `node ~/.claude/skills/collective-learning/scripts/contribute.mjs --skill SKILL_NAME --type TYPE`
3. The script files a GitHub issue or PR depending on confidence level
```

## 5. Collective Memory — Consumption Protocol

When an agent starts a task involving a skill with collective learning enabled:

```
Priority order:
1. skill's SKILL.md           → authoritative instructions
2. collective-knowledge/*.jsonl → merged agent discoveries (in-repo)
3. local ~/.collective-learning/cache/$SKILL/ → locally cached discoveries
4. gh issue list --label agent-discovery → open/unmerged contributions
5. fresh discovery             → last resort, contribute back when done
```

### Pre-task check script

```bash
# Before attempting browser automation on a domain, check if there's a known API path
node ~/.claude/skills/collective-learning/scripts/lookup.mjs \
  --skill unbrowse \
  --domain priceline.com \
  --type api-recipe
# Returns: matching recipes from repo + local cache + open issues
```

## 6. Scripts

### `scripts/detect.mjs`
Scans metacognition data for contribution candidates. Reads `~/.metacognition/tool-calls.db`, finds sessions with workaround patterns (success after N failures), and outputs candidates to `~/.collective-learning/candidates.jsonl`.

### `scripts/contribute.mjs`
Takes a candidate and files it as a GitHub issue or PR. Usage:
```bash
node ~/.claude/skills/collective-learning/scripts/contribute.mjs \
  --skill unbrowse \
  --type api-recipe \
  --domain priceline.com \
  --recipe '{"endpoint":"...","method":"POST","auth":"cookies"}' \
  --what-failed "CDP blocked by PerimeterX" \
  --what-worked "JS bundle mining + curl"
```

### `scripts/lookup.mjs`
Checks all knowledge sources before fresh discovery. Returns matching recipes sorted by recency and verification status.

### `scripts/sync.mjs`
Pulls latest `collective-knowledge/*.jsonl` from skill repos into local cache:
```bash
node ~/.claude/skills/collective-learning/scripts/sync.mjs --skill unbrowse
# Fetches raw files from GitHub, caches to ~/.collective-learning/cache/unbrowse/
```

## 7. Integration with Metacognition

The collective-learning hook plugs into metacognition's Level 1 (learn.mjs):

```
metacognition observe → mine.mjs extracts tool calls
                      ↓
metacognition learn  → learn.mjs finds patterns
                      ↓
collective-learning  → detect.mjs filters for contributable discoveries
                      ↓
                     → contribute.mjs files to skill repo
                      ↓
other agents         → lookup.mjs checks before fresh attempts
```

Add to `~/.claude/settings.json` hooks:

```json
{
  "hooks": {
    "PostSessionSubmit": [
      {
        "type": "command",
        "command": "node ~/.claude/skills/collective-learning/scripts/detect.mjs --auto"
      }
    ]
  }
}
```

## 8. The API-First Doctrine

Every contribution should push toward this hierarchy:

```
BEST:   Direct API call (curl/fetch, no browser)
GOOD:   API discovered via JS bundle analysis
OK:     API discovered via browser network intercept
AVOID:  Browser automation / CDP scripting
WORST:  Manual browser interaction requiring human
```

When an agent discovers a direct API path that replaces browser automation, that contribution is high-priority. The collective knowledge base should converge toward a world where **no agent ever opens a browser for a site that has a known API path**.

## Quick Reference

| Action | Command |
|--------|---------|
| Check before attempting | `node scripts/lookup.mjs --skill X --domain Y` |
| Detect contributions from session | `node scripts/detect.mjs --auto` |
| File a discovery | `node scripts/contribute.mjs --skill X --type Y ...` |
| Sync latest from repos | `node scripts/sync.mjs --skill X` |
| List all open discoveries | `gh issue list --repo REPO --label agent-discovery` |
