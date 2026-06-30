# ShiftPay Tasks

This file is the development backlog for the MVP.

Do not work on many tasks at the same time.

Each Codex session should take one small task from this file.

## Milestone 0: Project Setup

- [ ] Create monorepo structure
- [ ] Add root `README.md`
- [ ] Add root `AGENTS.md`
- [ ] Add `docs/SPEC.md`
- [ ] Add `docs/API.md`
- [ ] Add `docs/ARCHITECTURE.md`
- [ ] Add `.gitignore`
- [ ] Create initial Git commit

## Milestone 1: Backend Foundation

- [ ] Create Spring Boot project in `backend/`
- [ ] Use Java 21
- [ ] Use Maven
- [ ] Add Spring Web
- [ ] Add Spring Data JPA
- [ ] Add PostgreSQL driver
- [ ] Add Flyway
- [ ] Add Validation
- [ ] Add Lombok
- [ ] Add Spring Security
- [ ] Add basic health endpoint
- [ ] Add test that application context starts

## Milestone 2: Database Foundation

- [ ] Add Docker Compose for PostgreSQL
- [ ] Configure backend database connection
- [ ] Create Flyway migration for users
- [ ] Create Flyway migration for roles
- [ ] Create Flyway migration for companies
- [ ] Create Flyway migration for shift sessions
- [ ] Create Flyway migration for attendance

## Milestone 3: Authentication

- [ ] Implement user registration
- [ ] Hash passwords
- [ ] Implement login
- [ ] Generate JWT access token
- [ ] Add role-based authorization
- [ ] Add current user endpoint
- [ ] Add authentication tests

## Milestone 4: Shift Sessions

- [ ] Implement shift creation
- [ ] Generate join code
- [ ] Implement shift status
- [ ] Implement start shift
- [ ] Implement close shift
- [ ] Add validation rules
- [ ] Add tests for shift lifecycle

## Milestone 5: Attendance

- [ ] Worker joins shift by code
- [ ] Foreman approves worker
- [ ] Store hourly rate
- [ ] Store attendance status
- [ ] Add attendance tests

## Milestone 6: Salary Calculation

- [ ] Implement worked minutes calculation
- [ ] Implement break deduction
- [ ] Implement salary calculation
- [ ] Prevent negative salary
- [ ] Prevent invalid break duration
- [ ] Use BigDecimal for money
- [ ] Add unit tests for salary calculation

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

- [ ] Create web-admin project
- [ ] Add login page
- [ ] Add users page
- [ ] Add shifts page
- [ ] Add reports page
