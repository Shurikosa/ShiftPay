# ShiftPay Backend Agent Instructions

This directory contains the ShiftPay backend.

The backend should be implemented with Spring Boot.

## Technology Stack

Use:

- Java 21
- Spring Boot
- Maven
- Spring Web
- Spring Security
- JWT
- Spring Data JPA
- PostgreSQL
- Flyway
- Validation
- Lombok
- JUnit
- Testcontainers if needed

## Main Backend Responsibilities

The backend is responsible for:

- authentication
- authorization
- user management
- shift session management
- worker attendance
- salary calculation
- reports API

## Package Structure

Use this package structure:

  config
  controller
  dto
  entity
  exception
  mapper
  repository
  security
  service
Layer Rules

Controllers:

only handle HTTP
validate request DTOs
call services
return response DTOs

Services:

contain business logic
should be testable
should not depend on HTTP classes

Repositories:

only database access

Entities:

represent database tables
should not be returned directly from controllers

DTOs:

used for API requests and responses
Salary Calculation Rules

Salary calculation is critical.

Use BigDecimal for money.

Do not use double or float for salary.

Basic formula:

worked_minutes = end_time - start_time - break_minutes
salary = worked_minutes / 60 * hourly_rate

Rules:

worked minutes cannot be negative
break minutes cannot be greater than shift duration
salary cannot be negative
salary calculation must have unit tests
hourly rate should be stored in attendance record
Database Rules

Use Flyway migrations.

Migration directory:

src/main/resources/db/migration/

Migration naming:

V1__create_users_table.sql
V2__create_roles_table.sql
V3__create_shift_sessions_table.sql

Do not change existing migration files after they are committed.

Create new migration files instead.

Security Rules

Passwords must be hashed.

Do not store plain text passwords.

Use JWT for authentication.

Use role-based authorization.

Endpoints should be protected by role where needed.

Testing Rules

Add tests for:

authentication
shift lifecycle
salary calculation
invalid break duration
authorization rules

Before finishing backend work, run:

./mvnw test

If this command cannot run, explain why.

Files You May Change

For backend tasks, you may change:

backend/
docs/API.md
docs/SPEC.md
docs/ARCHITECTURE.md
docs/TASKS.md

Only change other modules if the task explicitly requires it.

Definition of Done

Backend task is done when:

project compiles
tests pass or reason is documented
public API is documented
business rules are tested
no unrelated module was changed
