alter table shift_sessions
    drop constraint ck_shift_sessions_status;

alter table shift_sessions
    add column discarded_at timestamp with time zone;

alter table shift_sessions
    add column discarded_by bigint;

alter table shift_sessions
    add column discard_reason varchar(64);

alter table shift_sessions
    add constraint fk_shift_sessions_discarded_by foreign key (discarded_by) references users (id);

alter table shift_sessions
    add constraint ck_shift_sessions_status check (
        status in ('CREATED', 'OPEN', 'ACTIVE', 'CLOSED', 'DISCARDED', 'CANCELLED')
    );

alter table shift_sessions
    add constraint ck_shift_sessions_discard_audit check (
        (
            status = 'DISCARDED'
            and discarded_at is not null
            and discarded_by is not null
            and discard_reason is not null
            and actual_end_time is not null
        )
        or (
            status <> 'DISCARDED'
            and discarded_at is null
            and discarded_by is null
            and discard_reason is null
        )
    );
