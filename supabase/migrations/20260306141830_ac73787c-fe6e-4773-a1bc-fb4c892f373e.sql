CREATE POLICY "Users can update their own imported events"
ON public.imported_events
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);