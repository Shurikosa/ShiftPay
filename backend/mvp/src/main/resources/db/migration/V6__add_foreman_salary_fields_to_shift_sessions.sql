alter table shift_sessions
    add column foreman_hourly_rate numeric(12, 2) not null default 0.00;

alter table shift_sessions
    add column foreman_worked_minutes integer;

alter table shift_sessions
    add column foreman_calculated_salary numeric(12, 2);

alter table shift_sessions
    add constraint ck_shift_sessions_foreman_hourly_rate check (foreman_hourly_rate >= 0);

alter table shift_sessions
    add constraint ck_shift_sessions_foreman_worked_minutes check (
        foreman_worked_minutes is null or foreman_worked_minutes >= 0
    );

alter table shift_sessions
    add constraint ck_shift_sessions_foreman_calculated_salary check (
        foreman_calculated_salary is null or foreman_calculated_salary >= 0
    );
