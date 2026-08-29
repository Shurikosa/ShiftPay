# ShiftPay Docs Policy

This document defines the canonical documentation workflow for all ShiftPay
agents and worktrees.

## Canonical Source

`/home/oleksandr/Projects/ShiftPay/docs` on the root `main` worktree is the
canonical documentation location and the single source of truth for:

- product specifications
- API contracts
- architecture decisions
- mobile UX expectations
- task coordination

The canonical docs are:

- `/home/oleksandr/Projects/ShiftPay/docs/API.md`
- `/home/oleksandr/Projects/ShiftPay/docs/SPEC.md`
- `/home/oleksandr/Projects/ShiftPay/docs/ARCHITECTURE.md`
- `/home/oleksandr/Projects/ShiftPay/docs/MOBILE_UX.md`
- `/home/oleksandr/Projects/ShiftPay/docs/TASKS.md`

## Start With Docs

New feature, business-rule, and API work starts with a canonical docs update.
The intended workflow is:

1. docs/spec PR first
2. backend implementation PR second
3. mobile implementation PR third

Exceptions are allowed only with explicit coordinator approval.

## Agent Responsibilities

Backend and mobile agents must read the canonical docs from the root `main`
worktree before implementation. Agent-local or worktree-local docs are not the
authority if they differ from canonical docs.

Backend owns backend, API, and business-rule implementation docs during a
backend PR only when implementation reveals a required correction.

Mobile must not duplicate backend contract docs. Mobile reads canonical docs as
read-only source material and changes only mobile-owned docs or tasks when
needed.

If implementation requires a change to an API contract or business rule, the
agent must explicitly report "docs change required" and must not silently
diverge from canonical docs.

## Worktree Sync Rules

Do not use `rsync docs/` between worktrees as a normal workflow.

If an agent worktree has docs that differ from canonical docs:

1. Pull `main` with git when the worktree is clean and it is safe to update.
2. If there are uncommitted changes, conflicts, or uncertainty about overwriting
   docs, report the situation to the coordinator or user.
3. Do not overwrite canonical docs with agent-local copies unless explicitly
   instructed.

## Definition of Aligned Work

An implementation is aligned with the docs workflow when:

- required canonical docs were read before implementation
- feature or contract changes were documented before code work, unless an
  approved exception exists
- implementation does not silently change API or business rules away from
  canonical docs
- backend and mobile documentation ownership boundaries were respected
