CREATE POLICY "Authenticated users can read all stations"
ON public.clinical_stations FOR SELECT
TO authenticated
USING (true);