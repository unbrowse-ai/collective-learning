# Collective Learning

**When AI agents discover something useful, that knowledge should flow back to every agent.**

A meta-pattern for open-source skills. Add it to any repo — agents that use your tool will auto-contribute API recipes, workarounds, and failure patterns via GitHub PRs and issues.

## The Problem

Agents repeatedly waste compute rediscovering the same things:
- 60 tool calls fighting bot detection when a direct API exists
- 150K tokens burned on browser automation that could be 3 curl commands
- Every agent starts from zero on the same sites

## The Solution

```bash
# Add to any skill/library repo
npx skills add https://github.com/unbrowse-ai/collective-learning --skill collective-learning
```

This gives agents using your repo:

1. **Pre-task lookup** — check if another agent already solved this problem
2. **Post-task contribution** — when they discover something new, auto-file a PR/issue
3. **Collective knowledge base** — `collective-knowledge/` directory with machine-readable recipes

## How It Works

```
Agent uses your tool → hits a wall → discovers workaround →
files PR to your repo → you merge → next agent reads it → skips wall entirely
```

### The API-First Doctrine

Every contribution pushes toward programmatic access:

```
BEST:   Direct API call (curl/fetch, no browser)
GOOD:   API discovered via JS bundle analysis  
OK:     API discovered via browser network intercept
AVOID:  Browser automation / CDP scripting
WORST:  Manual browser interaction
```

## Quick Start for Library Authors

1. Add this skill to your repo
2. Create a `collective-knowledge/` directory:

```
your-repo/
├── collective-knowledge/
│   ├── api-recipes.jsonl        # One recipe per line
│   ├── failure-patterns.jsonl   # Known failures to avoid
│   └── CONTRIBUTING.md          # Agent contribution guidelines
└── ...
```

3. Add to your CLAUDE.md or SKILL.md:

```markdown
## Collective Learning

Before attempting browser automation on any domain, check `collective-knowledge/api-recipes.jsonl` for known direct API patterns. After discovering a new pattern, file a PR adding it.
```

That's it. Agents will start contributing.

## Contribution Format

Each line in `api-recipes.jsonl` is a self-contained JSON object:

```json
{
  "domain": "priceline.com",
  "type": "api-recipe",
  "service": "hotel search",
  "endpoint": "https://www.priceline.com/pws/v0/pcln-graph/",
  "method": "POST",
  "auth": "session-cookies-via-login",
  "steps": ["login for cookies", "mine JS bundles", "curl GraphQL"],
  "tags": ["graphql", "anti-bot", "cdp-hostile"],
  "savings": {"tool_calls_before": 62, "tool_calls_after": 8}
}
```

## GitHub Labels

Repos that opt in should create these labels:

```bash
for label in agent-discovery api-recipe failure-pattern workaround verified; do
  gh label create "$label" --repo YOUR/REPO --force 2>/dev/null
done
```

## License

MIT
