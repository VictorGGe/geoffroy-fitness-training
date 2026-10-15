import "server-only";
import { clean } from "./env";

/** Une valeur ressemble-t-elle à une clé secrète Supabase ? */
function looksSecret(v: string): boolean {
  if (/^sb_secret_[\w-]{10,}$/.test(v)) return true;
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)) {
    try {
      const payload = JSON.parse(Buffer.from(v.split(".")[1], "base64url").toString());
      return payload?.role === "service_role";
    } catch {
      return false;
    }
  }
  return false;
}

export interface SecretCandidate {
  name: string;
  key: string;
  /** Début de la clé, pour l'identifier sans la révéler */
  hint: string;
}

function hintOf(k: string): string {
  if (k.startsWith("sb_secret_")) return `${k.slice(0, 12)}…`;
  return `${k.slice(0, 6)}…`;
}

/**
 * Toutes les clés secrètes trouvées dans l'environnement, par ordre de priorité :
 * SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, puis toute autre variable serveur
 * (non NEXT_PUBLIC_) contenant une clé secrète (nom mal saisi).
 */
export function serviceRoleKeyInfo(): { candidates: SecretCandidate[]; publicLeak: string[]; related: string[] } {
  const env = process.env as Record<string, string | undefined>;
  const related = Object.keys(env).filter((k) => /SUPABASE|SECRET|SERVICE/i.test(k)).sort();
  const publicLeak = Object.keys(env).filter((k) => k.startsWith("NEXT_PUBLIC_") && looksSecret(clean(env[k], k)));
  const candidates: SecretCandidate[] = [];
  const seen = new Set<string>();
  const add = (name: string, key: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push({ name, key, hint: hintOf(key) });
  };
  for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) add(name, clean(env[name], name));
  for (const [name, raw] of Object.entries(env)) {
    if (name.startsWith("NEXT_PUBLIC_")) continue;
    const v = clean(raw, name);
    if (v && looksSecret(v)) add(name, v);
  }
  return { candidates, publicLeak, related };
}

/** Teste une clé : renvoie le code HTTP obtenu (200 = valide). */
export async function testServiceKey(supabaseUrl: string, key: string): Promise<{ status: number; body: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/client_accounts?select=user_id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    return { status: res.status, body: await res.text() };
  } catch (e) {
    return { status: 0, body: (e as Error).message };
  }
}

let cached: { key: string; at: number } | null = null;

/** Première clé secrète réellement acceptée par Supabase (les clés supprimées sont ignorées). */
export async function workingServiceRoleKey(supabaseUrl: string): Promise<string> {
  if (cached && Date.now() - cached.at < 60_000) return cached.key;
  const { candidates } = serviceRoleKeyInfo();
  for (const c of candidates) {
    const r = await testServiceKey(supabaseUrl, c.key);
    if (r.status !== 401 && r.status !== 403 && r.status !== 0) {
      cached = { key: c.key, at: Date.now() };
      return c.key;
    }
  }
  return "";
}
