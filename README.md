# Claude Router Init Wizard

A Claude Code skill that scaffolds a modular AI memory system for any project — in one guided session.

## What it does

Runs a step-by-step wizard that builds a structured, maintainable AI instructions system:

- `CLAUDE.md` — a lean router file (no code rules, just routing + session protocol)
- `.claude/skills/<domain>.md` — domain-specific rule files (frontend, backend, security, etc.)
- `docs/BIG_PICTURE.md` — project goal and stack, read at the start of every session
- `docs/CHANGELOG.md` — append-only task log
- `docs/BACKLOG.md` — 1-liner ideas parking lot

## Why

A single bloated `CLAUDE.md` gets stale, ignored, and hard to maintain. This wizard splits AI context into JIT (just-in-time) domain files — Claude only loads what's relevant for the current task.

## How to use

1. Copy `claude-router-init-wizard.md` into your Claude Code skills folder (`.claude/skills/`)
2. Open a new Claude Code session in your project
3. Say: **"run the wizard"**
4. Answer the questions. The wizard handles the rest.
5. When done — close the chat. Open a new one. Type `!resume`.

## Wizard flow

```
INIT → STEP_1_ARCHITECT → STEP_1_WAITING_APPROVAL
     → STEP_2_SCAFFOLD → STEP_3_SKILLS → STEP_3_WAITING_APPROVAL
     → STEP_4_ROUTER → DONE
```

| Step | What happens |
|---|---|
| INIT | Asks for project goal and tech stack |
| STEP_1_ARCHITECT | Proposes 3–5 domain skill files, waits for approval |
| STEP_2_SCAFFOLD | Creates `docs/` memory files silently |
| STEP_3_SKILLS | Writes senior-level rules per domain, waits for tweaks |
| STEP_4_ROUTER | Builds `CLAUDE.md` with routing table and session protocol |

## Session protocol (baked into the generated CLAUDE.md)

- **`!resume`** — Claude reads `BIG_PICTURE.md` silently and asks what you're working on this session
- **One session = one task** — no context sprawl across features
- **Auto-log** — after every task, Claude appends a 1-liner to `CHANGELOG.md` and tells you to close the chat

## Rules the wizard enforces

- No generic advice — every rule is specific: naming conventions, forbidden patterns, required tools
- `CLAUDE.md` contains zero coding rules — routing and protocol only
- `CHANGELOG.md` is write-only — Claude never reads it unless explicitly instructed (and will confirm twice)
