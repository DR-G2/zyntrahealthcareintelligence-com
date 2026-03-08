
-- Allow users to delete their own data for account reset
CREATE POLICY "Users can delete own attempts" ON public.user_attempts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own performance" ON public.performance_profiles FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress" ON public.user_progress FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plans" ON public.study_plans FOR DELETE USING (auth.uid() = user_id);
