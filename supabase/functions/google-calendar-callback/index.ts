import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return new Response("Missing code or state", { status: 400 });
    }

    let userId: string | null = null;
    let redirectTo: string | null = null;

    try {
      const parsed = JSON.parse(atob(state));
      userId = typeof parsed?.userId === "string" ? parsed.userId : null;
      redirectTo = typeof parsed?.redirectTo === "string" ? parsed.redirectTo : null;
    } catch {
      userId = state;
    }

    if (!userId) {
      return new Response("Invalid state", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
      console.error("Missing Google Calendar OAuth env", {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
      });
      return new Response("Google Calendar OAuth is not configured", { status: 500 });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenData);
      return new Response(`Token exchange failed: ${JSON.stringify(tokenData)}`, { status: 400 });
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    if (!access_token || !expires_in) {
      console.error("Token exchange returned incomplete payload:", tokenData);
      return new Response("Google did not return a usable access token", { status: 400 });
    }

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store tokens using service role
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // Google may omit refresh_token on repeat consent flows. Keep the old refresh token
    // instead of overwriting the connection with an unusable value.
    const { data: existingToken } = await supabase
      .from("google_calendar_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    const refreshTokenToStore = refresh_token || existingToken?.refresh_token;
    if (!refreshTokenToStore) {
      console.error("Missing Google refresh token for new calendar connection");
      return new Response(
        "Google did not return a refresh token. Please remove the app from your Google Account permissions, then connect again.",
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("google_calendar_tokens")
      .upsert({
        user_id: userId,
        access_token,
        refresh_token: refreshTokenToStore,
        expires_at: expiresAt,
      }, { onConflict: "user_id" });

    if (error) {
      console.error("DB error:", error);
      return new Response("Failed to store tokens", { status: 500 });
    }

    // Redirect back to the app
    const appUrl = redirectTo || Deno.env.get("APP_URL") || "https://evidenceoflife.lovable.app";
    const destination = new URL(appUrl);
    destination.searchParams.set("gcal", "connected");

    return new Response(null, {
      status: 302,
      headers: { Location: destination.toString() },
    });
  } catch (error) {
    console.error("Callback error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
