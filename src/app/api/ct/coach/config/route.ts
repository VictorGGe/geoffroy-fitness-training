import { adminClient, currentCoach, mailConfigured, payMode, stripeMode } from "@/lib/server/ct";
import { fail, ok } from "../../public/_shared";

export const dynamic = "force-dynamic";

/** État de la configuration (paiement par carte, emails, clé serveur) pour la page coach. */
export async function GET() {
  const c = await currentCoach();
  if (!c) return fail("Réservé au coach.", 401);
  return ok({
    coachId: c.user.id,
    stripe: stripeMode(),
    payMode: payMode(),
    email: mailConfigured(),
    server: !!(await adminClient()),
  });
}
