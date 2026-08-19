# ShiftPay Mobile UX

This document defines the practical UX plan for the ShiftPay mobile MVP.

It is not a final visual design system and does not replace `docs/TASKS.md`.
`docs/TASKS.md` remains the backlog and milestone tracker. This document gives
the mobile agent enough screen, navigation, and interaction detail to implement
Milestone 7 and Milestone 8 without inventing product flow.

## 1. Mobile UX Goal

The mobile app should help workers and foremen complete shift workflows quickly
on a phone.

The app should prioritize:

- clear login and registration
- company onboarding for foremen and workers
- fast shift joining for workers
- clear managed-shift visibility for foremen
- clear pause and cancellation status
- readable shift status and salary information
- simple forms with obvious success and error states

The MVP should feel like a practical workforce tool, not a marketing site.

## 2. Target Users

### Worker

Workers use the app to join a shift, see their attendance status, and review
worked time and salary after a shift closes.

Worker tasks:

- register and log in
- join a company by company join code
- join a shift with a join code
- see current and past joined shifts
- see company name in the dashboard or main menu
- see shift status, attendance status, pause status, worked minutes, and calculated salary

### Foreman

Foremen use the app to create and manage shifts, approve worker attendance, and
review worker and private foreman salary summary after closing a shift.

Foreman tasks:

- register and log in
- create a company if they do not have one
- create a shift
- see shifts they created and manage
- see company name in the dashboard or main menu
- share the join code with workers
- approve joined workers
- start, cancel, and close shifts
- pause themselves or pause everyone during an active shift
- see closed-shift summary

Admin users are not a mobile MVP target. Admin user management is deferred to
the Vaadin admin dashboard.

## 3. Design Principles

- Use a mobile-first layout.
- Use large touch targets and readable text.
- Keep forms simple and predictable.
- Make shift status visible wherever a shift appears.
- Show loading, empty, error, and success states for network workflows.
- Use neutral, professional colors with strong contrast.
- Use cards only for repeated shift list items.
- Do not create a landing page, marketing hero, or decorative onboarding.
- Do not put business logic in UI components.
- Screens should use the typed API client rather than calling `fetch` directly.

## 4. Navigation Model

### Unauthenticated Flow

- `LoginScreen`
- `RegisterScreen`

The app opens in this flow when no valid session is available.

On app start:

1. Load the stored token through the session storage abstraction.
2. If a token exists, call `GET /api/v1/users/me`.
3. If the token is valid, route by user role.
4. If the token is missing or invalid, clear the session and show login.

JWT/session expiration stays enabled. For the MVP, the backend default
session lifetime should be 8 hours. The app should restore valid sessions
automatically through `GET /api/v1/users/me`.

Future biometric unlock or refresh-token/long-lived session support can be
added later.

### Worker Flow

- `WorkerDashboardScreen`
- `CompanyJoinScreen`
- `JoinShiftScreen`
- `MyShiftHistoryScreen`
- `WorkerShiftDetailsScreen`

Worker navigation is centered on joining a shift and reading personal attendance
history from `GET /api/v1/me/shifts`. A worker who does not belong to a company
should be routed to company join before shift join.

### Foreman Flow

- `ForemanDashboardScreen`
- `CompanyCreateScreen`
- `CreateShiftScreen`
- `ForemanShiftDetailsScreen`
- `ShiftSummaryScreen`

The foreman shift details screen can contain attendance as a section or navigate
to a dedicated attendance list screen if the implementation becomes clearer.

Foreman navigation is centered on managed shifts from
`GET /api/v1/me/managed-shifts`. A foreman who does not have a company should
be routed to company creation before shift creation or shift start.

## 5. Screens

### LoginScreen

Purpose:

- authenticate an existing user
- restore role-based navigation after successful login

Fields:

- email
- password

Actions:

- log in
- navigate to register

API calls:

- `POST /api/v1/auth/login`
- after login, store the returned token and user
- restore later sessions through `GET /api/v1/users/me`

States:

- loading while submitting
- field validation error
- invalid credentials error
- generic network error

### RegisterScreen

Purpose:

- create a `WORKER` or `FOREMAN` account

Fields:

- first name
- last name
- email
- password
- role selection: `WORKER` or `FOREMAN`

Actions:

- register
- return to login

API calls:

