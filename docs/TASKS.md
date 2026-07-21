# ShiftPay Tasks

This file is the development backlog for the MVP.

Do not work on many tasks at the same time.

Each Codex session should take one small task from this file.

## Milestone 0: Project Setup

- [x] Create monorepo structure
- [x] Add root `README.md`
- [x] Add root `AGENTS.md`
- [x] Add `docs/SPEC.md`
- [x] Add `docs/API.md`
- [x] Add `docs/ARCHITECTURE.md`
- [x] Add `.gitignore`
- [ ] Create initial Git commit

## Milestone 1: Backend Foundation

- [x] Create Spring Boot project in `backend/`
- [x] Use Java 21
- [x] Use Maven
- [x] Add Spring Web
- [x] Add Spring Data JPA
- [x] Add PostgreSQL driver
- [x] Add Flyway
- [x] Add Validation
- [x] Add Lombok
- [x] Add Spring Security
- [x] Add basic health endpoint
- [x] Add test that application context starts

## Milestone 2: Database Foundation

- [x] Add Docker Compose for PostgreSQL
- [x] Configure backend database connection
- [x] Create Flyway migration for users
- [x] Model roles in the users migration with enum/check constraint
- [x] Create Flyway migration for companies
- [x] Create Flyway migration for shift sessions
- [x] Create Flyway migration for attendance

## Milestone 3: Authentication

- [x] Implement user registration
- [x] Hash passwords
- [x] Implement login
- [x] Generate JWT access token
- [x] Add role-based authorization
- [x] Add current user endpoint
- [x] Add authentication tests

## Milestone 4: Shift Sessions

- [x] Implement shift creation
- [x] Generate join code
- [x] Implement shift status
- [x] Implement start shift
- [x] Implement close shift
- [x] Add validation rules
- [x] Add tests for shift lifecycle

## Milestone 5: Attendance

- [x] Worker joins shift by code
- [x] Foreman approves worker
- [x] Store hourly rate
- [x] Store attendance status
- [x] Add attendance tests

## Milestone 6: Salary Calculation

- [x] Implement worked minutes calculation
- [x] Implement break deduction
- [x] Implement salary calculation
- [x] Prevent negative salary
- [x] Prevent invalid break duration
- [x] Use BigDecimal for money
- [x] Add unit tests for salary calculation

## Milestone 6.5: Backend API Contract Stabilization

- [x] Implement worker shift history endpoint
- [x] Implement foreman/admin shift summary endpoint
- [x] Document implemented backend API contract
- [x] Add backend local run instructions
- [x] Add Swagger/OpenAPI documentation for backend MVP
- [x] Decide whether managed foreman-created shifts should appear in a separate foreman history endpoint
- [x] Decide whether ADMIN user management is needed before or after mobile MVP

Decisions:

- Managed foreman-created shifts should use a separate endpoint. `GET /api/v1/me/shifts` remains worker attendance history only.
- Planned endpoint: `GET /api/v1/me/managed-shifts`.
- ADMIN user management is deferred until after the mobile MVP and should be implemented as part of the Vaadin admin dashboard work.

Follow-up backend task:

- [ ] Implement `GET /api/v1/me/managed-shifts` for the Foreman mobile dashboard

## Milestone 7: Mobile Foundation

- [ ] Create React Native / Expo project in `mobile/`
- [ ] Add TypeScript
- [ ] Add navigation
- [ ] Add API client structure
- [ ] Add environment configuration
- [ ] Create login screen
- [ ] Create register screen

## Milestone 8: Mobile MVP Screens

- [ ] Worker dashboard
- [ ] Foreman dashboard
- [ ] Join shift screen
- [ ] Create shift screen
- [ ] Shift details screen
- [ ] Shift summary screen
- [ ] My shift history screen

## Milestone 9: Infrastructure

- [ ] Add Docker Compose for PostgreSQL
- [ ] Add backend Dockerfile
- [ ] Add local development compose file
- [ ] Add README instructions for running locally

## Milestone 10: Web Admin

This is optional for first MVP.

Admin dashboard is planned as Vaadin UI inside the backend Spring Boot application.
A separate `web-admin/` project is no longer planned for the MVP.

- [ ] Add Vaadin dependency to `backend/`
- [ ] Configure Vaadin routes and ADMIN role security
- [ ] Create admin layout
- [ ] Add admin login/access behavior if needed
- [ ] Add users admin view
- [ ] Implement ADMIN user management after mobile MVP
- [ ] Add shifts admin view
- [ ] Add reports/admin summary view
