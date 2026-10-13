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

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
export const SUPABASE_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const SUPABASE_CONFIG_OK =
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(SUPABASE_URL) && SUPABASE_KEY.length > 20;
