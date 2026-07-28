import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const demoUsers = [
  { email: "admin@ecofresh.com", password: "Admin123!", fullName: "EcoFresh Admin", role: "admin" },
  { email: "staff@ecofresh.com", password: "Staff123!", fullName: "EcoFresh Staff", role: "staff" },
  { email: "customer@ecofresh.com", password: "Customer123!", fullName: "EcoFresh Customer", role: "customer" },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const results = [];

    for (const u of demoUsers) {
      // Check if user already exists
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((x: { email?: string }) => x.email === u.email);

      let userId: string;

      if (found) {
        userId = found.id;
        results.push({ email: u.email, status: "already_exists", id: userId });
      } else {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName, role: u.role },
        });

        if (createErr) {
          results.push({ email: u.email, status: "error", error: createErr.message });
          continue;
        }

        userId = created.user.id;
        results.push({ email: u.email, status: "created", id: userId });
      }

      // Upsert profile
      const { error: profileErr } = await supabase
        .from("user_profiles")
        .upsert(
          { id: userId, email: u.email, full_name: u.fullName, role: u.role },
          { onConflict: "id" }
        );

      if (profileErr) {
        results.push({ email: u.email, status: "profile_error", error: profileErr.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
