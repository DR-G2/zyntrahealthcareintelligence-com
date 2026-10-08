delete from pie.security_event where user_id is null;
delete from pie.security_incident where user_id is null;
delete from pie.security_enforcement where user_id is null;

alter table pie.security_event alter column user_id set not null;
alter table pie.security_incident alter column user_id set not null;
alter table pie.security_enforcement alter column user_id set not null;