- `POST /api/v1/auth/register`
- after successful registration, either return to login or log in through the
  existing login flow

Rules:

- do not allow `ADMIN` registration in the mobile UI
- after FOREMAN registration/login, prompt company creation if no company exists
- after WORKER registration/login, prompt company join if no company exists
- show backend validation and duplicate-email errors clearly

### CompanyCreateScreen

Purpose:

- let a foreman create their company before creating shifts

Fields:

- company name

Actions:

- create company

API calls:

- `POST /api/v1/companies`
- refresh `GET /api/v1/users/me` after success

Rules:

- only FOREMAN uses this screen
- FOREMAN cannot create or start shifts before company creation
- show company join code after creation so it can be shared with workers

### CompanyJoinScreen

Purpose:

- let a worker join a company before joining shifts

Fields:

- company join code

Actions:

- join company

API calls:

- `POST /api/v1/companies/join`
- refresh `GET /api/v1/users/me` after success

Rules:

- only WORKER uses this screen
- normalize company join code visually as uppercase if practical
- WORKER cannot join a shift before joining that shift's company

### WorkerDashboardScreen

Purpose:

- show the worker's most relevant shift status and quick actions

Content:

- current user name
- company name when joined
- primary action to join a shift
- shortcut to shift history
- recent joined shifts if available
- pause status if the worker has an active joined shift:
  worker paused, global pause active, or not paused

API calls:

- `GET /api/v1/users/me`
- `GET /api/v1/me/shifts`

Empty state:

- no joined shifts yet
- clear action to join by code
- no company yet
- clear action to join company by company join code

### JoinShiftScreen

Purpose:

- let a worker join an open shift by join code

Fields:

- join code

Actions:

- submit join code

API calls:

- `POST /api/v1/shifts/join`
- refresh `GET /api/v1/me/shifts` after success

Rules:

- normalize user input visually as uppercase if practical
- worker never enters or edits hourly rate
- worker must already belong to the shift's company
- show duplicate join, unknown code, forbidden, and closed/non-open shift errors

### MyShiftHistoryScreen

Purpose:

- list shifts where the current user has a worker attendance record

Content:

- shift title
- location
- company name
- shift status
- attendance status
- pause status when active
- actual date/time when available
- salary when calculated

API calls:

- `GET /api/v1/me/shifts`

Rules:

- this screen is worker attendance history
- do not use it as foreman managed-shift history

### WorkerShiftDetailsScreen

Purpose:

- show details for one joined shift from the worker perspective

Content:

- shift title and location
- company name
- shift status
- attendance status
- whether worker is paused or global pause is active
- actual start/end times when available
- hourly rate snapshot
- break minutes
- pause minutes when available
- worked minutes
- calculated salary

API calls:

- can use selected item data from `GET /api/v1/me/shifts`
- may refresh history if needed

### ForemanDashboardScreen

Purpose:

- show shifts created and managed by the current foreman

Content:

- current user name
- company name
- primary action to create a shift
- managed shift list
- status labels for `OPEN`, `ACTIVE`, and `CLOSED`
- global pause and foreman self pause status for active shifts

API calls:

- `GET /api/v1/users/me`
- `GET /api/v1/me/managed-shifts`

Rules:

- if no company exists, route FOREMAN to `CompanyCreateScreen`
- this screen should not use `GET /api/v1/me/shifts`
- ADMIN users may use the same route only for shifts they personally created
  during the MVP

### CreateShiftScreen

Purpose:

- let a foreman create a new shift

Fields:

- location
- default break minutes
- default hourly rate
- foreman hourly rate

Actions:

- create shift

API calls:

- `POST /api/v1/shifts`
- refresh `GET /api/v1/me/managed-shifts` after success

Rules:

- require a company before this screen is available
- do not show title input for the mobile MVP
- do not show planned start or planned end time inputs for the mobile MVP
- the backend generates the shift title from date/time and company name
- exact generated title locale/format can be refined during backend implementation
- default hourly rate is required
- foreman hourly rate is required
- default break minutes is optional and defaults to 0 in the backend
- dynamic pauses are the primary MVP break-tracking mechanism
- default break minutes cannot be negative when entered

### ForemanShiftDetailsScreen

Purpose:

- manage one foreman-created shift

Content:

