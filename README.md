# ShiftPay

ShiftPay is a cross-platform application for tracking work shifts, worked hours, and salary calculations.

The main idea is simple:

- A foreman creates a work shift session.
- Workers join the session.
- The system tracks worked time.
- The system calculates salary based on hourly rate, breaks, and approved work time.

## Project Status

This project is in MVP development.

The first MVP goal is to build:

- Spring Boot backend REST API
- PostgreSQL database
- JWT authentication
- Role-based access
- Shift session management
- Salary calculation
- Basic mobile app for Android and iOS

## Main Roles

### Worker

A worker can:

- register and log in
- join a shift session
- see their worked hours
- see calculated salary
- see shift history

### Foreman

A foreman can:

- create shift sessions
- start and close shifts
- allow workers to join
- approve worker attendance
- see daily shift summary
- see salary summary for workers

### Admin

An admin can:

- manage companies
- manage users
- manage roles
- view reports
- configure system settings

## Planned Monorepo Structure

ShiftPay/
  backend/      Spring Boot REST API + Vaadin admin UI
  mobile/       React Native / Expo mobile app
  webadmin/     Historical or placeholder admin directory, not planned as separate MVP frontend
  infra/        Docker, compose, deployment files
  docs/         Specifications and architecture docs

The current MVP plan is to serve the admin dashboard from the backend using Vaadin.
A separate `web-admin/` React, Vue, or Angular module is not planned for the MVP.

  Technology Stack
-Backend
-Java 21
-Spring Boot
-Vaadin admin UI
-Spring Security
-JWT
-PostgreSQL
-Flyway
-JPA / Hibernate
-Maven
-JUnit
  
  Mobile
-React Native
-Expo
-TypeScript
  
  Infrastructure
-Docker
-Docker Compose
-PostgreSQL container

  Development Rules
-Do not implement large parts of the app in one step.
-Work by small tasks.
-Every important business rule must be documented.
-Salary calculation logic must have tests.
-API changes must be reflected in docs/API.md.
-Codex agents must follow AGENTS.md.

  First MVP Scope
The first MVP should include:

-user registration
-user login
-roles: WORKER, FOREMAN, ADMIN
-foreman creates a shift session
-worker joins a shift session
-shift has start time and end time
-break time can be added
-salary is calculated from worked time and hourly rate
-worker can see own shift history
-foreman can see shift summary


1. README.md — що це за проєкт.
2. AGENTS.md — головні правила для Codex.
3. docs/SPEC.md — що має робити застосунок.
4. docs/API.md — як mobile буде говорити з backend.
5. docs/TASKS.md — що робити по черзі.
6. backend/AGENTS.md — правила для backend-агента.
7. mobile/AGENTS.md — правила для mobile-агента.
8. infra/AGENTS.md — правила для Docker/deploy.
