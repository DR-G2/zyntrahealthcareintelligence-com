CREATE POLICY "Questions are readable by everyone"
ON public.questions FOR SELECT TO anon USING (true);