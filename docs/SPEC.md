# ShiftPay SPEC

## Goal

ShiftPay is a cross-platform app for tracking work shifts, worked hours, and salary.

## Roles

### Worker
- can register/login
- can join a shift session
- can see own worked hours
- can see calculated salary

### Foreman
- can create a shift session
- can invite workers
- can start and close a shift
- can approve attendance
- can see salary summary for workers

### Admin
- can manage users, companies, and reports

## Shift session flow

1. Foreman creates a shift session.
2. System generates a join code.
3. Worker enters join code or scans QR code.
4. Worker joins the session.
5. Foreman starts the shift.
6. System records start time.
7. Foreman closes the shift.
8. System records end time.
9. System calculates worked time and salary.

## Salary formula

worked_minutes = end_time - start_time - break_minutes

salary = worked_minutes / 60 * hourly_rate
