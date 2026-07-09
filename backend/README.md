# ShiftPay Backend

Spring Boot REST API for the ShiftPay MVP.

## Requirements

- JDK 21 or newer
- Docker and Docker Compose
- Maven wrapper from `backend/mvp/mvnw`

The current local test command uses:

```bash
JAVA_HOME=/usr/lib/jvm/java-26-openjdk ./mvnw test
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
JAVA_HOME=/usr/lib/jvm/java-26-openjdk ./mvnw spring-boot:run
```

The default application config connects to the local Docker PostgreSQL database.
Flyway runs migrations automatically, and Hibernate validates the schema.

For local development, set a non-default JWT secret when needed:

```bash
JWT_SECRET=replace-with-a-long-local-secret JAVA_HOME=/usr/lib/jvm/java-26-openjdk ./mvnw spring-boot:run
```

Health check:

```bash
curl http://localhost:8080/api/v1/health
```

## Run Tests

From `backend/mvp`:

```bash
JAVA_HOME=/usr/lib/jvm/java-26-openjdk ./mvnw test
```

Tests use the test profile configuration in `src/test/resources/application.yaml`
with H2 in PostgreSQL compatibility mode and Flyway migrations enabled.

## Validate Against PostgreSQL

Start PostgreSQL, then from `backend/mvp` run:

```bash
JAVA_HOME=/usr/lib/jvm/java-26-openjdk ./mvnw spring-boot:run
```

Startup confirms Flyway migration and Hibernate schema validation against the
local PostgreSQL database. Stop the app after startup if you only need schema
validation.
