import { adminClient, coachEmail, originOf, sendMail } from "@/lib/server/ct";
import { EMAIL_RE } from "@/lib/crossTraining";
import { eur } from "@/lib/quotes";
import { fail, NOT_READY, ok, readJson, str, UUID } from "@/app/api/ct/public/_shared";

export const dynamic = "force-dynamic";

/** Signature du devis par le client (depuis son lien personnel). */
export async function POST(req: Request) {
  const b = await readJson(req);
  const token = str(b.token, 40);
  const name = str(b.name, 120);
  const email = str(b.email, 160);
  const phone = str(b.phone, 40);
  const address = str(b.address, 300);
  const signature = typeof b.signature === "string" ? b.signature : "";
  if (!UUID.test(token)) return fail("Lien invalide.", 404);
  if (name.length < 2) return fail("Indique ton nom et ton prénom.");
  if (email && !EMAIL_RE.test(email)) return fail("Adresse email invalide.");
  if (b.acceptCgv !== true) return fail("Coche la case d'acceptation des conditions générales de vente.");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length < 300) return fail("Signe dans le cadre prévu.");
  if (signature.length > 400000) return fail("Signature trop lourde, recommence.");

  const admin = await adminClient();
  if (!admin) return fail(NOT_READY, 503);
  const { data: q } = await admin.from("quotes").select("id, coach_id, client_id, number, total, valid_until, status, client_signed_at, client_email, client_phone, client_address").eq("sign_token", token).maybeSingle();
  if (!q) return fail("Devis introuvable.", 404);
  if (q.client_signed_at) return fail("Ce devis est déjà signé.", 409);
  if (q.status === "refuse") return fail("Ce devis n'est plus valable. Contacte ton coach.", 409);
  const today = new Date().toISOString().slice(0, 10);
  if (q.valid_until < today) return fail("Ce devis a expiré. Demande un nouveau devis à ton coach.", 409);

  const now = new Date().toISOString();
  const { error } = await admin
    .from("quotes")
    .update({
      client_signature: signature,
      client_signed_name: name,
      client_signed_at: now,
      client_email: email || q.client_email,
      client_phone: phone || q.client_phone,
      client_address: address || q.client_address,
      status: "accepte",
      client_sign_info: {
        at: now,
        cgv_accepted: true,
        mention: "Bon pour accord",
        ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64),
        user_agent: (req.headers.get("user-agent") || "").slice(0, 200),
      },
    })
    .eq("id", q.id)
    .is("client_signed_at", null);
  if (error) {
    console.error("[devis] signature", error.message);
    return fail(NOT_READY, 503);
  }

  // Prévenir le coach (si les emails sont activés)
  const to = coachEmail();
  if (to) {
    const { data: c } = await admin.from("clients").select("first_name, last_name").eq("id", q.client_id).single();
    const who = c ? `${c.first_name} ${c.last_name}` : name;
    const link = `${originOf(req)}/clients/${q.client_id}?tab=devis`;
    await sendMail(
      to,
      `Devis ${q.number} signé par ${who}`,
      `<p>Bonne nouvelle : <strong>${who}</strong> a signé le devis <strong>${q.number}</strong> (${eur(Number(q.total))}).</p><p><a href="${link}">Voir le devis</a></p>`,
      `${who} a signé le devis ${q.number} (${eur(Number(q.total))}). ${link}`,
    );
  }
  return ok({ ok: true });
}
