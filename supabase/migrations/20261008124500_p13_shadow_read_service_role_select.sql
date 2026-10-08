-- P13 read path requires service_role SELECT on the protected shadow table.
-- No authenticated/anon access is granted.
GRANT SELECT ON TABLE pie.inference_shadow TO service_role;
