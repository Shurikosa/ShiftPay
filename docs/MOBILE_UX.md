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
- fast shift joining for workers
- clear managed-shift visibility for foremen
- readable shift status and salary information
- simple forms with obvious success and error states

The MVP should feel like a practical workforce tool, not a marketing site.

## 2. Target Users

### Worker

Workers use the app to join a shift, see their attendance status, and review
worked time and salary after a shift closes.

Worker tasks:

- register and log in
- join a shift with a join code
- see current and past joined shifts
- see shift status, attendance status, worked minutes, and calculated salary

### Foreman

Foremen use the app to create and manage shifts, approve worker attendance, and
review shift summary after closing a shift.

Foreman tasks:

- register and log in
- create a shift
- see shifts they created and manage
- share the join code with workers
- approve joined workers
- start and close shifts
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

### Worker Flow

- `WorkerDashboardScreen`
- `JoinShiftScreen`
- `MyShiftHistoryScreen`
- `WorkerShiftDetailsScreen`

Worker navigation is centered on joining a shift and reading personal attendance
history from `GET /api/v1/me/shifts`.

### Foreman Flow

- `ForemanDashboardScreen`
- `CreateShiftScreen`
- `ForemanShiftDetailsScreen`
- `ShiftSummaryScreen`

The foreman shift details screen can contain attendance as a section or navigate
to a dedicated attendance list screen if the implementation becomes clearer.

Foreman navigation is centered on managed shifts from
`GET /api/v1/me/managed-shifts`.

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
- show backend validation and duplicate-email errors clearly

### WorkerDashboardScreen

Purpose:

- show the worker's most relevant shift status and quick actions

Content:

- current user name
- primary action to join a shift
- shortcut to shift history
- recent joined shifts if available

API calls:

- `GET /api/v1/users/me`
- `GET /api/v1/me/shifts`

Empty state:

- no joined shifts yet
- clear action to join by code

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
- show duplicate join, unknown code, forbidden, and closed/non-open shift errors

### MyShiftHistoryScreen

Purpose:

- list shifts where the current user has a worker attendance record

Content:

- shift title
- location
- shift status
- attendance status
- planned or actual date/time
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
- shift status
- attendance status
- planned and actual start/end times
- hourly rate snapshot
- break minutes
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
- primary action to create a shift
- managed shift list
- status labels for `OPEN`, `ACTIVE`, and `CLOSED`

API calls:

- `GET /api/v1/users/me`
- `GET /api/v1/me/managed-shifts`

Rules:

- this screen should not use `GET /api/v1/me/shifts`
- ADMIN users may use the same route only for shifts they personally created
  during the MVP

### CreateShiftScreen

Purpose:

- let a foreman create a new shift

Fields:

- title
- location
- planned start time
- planned end time
- default break minutes
- default hourly rate

Actions:

- create shift

API calls:

- `POST /api/v1/shifts`
- refresh `GET /api/v1/me/managed-shifts` after success

Rules:

- default hourly rate is required
- planned end time must be after planned start time
- default break minutes cannot be negative

### ForemanShiftDetailsScreen

Purpose:

- manage one foreman-created shift

Content:

- shift details
- join code
- status
- attendance list
- lifecycle actions

Actions:

- approve joined worker
- start shift
- close shift
- open summary for closed shifts

API calls:

- `GET /api/v1/shifts/{shiftId}`
- `GET /api/v1/shifts/{shiftId}/attendance`
- `POST /api/v1/shifts/{shiftId}/attendance/{attendanceId}/approve`
- `POST /api/v1/shifts/{shiftId}/start`
- `POST /api/v1/shifts/{shiftId}/close`

Rules:

- approve is available only for `JOINED` attendance while the shift is `OPEN`
- start is available only while the shift is `OPEN`
- close is available only while the shift is `ACTIVE`
- summary is available only after the shift is `CLOSED`

### ShiftSummaryScreen

Purpose:

- show final results for a closed foreman-managed shift

Content:

- total workers
- total salary
- worker rows with worked minutes and calculated salary

API calls:

- `GET /api/v1/shifts/{shiftId}/summary`

Rules:

- show a clear message if the shift is not closed yet
- do not recalculate salary on the client

## 6. Shared States

### Loading

Use loading states when:

- restoring a session
- submitting login/register forms
- loading dashboards
- joining a shift
- creating, starting, closing, or approving a shift

### Empty

Use empty states when:

- worker has no joined shifts
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
- attendance approval
- shift start
- shift close

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
- Do not hardcode backend URLs inside screens.
- REST API is the source of truth.
- Do not calculate salary on the client.
- The mobile app should consume persisted `workedMinutes` and
  `calculatedSalary` values returned by the backend.
- If an API endpoint is missing or unclear, update `docs/API.md` before building
  against assumptions.
