# ShiftPay global instructions

# ShiftPay Global Agent Instructions

This repository contains ShiftPay, a cross-platform app for tracking work shifts, worked hours, and salary calculations.

All Codex agents working in this repository must follow these instructions.

## Project Goal

ShiftPay helps foremen and workers track work sessions, calculate worked time, and calculate salary.

The app must eventually work on:

- Android
- iOS
- Web admin dashboard

## Repository Structure

backend/      Spring Boot REST API
mobile/       React Native / Expo app
web-admin/    Future admin dashboard
infra/        Docker, compose, deployment configuration
docs/         Specifications, API docs, architecture, task list

Important Documentation

Before making changes, read:

docs/SPEC.md
docs/API.md
docs/TASKS.md
docs/ARCHITECTURE.md

If working inside a module, also read the local AGENTS.md file.

Examples:

-backend work: read backend/AGENTS.md
-mobile work: read mobile/AGENTS.md
-infrastructure work: read infra/AGENTS.md
-Core Business Rules

ShiftPay has three main roles:

-WORKER
-FOREMAN
-ADMIN

A foreman creates a shift session.

The system records:

-shift start time
-shift end time
-worker attendance
-break duration
-hourly rate
-calculated salary

Salary formula:

worked_minutes = end_time - start_time - break_minutes
salary = worked_minutes / 60 * hourly_rate

Salary calculation must be tested.

General Development Rules

Do not make unrelated changes.

If the task is about backend, avoid changing mobile files.

If the task is about mobile, avoid changing backend files.

If API changes are made, update:

-docs/API.md
-backend tests
-mobile API client if it exists

If business rules change, update:

-docs/SPEC.md
-docs/ARCHITECTURE.md

Git Rules

Use small commits.

Do not commit:

.idea/
*.iml
target/
build/
node_modules/
.env

Code Quality Rules
-Keep code simple.
-Avoid overengineering.
-Prefer clear names.
-Do not hide business logic in controllers or UI components.
-Add tests for important logic.
-Explain important decisions in documentation.

Definition of Done

A task is done only when:

-code compiles
-tests pass or the reason is clearly explained
-changed behavior is documented
-no unrelated files were changed
-important business logic has tests
