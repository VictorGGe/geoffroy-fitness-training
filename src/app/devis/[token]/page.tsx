"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, FileDown, PenLine, XCircle } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { cn } from "@/lib/cn";
import { CGV, CGV_PREAMBLE, COACH, eur, fmtDateFr, lineTotal, type Quote } from "@/lib/quotes";

type Client = { first_name: string; last_name: string };

export default function SignQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<{ quote: Quote; client: Client } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quote/public?t=${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erreur");
      setData(j);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="card p-8 text-center">
        <XCircle className="mx-auto h-9 w-9 text-red-400" />
        <p className="mt-3 font-medium text-white">{error}</p>
        <p className="mt-1 text-sm text-ink-400">Vérifie le lien reçu, ou demande-en un nouveau à ton coach.</p>
      </div>
    );
  }
  if (!data) return <div className="card h-96 animate-pulse" />;

  const { quote: q, client } = data;
  const signed = !!q.client_signed_at;
  const expired = !signed && q.valid_until < new Date().toISOString().slice(0, 10);

  return (
    <>
      <section className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-royal-400">Personal Training</p>
        <h1 className="h-display mt-1 text-4xl text-white sm:text-5xl">Devis {q.number}</h1>
        <p className="mt-1 text-sm text-ink-400">
          Pour {client.first_name} {client.last_name} · émis le {fmtDateFr(q.issued_on)} · valable jusqu&apos;au {fmtDateFr(q.valid_until)}
        </p>
      </section>

      {signed ? (
        <SignedBanner quote={q} client={client} />
      ) : expired ? (
        <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          Ce devis a expiré le {fmtDateFr(q.valid_until)}. Demande un nouveau devis à ton coach.
        </div>
      ) : q.status === "refuse" ? (
        <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">Ce devis n&apos;est plus valable.</div>
      ) : null}

      <QuoteSummary quote={q} />

      {!signed && !expired && q.status !== "refuse" && <SignForm token={token} quote={q} client={client} onSigned={load} />}
    </>
  );
}

