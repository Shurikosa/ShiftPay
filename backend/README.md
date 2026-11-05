# ShiftPay Backend

Spring Boot REST API for the ShiftPay MVP.

## Requirements

- JDK 21 or newer
- Docker and Docker Compose
- Maven wrapper from `backend/mvp/mvnw`

Use a Java 21 installation for the release test gate:

```bash
JAVA_HOME=/path/to/jdk-21 ./mvnw test
```

## Start PostgreSQL

From the repository root:

```bash
docker compose -f backend/docker-compose.yml up -d postgres
```

This starts PostgreSQL on `localhost:5432` with:

- database: `shiftpay`
- user: `shiftpay`
- password: `shiftpay`

Stop it with:

```bash
docker compose -f backend/docker-compose.yml down
```

## Run The Backend Locally

From `backend/mvp`:

```bash
JAVA_HOME=/path/to/jdk-21 ./mvnw spring-boot:run
```

The default application config connects to the local Docker PostgreSQL database.
Flyway runs migrations automatically, and Hibernate validates the schema.

For local development, set a non-default JWT secret when needed:

```bash
JWT_SECRET=replace-with-a-long-local-secret JAVA_HOME=/path/to/jdk-21 ./mvnw spring-boot:run
```

Health check:

```bash
curl http://localhost:8080/api/v1/health
```

Swagger UI:

```text
http://localhost:8080/swagger-ui/index.html
```

The OpenAPI JSON is available at:

```text
http://localhost:8080/v3/api-docs
```

Use the Swagger UI `Authorize` button with a JWT access token from
`POST /api/v1/auth/login`. Business endpoints still require the same JWT and
role permissions as direct API calls.

Password recovery uses `POST /api/v1/auth/password-reset/request` and
`POST /api/v1/auth/password-reset/confirm`. For non-development deployments,
set `SHIFTPAY_PASSWORD_RESET_DIGEST_SECRET` to an independent, strong secret.
Set `SHIFTPAY_EMAIL_SMTP_ENABLED=true` and configure `SMTP_*` plus
`SHIFTPAY_EMAIL_FROM` for real delivery; disabled delivery still returns the
generic public 202 but makes the request unusable. If a reverse proxy supplies
`X-Forwarded-For`, set `SHIFTPAY_PASSWORD_RESET_TRUSTED_PROXIES` to a
comma-separated list of the proxy IP addresses. Forwarded headers from other
peers are ignored. Verify actual inbox delivery before release.

## Run Tests

From `backend/mvp`:

```bash
JAVA_HOME=/path/to/jdk-21 ./mvnw test
```

Tests use the test profile configuration in `src/test/resources/application.yaml`
with H2 in PostgreSQL compatibility mode and Flyway migrations enabled.

## Validate Against PostgreSQL

Start PostgreSQL, then from `backend/mvp` run:

```bash
JAVA_HOME=/path/to/jdk-21 ./mvnw spring-boot:run
```

Startup confirms Flyway migration and Hibernate schema validation against the
local PostgreSQL database. Stop the app after startup if you only need schema
validation.
