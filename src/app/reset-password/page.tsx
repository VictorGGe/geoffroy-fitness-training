"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Button, Field, Input, LoadingBlock } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .auth.getUser()
      .then(({ data }) => setReady(!!data.user));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError("Le mot de passe doit contenir au moins 10 caractères.");
    if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setLoading(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    toast.success("Mot de passe mis à jour.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell title="Nouveau mot de passe" subtitle="Choisissez un mot de passe robuste (10 caractères minimum).">
      {ready === null ? (
        <LoadingBlock />
      ) : !ready ? (
        <div className="space-y-4 text-sm text-ink-300">
          <p>Ce lien est invalide ou a expiré. Faites une nouvelle demande de réinitialisation.</p>
          <Link href="/forgot-password" className="text-royal-400 hover:text-royal-300">
            Nouvelle demande
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nouveau mot de passe">
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Confirmation">
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Enregistrer
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
