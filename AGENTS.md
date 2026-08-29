# ShiftPay global instructions

This is a monorepo for ShiftPay.

Main modules:
- backend: Spring Boot API and Vaadin admin UI
- mobile: React Native app
- webadmin/web-admin: historical or placeholder admin dashboard directories; do not use for MVP unless explicitly requested
- docs: specifications and architecture
- infra: Docker and deployment

Do not make unrelated changes across modules.
If working in one module, avoid changing other modules unless the task explicitly requires it.
Update docs when public API or business rules change.

## Canonical Docs Workflow

Canonical product documentation lives in `/home/oleksandr/Projects/ShiftPay/docs`
on the root `main` worktree. Treat it as the single source of truth for product
specs, API contracts, architecture, mobile UX, and task coordination.

Before starting feature, business-rule, or API work, update the canonical docs
first. Backend and mobile agents must read these canonical files from the root
`main` worktree before implementation:

- `/home/oleksandr/Projects/ShiftPay/docs/API.md`
- `/home/oleksandr/Projects/ShiftPay/docs/SPEC.md`
- `/home/oleksandr/Projects/ShiftPay/docs/ARCHITECTURE.md`
- `/home/oleksandr/Projects/ShiftPay/docs/MOBILE_UX.md`
- `/home/oleksandr/Projects/ShiftPay/docs/TASKS.md`

Do not use `rsync docs/` between worktrees as a normal workflow. If an agent
worktree has docs that differ from canonical docs, pull `main` with git when it
is safe to do so. If there are uncommitted changes or conflicts, report the
situation to the coordinator or user instead of overwriting docs.

Feature workflow order is:

1. docs/spec PR first
2. backend implementation PR second
3. mobile implementation PR third

Exceptions require explicit coordinator approval.

Backend owns backend, API, and business-rule implementation docs during a
backend PR only when implementation reveals a required correction. Mobile must
not duplicate backend contract docs; it reads canonical docs read-only and
changes only mobile-owned docs or tasks when needed. If implementation requires
an API or business-rule change, the agent must explicitly report "docs change
required" and must not silently diverge from canonical docs.

See `docs/DOCS_POLICY.md` for the full coordination policy.

Web admin work for the MVP should be done inside the backend Spring Boot application using Vaadin.
Do not create a separate web-admin React, Vue, or Angular project for the MVP unless the user explicitly changes direction.
If admin UI work changes backend services, REST API behavior, security, or business rules, update the relevant docs and tests.
