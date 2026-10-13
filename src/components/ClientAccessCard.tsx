"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Mail, RefreshCw, ShieldCheck, UserX } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Field, Input, LoadingBlock } from "./ui";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { useAsync } from "@/lib/hooks";
import { errorMessage, fmtDate } from "@/lib/format";
import type { Client } from "@/lib/types";

interface Account {
  email: string;
  created_at: string;
}

/** Mot de passe lisible : sans caractères ambigus (0/O, 1/l…). */
function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

async function callApi(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
  const res = await fetch("/api/client-account", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json as { ok: true; email?: string };
}

export function ClientAccessCard({ client }: { client: Client }) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const { data, error } = await getSupabase()
      .from("client_accounts")
      .select("email, created_at")
      .eq("client_id", client.id)
      .maybeSingle();
    if (error && !/client_accounts/.test(error.message)) throw error;
    return { account: (data as Account | null) ?? null, migrationMissing: !!error };
  }, [client.id]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (loading) return <Card title="Accès client"><LoadingBlock /></Card>;
  if (error) return <Card title="Accès client"><p className="text-sm text-red-300">{error}</p></Card>;

  if (data?.migrationMissing) {
    return (
      <Card title="Accès client">
        <p className="text-sm text-amber-300">
          Fonction non activée : exécutez le fichier <code>supabase/migrations/20261013000003_client_accounts.sql</code> dans Supabase &gt; SQL Editor.
        </p>
      </Card>
    );
  }

  const account = data?.account ?? null;
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const message = credentials
    ? `Bonjour ${client.first_name},\n\nVoici ton accès à ton espace d'entraînement Geoffroy Fitness Training :\n\nAdresse : ${siteUrl}\nIdentifiant : ${credentials.email}\nMot de passe : ${credentials.password}\n\nTu y trouveras ton programme, tu pourras l'ajuster et noter tes séances (avec le chrono de repos).\nAstuce : sur ton téléphone, ajoute la page à ton écran d'accueil pour l'ouvrir comme une appli.\n\nÀ bientôt,\nGeoffroy`
    : "";

  async function create(e?: React.FormEvent) {
    e?.preventDefault();
    const em = (email || "").trim();
    if (!em) return toast.error("Saisissez l'adresse e-mail du client.");
    if (password.length < 8) return toast.error("Le mot de passe doit contenir au moins 8 caractères.");
    setBusy(true);
    try {
      const res = await callApi("POST", { clientId: client.id, email: em, password });
      setCredentials({ email: res.email ?? em, password });
      setPassword("");
      toast.success("Accès créé.");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e?: React.FormEvent) {
    e?.preventDefault();
    if (password.length < 8) return toast.error("Le mot de passe doit contenir au moins 8 caractères.");
    setBusy(true);
    try {
      const res = await callApi("PATCH", { clientId: client.id, password });
      setCredentials({ email: res.email ?? account?.email ?? "", password });
      setPassword("");
      setChanging(false);
      toast.success("Mot de passe modifié.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await callApi("DELETE", { clientId: client.id });
      setConfirmRevoke(false);
      setCredentials(null);
      toast.success("Accès retiré. Les données du client sont conservées.");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible : sélectionnez le texte manuellement.");
    }
  }

  const passwordField = (
    <Field label={account ? "Nouveau mot de passe" : "Mot de passe"} hint="8 caractères minimum.">
      <div className="flex gap-2">
        <Input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
        <Button variant="secondary" onClick={() => setPassword(generatePassword())} title="Générer un mot de passe">
          <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Générer</span>
        </Button>
      </div>
    </Field>
  );

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Accès client {account ? <Badge tone="green">Actif</Badge> : <Badge>Aucun</Badge>}
        </span>
      }
    >
      {credentials && (
        <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 animate-fade-in">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <ShieldCheck className="h-4 w-4" /> Identifiants à transmettre
          </p>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2"><dt className="w-28 text-ink-400">Adresse</dt><dd className="break-all text-white">{siteUrl}</dd></div>
            <div className="flex gap-2"><dt className="w-28 text-ink-400">Identifiant</dt><dd className="break-all text-white">{credentials.email}</dd></div>
            <div className="flex gap-2"><dt className="w-28 text-ink-400">Mot de passe</dt><dd className="font-mono text-white">{credentials.password}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-ink-400">Le mot de passe n&apos;est affiché qu&apos;une fois : transmettez-le maintenant.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`mailto:${encodeURIComponent(credentials.email)}?subject=${encodeURIComponent("Ton accès à ton programme — Geoffroy Fitness Training")}&body=${encodeURIComponent(message)}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-royal-600 px-3 text-sm font-medium text-white hover:bg-royal-500"
            >
              <Mail className="h-4 w-4" /> Envoyer par e-mail
            </a>
            <Button size="sm" variant="secondary" onClick={copy} className="h-9">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copié" : "Copier le message"}
            </Button>
          </div>
        </div>
      )}

      {!account ? (
        <form onSubmit={create} className="space-y-4">
          <p className="text-sm text-ink-400">
            Donnez à {client.first_name} un accès personnel : il verra uniquement ses programmes et ses séances, pourra les ajuster et
            saisir ses performances. Vos notes privées restent invisibles pour lui.
          </p>
          <Field label="E-mail du client">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@exemple.fr" autoComplete="off" />
          </Field>
          {passwordField}
          <Button type="submit" loading={busy} className="w-full">
            <KeyRound className="h-4 w-4" /> Créer l&apos;accès
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2"><dt className="w-28 text-ink-400">Identifiant</dt><dd className="break-all text-white">{account.email}</dd></div>
            <div className="flex gap-2"><dt className="w-28 text-ink-400">Créé le</dt><dd className="text-ink-200">{fmtDate(account.created_at)}</dd></div>
          </dl>
          {changing ? (
            <form onSubmit={changePassword} className="space-y-3">
              {passwordField}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setChanging(false)}>Annuler</Button>
                <Button type="submit" loading={busy} className="flex-1">Enregistrer</Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-2">
              <Button
                variant="secondary"
                className="justify-start"
                onClick={() => {
                  setPassword(generatePassword());
                  setChanging(true);
                }}
              >
                <KeyRound className="h-4 w-4" /> Changer le mot de passe
              </Button>
              <Button variant="ghost" className="justify-start text-red-300 hover:bg-red-500/10" onClick={() => setConfirmRevoke(true)}>
                <UserX className="h-4 w-4" /> Retirer l&apos;accès
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmRevoke}
        title="Retirer l'accès de ce client ?"
        message={
          <>
            {client.first_name} ne pourra plus se connecter. Ses programmes, séances et toutes ses données sont conservés. Vous pourrez lui
            recréer un accès plus tard.
          </>
        }
        confirmLabel="Retirer l'accès"
        loading={busy}
        onConfirm={revoke}
        onCancel={() => setConfirmRevoke(false)}
      />
    </Card>
  );
}
