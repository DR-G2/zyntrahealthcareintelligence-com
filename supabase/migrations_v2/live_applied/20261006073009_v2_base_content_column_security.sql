revoke all on public.questions from anon, authenticated;
grant select (id,zyntra_id,subject_id,subtopic_id,stem,options,explanation,difficulty_tier,status,version) on public.questions to authenticated;

revoke all on public.clinical_stations from anon, authenticated;
grant select (id,zyntra_id,subject,scenario_title,candidate_instructions,scenario_data,reading_time_minutes,station_time_minutes,status,version) on public.clinical_stations to authenticated;