import { NextResponse } from "next/server";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function ok(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export const NOT_READY = "Les inscriptions sont momentanément indisponibles. Réessaie un peu plus tard.";

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const j = await req.json();
    return j && typeof j === "object" ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
