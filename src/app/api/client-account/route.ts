import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SUPABASE_URL, serviceRoleKey } from "@/lib/env";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Vérifie que l'appelant est bien le coach connecté et qu'il possède ce client.
 * Toutes les vérifications sont faites côté serveur.
 */
async function authorize(clientId: unknown) {
  if (typeof clientId !== "string" || !UUID.test(clientId)) return { error: fail("Client invalide.") };
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: fail("Session expirée. Reconnectez-vous.", 401) };
  if (user.app_metadata?.role === "client") return { error: fail("Action réservée au coach.", 403) };

  // RLS : ne renvoie la fiche que si elle appartient au coach connecté
  const { data: client } = await supabase.from("clients").select("id, first_name, last_name").eq("id", clientId).maybeSingle();
  if (!client) return { error: fail("Client introuvable.", 404) };

  const key = serviceRoleKey();
  if (!key) {
    return {
      error: fail(
        "La clé SUPABASE_SERVICE_ROLE_KEY n'est pas configurée dans Vercel. Ajoutez-la (Supabase > Project Settings > API Keys > clé secrète), puis faites « Redeploy ».",
        500,
      ),
    };
  }
  const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { user, client, admin };
}

async function readJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Créer l'accès d'un client */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const auth = await authorize(body.clientId);
  if ("error" in auth) return auth.error;
  const { user, client, admin } = auth;

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!EMAIL.test(email)) return fail("Adresse e-mail invalide.");
  if (password.length < 8) return fail("Le mot de passe doit contenir au moins 8 caractères.");

  const { data: existing } = await admin.from("client_accounts").select("user_id").eq("client_id", client.id).maybeSingle();
  if (existing) return fail("Ce client a déjà un accès. Modifiez le mot de passe ou retirez l'accès d'abord.");

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "client", client_id: client.id, coach_id: user.id },
    user_metadata: { first_name: client.first_name, last_name: client.last_name },
  });
  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? "";
    if (/already|registered|exists/i.test(msg)) return fail("Cette adresse e-mail est déjà utilisée par un autre compte.");
    if (/password/i.test(msg)) return fail("Mot de passe refusé par Supabase (trop faible ou trop court).");
    return fail(`Création impossible : ${msg}`, 500);
  }

  const { error: linkError } = await admin
    .from("client_accounts")
    .insert({ user_id: created.data.user.id, client_id: client.id, coach_id: user.id, email });
  if (linkError) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    return fail(
      /client_accounts/.test(linkError.message) && /exist|relation/i.test(linkError.message)
        ? "La base de données n'est pas à jour : exécutez le fichier SQL 20261013000003_client_accounts.sql dans Supabase."
        : `Création impossible : ${linkError.message}`,
      500,
    );
  }
  return NextResponse.json({ ok: true, email });
}

/** Changer le mot de passe */
export async function PATCH(req: NextRequest) {
  const body = await readJson(req);
  const auth = await authorize(body.clientId);
  if ("error" in auth) return auth.error;
  const { client, admin } = auth;
  const password = String(body.password ?? "");
  if (password.length < 8) return fail("Le mot de passe doit contenir au moins 8 caractères.");

  const { data: account } = await admin.from("client_accounts").select("user_id, email").eq("client_id", client.id).maybeSingle();
  if (!account) return fail("Ce client n'a pas encore d'accès.", 404);
  const { error } = await admin.auth.admin.updateUserById(account.user_id, { password });
  if (error) return fail(`Modification impossible : ${error.message}`, 500);
  return NextResponse.json({ ok: true, email: account.email });
}

/** Retirer l'accès (supprime le compte de connexion, pas les données) */
export async function DELETE(req: NextRequest) {
  const body = await readJson(req);
  const auth = await authorize(body.clientId);
  if ("error" in auth) return auth.error;
  const { client, admin } = auth;
  const { data: account } = await admin.from("client_accounts").select("user_id").eq("client_id", client.id).maybeSingle();
  if (!account) return NextResponse.json({ ok: true });
  const { error } = await admin.auth.admin.deleteUser(account.user_id);
  if (error) return fail(`Suppression impossible : ${error.message}`, 500);
  return NextResponse.json({ ok: true });
}
