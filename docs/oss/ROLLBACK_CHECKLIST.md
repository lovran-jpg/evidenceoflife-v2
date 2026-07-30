# Rollback Checklist — P1 Security Changes

Rollback procedures if a P1 change causes problems after deployment. Applying
any of these to production requires maintainer (Willow) approval.

## 1. Storage privacy (moment-photos)

Symptom: images fail to load for legitimate owners.

- First response: confirm the frontend is minting signed URLs
  (`resolveMomentPhotoUrl`) and that `SUPABASE_ANON_KEY`/session is valid.
- Emergency rollback (last resort, re-exposes photos publicly):
  ```sql
  UPDATE storage.buckets SET public = true WHERE id = 'moment-photos';
  DROP POLICY IF EXISTS "Users can view their own moment photos" ON storage.objects;
  CREATE POLICY "Moment photos are publicly accessible"
    ON storage.objects FOR SELECT USING (bucket_id = 'moment-photos');
  ```
  Note: this reverts the privacy hardening; only use to restore availability
  while investigating, then re-apply the private policy.

## 2. Calendar token policies

Symptom: calendar connect/sync breaks.

- The callback writes tokens with the service role, which bypasses RLS, so
  dropping user policies should not break the callback. If needed, restore the
  prior user policies:
  ```sql
  CREATE POLICY "Users can insert their own tokens" ON public.google_calendar_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users can update their own tokens" ON public.google_calendar_tokens
    FOR UPDATE USING (auth.uid() = user_id);
  CREATE POLICY "Users can delete their own tokens" ON public.google_calendar_tokens
    FOR DELETE USING (auth.uid() = user_id);
  ```

## 3. OAuth state signing

Symptom: calendar connect fails at callback with "Invalid or expired state".

- Confirm `OAUTH_STATE_SECRET` (or `GOOGLE_CLIENT_SECRET`) is set identically
  for both `google-calendar-auth` and `google-calendar-callback`.
- Confirm `APP_URL` / `ALLOWED_REDIRECT_ORIGINS` include the real app origin.
- Rollback: redeploy the previous function versions
  (`google-calendar-auth`, `google-calendar-callback`, `_shared/auth.ts`) from
  the last known-good tag. Do not disable state verification as a workaround.

## 4. Edge-function auth / image-proxy

Symptom: images via `image-proxy` return 401/403 for legitimate users.

- Confirm the request includes the anon `apikey` and originates from an origin
  in `APP_URL` / `ALLOWED_REDIRECT_ORIGINS`.
- Rollback: redeploy the previous `image-proxy` and `_shared/auth.ts`.

## General

- Prefer redeploying a previous known-good function version over disabling a
  security check.
- Record any rollback taken, the reason, and the follow-up fix.
