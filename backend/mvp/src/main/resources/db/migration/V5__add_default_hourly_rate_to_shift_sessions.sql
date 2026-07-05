alter table shift_sessions
    add column default_hourly_rate numeric(12, 2);

update shift_sessions
set default_hourly_rate = 0.00
where default_hourly_rate is null;

alter table shift_sessions
    alter column default_hourly_rate set not null;

alter table shift_sessions
    add constraint ck_shift_sessions_default_hourly_rate check (default_hourly_rate >= 0);
