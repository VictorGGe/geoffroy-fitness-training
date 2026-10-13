/**
 * Lecture tolérante des variables Supabase : corrige les erreurs de copier-coller
 * fréquentes (espaces, guillemets, « NOM= » recopié dans la valeur, / final).
 */
function clean(raw: string | undefined, name: string): string {
  const unquote = (x: string) => x.trim().replace(/^["']+|["']+$/g, "").trim();
  let v = unquote(raw ?? "");
  if (v.startsWith(name + "=")) v = unquote(v.slice(name.length + 1));
  return v;
}

function normalizeUrl(v: string): string {
  v = v.replace(/\/+$/, "");
  // Identifiant de projet seul (ex. « abcdefghijklmnopqrst ») → adresse complète
  if (/^[a-z0-9]{20}$/.test(v)) return `https://${v}.supabase.co`;
  // Adresse sans https://
  if (/^[a-z0-9-]+\.supabase\.(co|in)$/.test(v)) return `https://${v}`;
  return v;
}

export const SUPABASE_URL = normalizeUrl(clean(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"));
export const SUPABASE_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const SUPABASE_CONFIG_OK =
  /^https?:\/\/[^\s/]+(:\d+)?$/.test(SUPABASE_URL) && SUPABASE_KEY.length > 20;
