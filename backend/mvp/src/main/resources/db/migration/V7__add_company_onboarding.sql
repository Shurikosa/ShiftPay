alter table companies
    add column join_code varchar(32);

update companies
set join_code = 'CMP' || cast(id as varchar)
where join_code is null;

alter table companies
    alter column join_code set not null;

alter table companies
    add constraint uq_companies_join_code unique (join_code);

alter table users
    add column company_id bigint;

alter table users
    add constraint fk_users_company_id foreign key (company_id) references companies (id);

create index idx_users_company_id on users (company_id);
