alter table companies
    add column default_worker_hourly_rate numeric(12, 2);

alter table companies
    add column default_foreman_hourly_rate numeric(12, 2);

alter table companies
    add column currency_label varchar(255);

alter table shift_sessions
    add column currency_label varchar(255);

alter table payout_requests
    add column currency_label varchar(255);
