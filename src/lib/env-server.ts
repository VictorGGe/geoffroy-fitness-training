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

/**
 * Clé secrète Supabase (serveur uniquement) : sert à créer les comptes clients.
 * Noms acceptés : SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY. À défaut, toute variable
 * serveur (non NEXT_PUBLIC_) contenant une clé secrète est utilisée (nom mal saisi).
 */
export function serviceRoleKeyInfo(): { key: string; name: string | null; publicLeak: string[]; related: string[] } {
  const env = process.env as Record<string, string | undefined>;
  const related = Object.keys(env).filter((k) => /SUPABASE|SECRET|SERVICE/i.test(k)).sort();
  const publicLeak = Object.keys(env).filter((k) => k.startsWith("NEXT_PUBLIC_") && looksSecret(clean(env[k], k)));
  for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) {
    const v = clean(env[name], name);
    if (v) return { key: v, name, publicLeak, related };
  }
  for (const [name, raw] of Object.entries(env)) {
    if (name.startsWith("NEXT_PUBLIC_")) continue;
    const v = clean(raw, name);
    if (v && looksSecret(v)) return { key: v, name, publicLeak, related };
  }
  return { key: "", name: null, publicLeak, related };
}

export function serviceRoleKey(): string {
  return serviceRoleKeyInfo().key;
}
