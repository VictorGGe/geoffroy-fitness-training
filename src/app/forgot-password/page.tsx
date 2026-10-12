"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { Button, Field, Input } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    // Message identique que l'adresse existe ou non (ne pas révéler les comptes existants).
    if (error && /rate|too many/i.test(error.message)) {
      setError("Trop de demandes. Réessayez dans quelques minutes.");
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell title="Mot de passe oublié" subtitle="Recevez un lien de réinitialisation par e-mail.">
      {sent ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-royal-600/15 text-royal-400">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="text-sm text-ink-300">
            Si un compte correspond à cette adresse, un e-mail contenant un lien de réinitialisation vient d&apos;être envoyé.
          </p>
          <Link href="/login" className="inline-block text-sm text-royal-400 hover:text-royal-300">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Adresse e-mail">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Envoyer le lien
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-ink-400 hover:text-ink-200">
              Retour à la connexion
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
