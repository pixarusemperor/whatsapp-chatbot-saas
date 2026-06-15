# Domain Docs

This is a single-context project.

## Layout

- **`CONTEXT.md`** — root of repo. Unified domain glossary covering both the original SaaS namespace and the merged `wf_*` namespace.
- **`docs/adr/`** — architectural decision records. Numbered sequentially (`001-`, `002-`, etc.).
- **`docs/adr/sessions/`** — per-session logs. Dated filenames (`2026-06-15.md`). Auto-appended by Command Code after each working session.

## When to Use

- `/diagnose` — reads `CONTEXT.md` for domain model
- `/tdd` — reads `CONTEXT.md` for naming conventions
- `/improve-codebase-architecture` — reads `CONTEXT.md` and `docs/adr/`
- `/triage` — reads `CONTEXT.md`
- `/to-issues` — reads `CONTEXT.md` for domain language in issue titles

## Antigravity CLI

This project supports development via both Command Code and **Google Antigravity CLI**.

- **Skills directory**: `~/whatsapp-chatbot-saas/.agents/skills/` (project scope)
- **Skill layout**: each skill is a folder with `SKILL.md` (required) + optional `scripts/`, `references/` subdirectories
- **Shared context**: `CONTEXT.md`, `docs/adr/`, `docs/agents/` are readable by any agent
- **CLI docs**: https://antigravity.google/product/antigravity-cli
- **Getting started**: https://codelabs.developers.google.com/getting-started-google-antigravity
