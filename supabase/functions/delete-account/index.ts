import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Du må være logget inn." }, 401);
  }

  let body: { confirmation?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ugyldig forespørsel." }, 400);
  }
  if (body.confirmation !== "SLETT") {
    return jsonResponse({ error: "Slettingen er ikke bekreftet." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Tjenesten er ikke konfigurert." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Innloggingen er utløpt. Logg inn på nytt." }, 401);
  }

  const userId = userData.user.id;
  const bucket = admin.storage.from("recipe-images");
  while (true) {
    const { data: imageFiles, error: listError } = await bucket.list(userId, { limit: 100 });
    if (listError) return jsonResponse({ error: "Kunne ikke rydde opp kontobildene." }, 500);

    const imagePaths = (imageFiles ?? [])
      .filter((file) => file.name && file.id)
      .map((file) => `${userId}/${file.name}`);
    if (imagePaths.length > 0) {
      const { error: storageError } = await bucket.remove(imagePaths);
      if (storageError) return jsonResponse({ error: "Kunne ikke slette kontobildene." }, 500);
    }
    if ((imageFiles ?? []).length < 100) break;
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false);
  if (deleteError) return jsonResponse({ error: "Kontoen kunne ikke slettes." }, 500);

  return jsonResponse({ deleted: true });
});