function QuoteSummary({ quote: q }: { quote: Quote }) {
  const [cgv, setCgv] = useState(false);
  return (
    <section className="card mt-5 overflow-hidden">
      <div className="grid gap-4 border-b border-ink-700/60 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Le coach</p>
          <p className="mt-1 font-medium text-white">{COACH.name}</p>
          <p className="text-sm text-ink-400">{COACH.placeLine1}, {COACH.placeLine2}</p>
          <p className="text-xs text-ink-500">SIRET {COACH.siret}</p>
        </div>
        {q.intro && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">La prestation</p>
            <p className="mt-1 text-sm text-ink-200">{q.intro}</p>
          </div>
        )}
      </div>
      <ul className="divide-y divide-ink-700/50">
        {q.items.map((i, idx) => (
          <li key={idx} className="flex items-start gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink-100">{i.label}</p>
              {i.sub && <p className="text-xs text-ink-400">{i.sub}</p>}
            </div>
            <p className="shrink-0 text-right text-sm text-ink-300">
              {i.included ? "Inclus" : `${String(i.qty).replace(".", ",")} × ${eur(i.unit_price)}`}
              <span className="block font-semibold text-white">{eur(lineTotal(i))}</span>
            </p>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-royal-500/30 bg-royal-600/10 px-4 py-4 sm:px-5">
        <span className="text-sm text-ink-200">
          Total à payer <span className="text-xs text-ink-400">(TVA non applicable)</span>
        </span>
        <span className="font-display text-3xl font-bold tabular-nums text-white">{eur(Number(q.total))}</span>
      </div>
      {q.conditions.length > 0 && (
        <dl className="divide-y divide-ink-700/40 border-t border-ink-700/60 px-4 sm:px-5">
          {q.conditions.map((c, idx) => (
            <div key={idx} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[170px_1fr]">
              <dt className="font-medium text-ink-100">{c.label}</dt>
              <dd className="text-ink-300">{c.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="border-t border-ink-700/60">
        <button className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-royal-300 sm:px-5" onClick={() => setCgv(!cgv)}>
          Conditions générales de vente
          <ChevronDown className={cn("h-4 w-4 transition", cgv && "rotate-180")} />
        </button>
        {cgv && (
          <div className="space-y-3 px-4 pb-5 text-[13px] leading-relaxed text-ink-300 sm:px-5">
            <p className="text-ink-200">{CGV_PREAMBLE}</p>
            {CGV.map((s, i) => (
              <div key={s.title}>
                <p className="font-semibold text-white">{i + 1}. {s.title}</p>
                {s.blocks.map((b, j) => (
                  <p key={j} className="mt-1">
                    {b.sub && <span className="font-medium text-ink-100">{b.sub} — </span>}
                    {b.text}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SignForm({ token, quote: q, client, onSigned }: { token: string; quote: Quote; client: Client; onSigned: () => void }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(`${client.first_name} ${client.last_name}`.trim());
  const [email, setEmail] = useState(q.client_email ?? "");
  const [phone, setPhone] = useState(q.client_phone ?? "");
  const [address, setAddress] = useState(q.client_address ?? "");
  const [cgv, setCgv] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const signature = pad.current?.toDataURL();
    if (name.trim().length < 2) return setErr("Indique ton nom et ton prénom.");
    if (!cgv) return setErr("Coche la case d'acceptation des conditions générales de vente.");
    if (!signature) return setErr("Signe dans le cadre blanc.");
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/quote/public/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name, email, phone, address, acceptCgv: true, signature }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Signature impossible.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      onSigned();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-5 p-4 sm:p-6">
      <h2 className="h-display flex items-center gap-2 text-2xl text-white">
        <PenLine className="h-5 w-5 text-royal-400" /> Bon pour accord
      </h2>
      <p className="mt-1 text-sm text-ink-400">Vérifie tes informations, accepte les conditions puis signe : c&apos;est tout.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nom et prénom" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} autoComplete="email" />
        </Field>
        <Field label="Téléphone">
          <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} autoComplete="tel" />
        </Field>
        <Field label="Adresse">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} autoComplete="street-address" />
        </Field>
      </div>
      <label
        className={cn(
          "mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-snug transition",
          cgv ? "border-royal-500/50 bg-royal-600/10 text-ink-100" : "border-ink-700 bg-ink-900/60 text-ink-300",
        )}
      >
        <input type="checkbox" checked={cgv} onChange={(e) => setCgv(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-royal-500" />
        <span>
          J&apos;ai lu et j&apos;accepte le devis {q.number} ({eur(Number(q.total))}) et les conditions générales de vente. Je donne mon accord : « Bon pour accord ».
        </span>
      </label>
      <p className="label mt-5">Signature</p>
      <SignaturePad ref={pad} onChange={(empty) => setHasSig(!empty)} />
      {err && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
      <Button size="lg" className="mt-5 w-full" loading={busy} disabled={!cgv || !hasSig} onClick={submit}>
        Signer le devis
      </Button>
      <p className="mt-2 text-center text-xs text-ink-500">La date et l&apos;heure de signature sont enregistrées avec le devis.</p>
    </section>
  );
}

function SignedBanner({ quote: q, client }: { quote: Quote; client: Client }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const { exportQuotePdf } = await import("@/lib/quotePdf");
      await exportQuotePdf(q, client);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/15 to-transparent p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-300" />
        <div>
          <p className="h-display text-2xl text-white">Devis signé, merci !</p>
          <p className="mt-1 text-sm text-ink-200">
            Signé par {q.client_signed_name} le {new Date(q.client_signed_at!).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}. Ton coach a reçu ta signature.
          </p>
        </div>
      </div>
      <Button variant="secondary" className="mt-4 w-full sm:w-auto" loading={busy} onClick={download}>
        <FileDown className="h-4 w-4" /> Télécharger le devis signé (PDF)
      </Button>
    </div>
  );
}
