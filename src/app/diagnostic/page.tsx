import { AuthShell } from "@/components/AuthShell";
import { SUPABASE_KEY, SUPABASE_URL, serviceRoleKey } from "@/lib/env";

export const dynamic = "force-dynamic";

type Check = { label: string; ok: boolean; detail: string };

async function runChecks(): Promise<Check[]> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const url = SUPABASE_URL;
  const key = SUPABASE_KEY;
  const checks: Check[] = [];

  checks.push({
    label: "Adresse Supabase (NEXT_PUBLIC_SUPABASE_URL)",
    ok: /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url),
    detail: !rawUrl
      ? "Absente dans Vercel (le nom doit être exactement NEXT_PUBLIC_SUPABASE_URL)."
      : /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)
        ? url + (rawUrl !== url ? " (corrigée automatiquement)" : "")
        : `Format inattendu : « ${rawUrl.slice(0, 60)} ». Attendu : https://xxxxxxxx.supabase.co`,
  });

  const keyOk = (/^sb_publishable_[\w-]{10,}$/.test(key) || /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(key));
  checks.push({
    label: "Clé publique (NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    ok: keyOk,
    detail: !rawKey
      ? "Absente dans Vercel (le nom doit être exactement NEXT_PUBLIC_SUPABASE_ANON_KEY)."
      : /^sb_secret_/.test(key)
          ? "Attention : c'est la clé SECRÈTE. Remplacez-la par la clé publishable / anon."
          : keyOk
            ? `${key.slice(0, 18)}… (${key.length} caractères)`
            : `Format inattendu (commence par « ${key.slice(0, 12)} »).`,
  });

  if (url && key) {
    try {
      const res = await fetch(`${url.trim().replace(/\/$/, "")}/auth/v1/settings`, {
        headers: { apikey: key.trim() },
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      checks.push({
        label: "Connexion au serveur Supabase",
        ok: res.ok,
        detail: res.ok ? "Le serveur répond et accepte la clé." : `Refusée (code ${res.status}) : ${JSON.stringify(body).slice(0, 160)}`,
      });
      if (res.ok) {
        checks.push({
          label: "Inscriptions publiques bloquées",
          ok: body.disable_signup === true,
          detail: body.disable_signup ? "Oui." : "Non : désactivez « Allow new users to sign up » dans Supabase.",
        });
      }
      const db = await fetch(`${url.trim().replace(/\/$/, "")}/rest/v1/clients?select=id&limit=1`, {
        headers: { apikey: key.trim(), Authorization: `Bearer ${key.trim()}` },
        cache: "no-store",
      });
      const dbBody = await db.text();
      const tablesExist = db.status !== 404 && !/does not exist|schema cache/i.test(dbBody);
      checks.push({
        label: "Tables de la base de données",
        ok: tablesExist,
        detail: tablesExist
          ? "Présentes et protégées."
          : "Introuvables : exécutez les 2 fichiers SQL dans Supabase > SQL Editor.",
      });
    } catch (e) {
      checks.push({ label: "Connexion au serveur Supabase", ok: false, detail: `Injoignable : ${(e as Error).message}` });
    }

    // Accès clients (facultatif)
    const secret = serviceRoleKey();
    if (!secret) {
      checks.push({
        label: "Accès clients (SUPABASE_SERVICE_ROLE_KEY)",
        ok: false,
        detail: "Non configuré — facultatif : nécessaire uniquement pour créer des accès à vos clients.",
      });
    } else {
      try {
        const res = await fetch(`${url}/rest/v1/client_accounts?select=user_id&limit=1`, {
          headers: { apikey: secret, Authorization: `Bearer ${secret}` },
          cache: "no-store",
        });
        const txt = await res.text();
        checks.push({
          label: "Accès clients (SUPABASE_SERVICE_ROLE_KEY)",
          ok: res.ok,
          detail: res.ok
            ? "Clé secrète valide et table des accès présente."
            : /client_accounts|does not exist|schema cache/i.test(txt)
              ? "Clé valide, mais exécutez le fichier SQL 20261013000003_client_accounts.sql dans Supabase."
              : `Clé refusée (code ${res.status}) : vérifiez que c'est bien la clé secrète / service_role.`,
        });
      } catch (e) {
        checks.push({ label: "Accès clients (SUPABASE_SERVICE_ROLE_KEY)", ok: false, detail: `Vérification impossible : ${(e as Error).message}` });
      }
    }
  }
  return checks;
}

export default async function DiagnosticPage() {
  const checks = await runChecks();
  const allOk = checks.every((c) => c.ok || c.label.startsWith("Accès clients"));
  return (
    <AuthShell title="Diagnostic" subtitle="Vérification de la configuration du site (aucune donnée client n'est affichée).">
      <ul className="space-y-3">
        {checks.map((c) => (
          <li key={c.label} className="rounded-xl border border-ink-700 bg-ink-900 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <span className={c.ok ? "text-emerald-400" : "text-red-400"}>{c.ok ? "✓" : "✗"}</span>
              {c.label}
            </p>
            <p className={`mt-1 break-all text-xs ${c.ok ? "text-ink-400" : "text-red-300"}`}>{c.detail}</p>
          </li>
        ))}
      </ul>
      <p className={`mt-5 text-sm ${allOk ? "text-emerald-300" : "text-amber-300"}`}>
        {allOk
          ? "Tout est correct. Si la connexion échoue, vérifiez l'e-mail et le mot de passe du compte coach dans Supabase > Authentication > Users."
          : "Corrigez les lignes en rouge dans Vercel (Settings > Environment Variables), puis faites « Redeploy »."}
      </p>
      <a href="/login" className="mt-4 inline-block text-sm text-royal-400 hover:text-royal-300">
        Aller à la page de connexion
      </a>
    </AuthShell>
  );
}
