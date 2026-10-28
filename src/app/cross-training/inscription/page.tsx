"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, CreditCard, Hourglass, Lock, MapPin, Share2, XCircle } from "lucide-react";
import { Button, ConfirmDialog, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtPrice, fmtSlotDay, fmtSlotTime } from "@/lib/crossTraining";
import { saveReg } from "@/lib/ctSaved";

interface Me {
  registration: { first_name: string; last_name: string; email: string; status: "inscrit" | "paye" | "annule"; paid_at: string | null; amount_paid: number | null };
  slot: {
    title: string;
    starts_at: string;
    duration_min: number;
    location: string | null;
    price: number;
    min_people: number;
    max_people: number;
    status: "ouvert" | "annule";
  };
  count: number;
  cardPayment: boolean;
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("t") ?? "";
  const sessionId = params.get("session_id");
  const isNew = params.get("nouveau") === "1";
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  const load = useCallback(
    async (withSession?: string | null) => {
      try {
        const q = new URLSearchParams({ t: token });
        if (withSession) q.set("session_id", withSession);
        const res = await fetch(`/api/ct/public/me?${q}`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Erreur");
        setMe(j);
        setError(null);
        saveReg({ token, label: j.slot.title, starts_at: j.slot.starts_at });
        return j as Me;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    [token],
  );

  useEffect(() => {
    (async () => {
      const j = await load(sessionId);
      if (sessionId) {
        if (j?.registration.status === "paye") setJustPaid(true);
        router.replace(`/cross-training/inscription?t=${token}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // En attente du groupe ou d'un paiement : actualisation automatique
  useEffect(() => {
    if (!me || me.registration.status !== "inscrit" || me.slot.status !== "ouvert") return;
    const t = setInterval(() => load(), 20000);
    return () => clearInterval(t);
  }, [me, load]);

  async function pay() {
    setPaying(true);
    setPayErr(null);
    try {
      const res = await fetch("/api/ct/public/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) throw new Error(j.error || "Paiement indisponible.");
      window.location.href = j.url;
    } catch (e) {
      setPayErr((e as Error).message);
      setPaying(false);
      load();
    }
  }

  async function cancel() {
    setCancelling(true);
    const res = await fetch("/api/ct/public/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await res.json().catch(() => ({}));
    setCancelling(false);
    setConfirmCancel(false);
    if (!res.ok) return setPayErr(j.error || "Annulation impossible.");
    load();
  }

  async function share() {
    const url = `${window.location.origin}/cross-training`;
    const text = me ? `Viens au ${me.slot.title} avec moi le ${fmtSlotDay(me.slot.starts_at).toLowerCase()} à ${fmtSlotTime(me.slot.starts_at)} !` : "";
    try {
      if (navigator.share) await navigator.share({ title: "Cross training", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setPayErr(null);
        alertCopied();
      }
    } catch {
      /* partage annulé */
    }
  }
  const [copied, setCopied] = useState(false);
  function alertCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const back = (
    <a href="/cross-training" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100">
      <ArrowLeft className="h-4 w-4" /> Tous les créneaux
    </a>
  );

  if (error) {
    return (
      <>
        {back}
        <div className="card p-8 text-center">
          <XCircle className="mx-auto h-9 w-9 text-red-400" />
          <p className="mt-3 font-medium text-white">{error}</p>
          <p className="mt-1 text-sm text-ink-400">Vérifie le lien reçu par email.</p>
        </div>
      </>
    );
  }
  if (!me) {
    return (
      <>
        {back}
        <div className="card h-72 animate-pulse" />
      </>
    );
  }

  const { registration: r, slot: s, count } = me;
  const cancelled = r.status === "annule" || s.status === "annule";
  const confirmed = count >= s.min_people;
  const past = new Date(s.starts_at).getTime() < Date.now();

  let tone: "green" | "amber" | "blue" | "red";
  let icon;
  let title: string;
  let text: string;
  if (cancelled) {
    tone = "red";
    icon = <XCircle className="h-7 w-7" />;
    title = s.status === "annule" ? "Séance annulée" : "Inscription annulée";
    text = s.status === "annule"
      ? r.status === "paye" ? "La séance a été annulée par le coach. Ton paiement va être remboursé." : "La séance a été annulée par le coach. Tu n'as rien à payer."
      : "Tu n'es plus inscrit(e) à cette séance.";
  } else if (r.status === "paye") {
    tone = "green";
    icon = <CheckCircle2 className="h-7 w-7" />;
    title = justPaid ? "Paiement reçu, merci\u00a0!" : "Ta place est réglée";
    text = past ? "Merci pour ta participation !" : "Tout est bon. Rendez-vous à la séance, en tenue de sport, avec une bouteille d'eau.";
  } else if (confirmed) {
    tone = "blue";
    icon = <CreditCard className="h-7 w-7" />;
    title = "Le groupe est confirmé\u00a0!";
    text = me.cardPayment
      ? `Il y a ${count} inscrits : tu peux régler ta place maintenant pour la garantir.`
      : `Il y a ${count} inscrits. Le coach te contactera pour le règlement.`;
  } else {
    tone = "amber";
    icon = <Hourglass className="h-7 w-7" />;
    title = isNew ? "Inscription enregistrée\u00a0!" : "En attente du groupe";
    const need = s.min_people - count;
    text = `Encore ${need} personne${need > 1 ? "s" : ""} pour confirmer la séance. Tu recevras un email dès que le paiement sera ouvert. Rien à payer pour l'instant.`;
  }
  const tones = {
    green: "border-emerald-500/40 from-emerald-500/15 text-emerald-300",
    amber: "border-amber-500/40 from-amber-500/15 text-amber-300",
    blue: "border-royal-500/50 from-royal-600/25 text-royal-300",
    red: "border-red-500/40 from-red-500/15 text-red-300",
  };

  return (
    <>
      {back}
      <section className={cn("card overflow-hidden bg-gradient-to-b to-transparent p-5 sm:p-6", tones[tone])}>
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5">{icon}</span>
          <div className="min-w-0">
            <h1 className="h-display text-[28px] leading-tight text-white">{title}</h1>
            <p className="mt-1 text-[15px] text-ink-200">{text}</p>
          </div>
        </div>

        {!cancelled && r.status === "inscrit" && (
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-xs text-ink-300">
              <span>{count} inscrit{count > 1 ? "s" : ""}</span>
              <span>minimum {s.min_people} · maximum {s.max_people}</span>
            </div>
            <ProgressBar value={Math.min(100, (count / s.min_people) * 100)} tone={confirmed ? "green" : "amber"} />
          </div>
        )}

        {!cancelled && r.status === "inscrit" && confirmed && me.cardPayment && !past && (
          <Button size="lg" className="mt-5 w-full" loading={paying} onClick={pay}>
            <Lock className="h-4 w-4" /> Payer {fmtPrice(s.price)} par carte
          </Button>
        )}
        {!cancelled && r.status === "inscrit" && !confirmed && (
          <Button size="lg" variant="secondary" className="mt-5 w-full" onClick={share}>
            <Share2 className="h-4 w-4" /> {copied ? "Lien copié !" : "Inviter un ami pour compléter le groupe"}
          </Button>
        )}
        {payErr && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{payErr}</p>}
      </section>

      <section className="card mt-4 divide-y divide-ink-700/60">
        <Row icon={<CalendarDays className="h-4 w-4" />} label="Séance" value={`${s.title} — ${fmtSlotDay(s.starts_at)}`} />
        <Row icon={<Clock className="h-4 w-4" />} label="Horaire" value={fmtSlotTime(s.starts_at, s.duration_min)} />
        {s.location && <Row icon={<MapPin className="h-4 w-4" />} label="Lieu" value={s.location} />}
        <Row
          icon={<CreditCard className="h-4 w-4" />}
          label="Tarif"
          value={r.status === "paye" ? `${fmtPrice(Number(r.amount_paid ?? s.price))} — payé` : fmtPrice(s.price)}
        />
        <div className="px-4 py-3 text-xs text-ink-400 sm:px-5">
          Inscription au nom de <span className="text-ink-200">{r.first_name} {r.last_name}</span> ({r.email}). Garde ce lien : il te permet de suivre ton inscription.
        </div>
      </section>

      {!cancelled && r.status === "inscrit" && !past && (
        <div className="mt-6 text-center">
          <button className="text-sm text-ink-500 underline-offset-4 hover:text-red-300 hover:underline" onClick={() => setConfirmCancel(true)}>
            Annuler mon inscription
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Annuler ton inscription ?"
        message="Ta place sera libérée pour quelqu'un d'autre."
        confirmLabel="Oui, annuler"
        loading={cancelling}
        onConfirm={cancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <span className="mt-0.5 text-royal-400">{icon}</span>
      <span className="w-20 shrink-0 text-sm text-ink-400">{label}</span>
      <span className="min-w-0 text-sm font-medium text-ink-100">{value}</span>
    </div>
  );
}

export default function InscriptionPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
