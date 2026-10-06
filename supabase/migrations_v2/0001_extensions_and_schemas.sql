-- Zyntra V2 migration package
-- Phase 4 / 0001: extensions and owned schemas
-- SAFE: creates only new V2 namespaces. Does not modify legacy tables.

create extension if not exists pgcrypto;

create schema if not exists intelligence;
create schema if not exists pie;
create schema if not exists amc;
create schema if not exists command;
create schema if not exists ai_lab;
create schema if not exists migration;

comment on schema intelligence is 'Derived learning intelligence. Server-managed.';
comment on schema pie is 'Exam-neutral Performance/Inference/Intelligence engine.';
comment on schema amc is 'AMC-specific adapter and validation layer.';
comment on schema command is 'Privileged administration, security and audit.';
comment on schema ai_lab is 'Server-side AI provider/session data.';
comment on schema migration is 'Temporary migration control and provenance.';
