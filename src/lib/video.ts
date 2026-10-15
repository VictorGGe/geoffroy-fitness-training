/** Reconnaît un lien vidéo et donne de quoi l'afficher dans l'application. */
export type VideoInfo =
  | { kind: "youtube"; id: string; embed: string; thumb: string; start: number | null }
  | { kind: "vimeo"; id: string; embed: string; thumb: null }
  | { kind: "file"; src: string; thumb: null }
  | { kind: "link"; href: string; thumb: null };

function parseStart(u: URL): number | null {
  const t = u.searchParams.get("t") ?? u.searchParams.get("start");
  if (!t) return null;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m) return null;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return s > 0 ? s : null;
}

export function parseVideo(url: string | null | undefined): VideoInfo | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");

  // YouTube : watch?v=, youtu.be/, shorts/, embed/, live/
  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1).split("/")[0];
  else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    yt = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/)?.[1] ?? null;
  }
  if (yt && /^[\w-]{6,}$/.test(yt)) {
    const start = parseStart(u);
    return {
      kind: "youtube",
      id: yt,
      embed: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1${start ? `&start=${start}` : ""}`,
      thumb: `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`,
      start,
    };
  }

  // Vimeo
  if (host.endsWith("vimeo.com")) {
    const id = u.pathname.match(/(\d{5,})/)?.[1];
    if (id) return { kind: "vimeo", id, embed: `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`, thumb: null };
  }

  // Fichier vidéo direct
  if (/\.(mp4|webm|mov|m4v|ogg)$/i.test(u.pathname)) return { kind: "file", src: u.toString(), thumb: null };

  return { kind: "link", href: u.toString(), thumb: null };
}
