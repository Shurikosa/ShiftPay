# ShiftPay global instructions

This is a monorepo for ShiftPay.

Main modules:
- backend: Spring Boot API
- mobile: React Native app
- web-admin: admin dashboard
- docs: specifications and architecture
- infra: Docker and deployment

Do not make unrelated changes across modules.
If working in one module, avoid changing other modules unless the task explicitly requires it.
Update docs when public API or business rules change.
