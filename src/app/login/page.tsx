"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { Button, Field, Input } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError(
        /invalid login/i.test(error.message)
          ? "Identifiants incorrects."
          : /rate|too many/i.test(error.message)
            ? "Trop de tentatives. Patientez quelques minutes."
            : error.message,
      );
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Adresse e-mail">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <Input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            placeholder="coach@exemple.fr"
          />
        </div>
      </Field>
      <Field label="Mot de passe">
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10"
            placeholder="••••••••"
          />
        </div>
      </Field>
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Se connecter
      </Button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-royal-400 hover:text-royal-300">
          Mot de passe oublié ?
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="Connexion" subtitle="Accédez à votre espace de coaching.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
