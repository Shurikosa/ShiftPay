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

Web admin work for the MVP should be done inside the backend Spring Boot application using Vaadin.
Do not create a separate web-admin React, Vue, or Angular project for the MVP unless the user explicitly changes direction.
If admin UI work changes backend services, REST API behavior, security, or business rules, update the relevant docs and tests.