- shift details
- company name
- join code
- status
- default break minutes
- default hourly rate for workers
- foreman hourly rate, visible only to the owner foreman
- actual start/end times when available
- global pause status
- foreman self pause status
- worker pause status in attendance rows
- attendance list
- lifecycle actions

Actions:

- approve joined worker
- start shift
- cancel shift before start
- close shift
- start/stop foreman self pause
- start/stop global pause for everyone
- open summary for closed shifts

API calls:

- `GET /api/v1/shifts/{shiftId}`
- `GET /api/v1/shifts/{shiftId}/attendance`
- `POST /api/v1/shifts/{shiftId}/attendance/{attendanceId}/approve`
- `POST /api/v1/shifts/{shiftId}/start`
- `POST /api/v1/shifts/{shiftId}/cancel`
- `POST /api/v1/shifts/{shiftId}/close`
- planned pause endpoints under `POST /api/v1/shifts/{shiftId}/pauses/...`

Rules:

- approve is available only for `JOINED` attendance while the shift is `OPEN`
- start is available only while the shift is `OPEN`
- cancel is available only while the shift is `OPEN`
- close is available only while the shift is `ACTIVE`
- summary is available only after the shift is `CLOSED`
- actualStartTime and actualEndTime are set by the backend
- do not calculate worker or foreman salary on the client
- cancelled shifts should show CANCELLED status and no salary summary action
- pause controls are available only while the shift is `ACTIVE`
- do not calculate pause-adjusted salary on the client

### ShiftSummaryScreen

Purpose:

- show final results for a closed foreman-managed shift

Content:

- total workers
- total worker salary
- worker rows with worked minutes and calculated salary
- worker pause minutes when available
- private foreman salary fields for the owner foreman:
  foremanWorkedMinutes, foremanHourlyRate, foremanSalary

API calls:

- `GET /api/v1/shifts/{shiftId}/summary`

Rules:

- show a clear message if the shift is not closed yet
- do not recalculate worker or foreman salary on the client
- worker rows are based only on approved worker attendance
- backend salary already subtracts static break minutes and accumulated pause minutes
- do not show foreman salary fields to workers
- ADMIN users are not a mobile MVP target and should not receive foreman salary fields through REST/mobile API

## 6. Shared States

### Loading

Use loading states when:

- restoring a session
- submitting login/register forms
- loading dashboards
- creating or joining a company
- joining a shift
- creating, starting, cancelling, closing, pausing, resuming, or approving a shift

### Empty

Use empty states when:

- worker has no joined shifts
- worker has not joined a company
- foreman has not created a company
- foreman has no managed shifts
- attendance list has no joined workers

Each empty state should include one clear next action when an action is available.

### Error

Show backend error messages when they are safe and useful, for example validation,
duplicate email, invalid credentials, duplicate join, forbidden, or shift state
conflicts.

Use a generic fallback for network failures.

### Success

Show success feedback for:

- registration
- login
- shift join
- shift creation
- company creation
- company join
- attendance approval
- shift start
- shift cancel
- shift close
- pause start/stop

## 7. Basic Visual Direction

- Use a clean, restrained interface for repeated daily use.
- Prefer white or near-white surfaces with dark readable text.
- Use one strong accent color for primary actions.
- Use distinct status colors for shift and attendance states.
- Keep typography compact but readable.
- Use consistent spacing.
- Use cards for shift rows and worker rows.
- Avoid decorative backgrounds, hero sections, and marketing copy.

## 8. Out Of Scope For Mobile MVP

- offline sync
- push notifications
- biometric unlock
- refresh-token or long-lived session
- GPS tracking
- QR code scanning
- PDF export
- admin screens
- payroll/tax calculations
- chat or messaging

## 9. Implementation Notes

- Use React Native, Expo, and TypeScript.
- Keep API calls in `src/api/`.
- Keep screen components focused on UI state and user interaction.
- Store auth/session state through a storage abstraction.
- Keep token expiration handling; do not assume tokens never expire.
- Restore sessions through `GET /api/v1/users/me`.
- Do not hardcode backend URLs inside screens.
- REST API is the source of truth.
- Do not calculate salary on the client.
- The mobile app should consume persisted `workedMinutes` and
  `calculatedSalary` values returned by the backend.
- The mobile app should show pause status and pause minutes from the backend,
  but should not calculate pause-adjusted salary.
- If an API endpoint is missing or unclear, update `docs/API.md` before building
  against assumptions.
