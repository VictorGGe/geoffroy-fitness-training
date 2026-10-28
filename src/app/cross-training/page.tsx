"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck, CalendarDays, Check, ChevronRight, Clock, CreditCard, MapPin, Users } from "lucide-react";
import { Button, Field, Input, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  CONSENTS,
  EMAIL_RE,
  fmtPrice,
  fmtSlotDay,
  fmtSlotFull,
  fmtSlotTime,
  slotDayKey,
  slotState,
  validPhone,
  type PublicSlot,
} from "@/lib/crossTraining";
import { loadSaved, saveReg, type SavedReg } from "@/lib/ctSaved";

function CrossTrainingInner() {
  const params = useSearchParams();
  const coach = params.get("c");
  const [slots, setSlots] = useState<PublicSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PublicSlot | null>(null);
  const [mine, setMine] = useState<SavedReg[]>([]);

  async function load() {
    try {
      const res = await fetch(`/api/ct/public/slots${coach ? `?c=${encodeURIComponent(coach)}` : ""}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erreur");
      setSlots(j.slots);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    setMine(loadSaved().filter((r) => new Date(r.starts_at).getTime() > Date.now() - 3 * 3600000));
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach]);

  const days = useMemo(() => {
    const m = new Map<string, PublicSlot[]>();
    for (const s of slots ?? []) {
      const k = slotDayKey(s.starts_at);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [slots]);

  return (
    <>
      <section className="animate-fade-in pt-4 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-royal-400">Victor Training</p>
        <h1 className="h-display mt-2 text-5xl text-white sm:text-6xl">Cross training</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-300">
          Des séances intenses et encadrées, en petit groupe de 3 à 6 personnes. Choisis ton créneau et inscris-toi en 1 minute.
        </p>
      </section>

      <ol className="mt-7 grid gap-2.5 sm:grid-cols-3">
        {[
          { icon: CalendarCheck, t: "Je m'inscris", d: "Gratuit et sans engagement à cette étape." },
          { icon: Users, t: "Groupe confirmé", d: "Dès 3 inscrits, tu reçois un email." },
          { icon: CreditCard, t: "Je règle par carte", d: "Paiement sécurisé, uniquement si la séance a lieu." },
        ].map((s, i) => (
          <li key={s.t} className="card flex items-start gap-3 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-royal-600/15 text-royal-300">
              <s.icon className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">
                <span className="text-royal-400">{i + 1}.</span> {s.t}
              </p>
              <p className="text-xs leading-snug text-ink-400">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>

      {mine.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">Mes inscriptions</h2>
          <div className="space-y-2">
            {mine.map((r) => (
              <a
                key={r.token}
                href={`/cross-training/inscription?t=${r.token}`}
                className="card flex items-center gap-3 p-3.5 transition hover:border-royal-500/60"
              >
                <CalendarDays className="h-5 w-5 text-royal-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{r.label}</p>
                  <p className="text-xs text-ink-400">{fmtSlotFull(r.starts_at)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-500" />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="h-display mb-3 text-2xl text-white">Prochains créneaux</h2>
        {error ? (
          <div className="card p-6 text-center text-sm text-ink-300">
            {error}
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={load}>Réessayer</Button>
            </div>
          </div>
        ) : !slots ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-24 animate-pulse" />
            ))}
          </div>
        ) : days.length === 0 ? (
          <div className="card p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-ink-500" />
            <p className="mt-3 font-medium text-ink-100">Aucun créneau ouvert pour le moment</p>
            <p className="mt-1 text-sm text-ink-400">Les prochains créneaux arrivent bientôt, repasse vite !</p>
          </div>
        ) : (
          <div className="space-y-6">
            {days.map(([day, list]) => (
              <div key={day}>
                <p className="mb-2 text-sm font-semibold text-royal-300">{fmtSlotDay(list[0].starts_at)}</p>
                <div className="space-y-3">
                  {list.map((s) => (
                    <SlotCard key={s.id} slot={s} onPick={() => setSelected(s)} registered={mine.some((m) => m.starts_at === s.starts_at)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && <RegisterModal slot={selected} onClose={() => setSelected(null)} onFull={load} />}
    </>
  );
}

function SlotCard({ slot, onPick, registered }: { slot: PublicSlot; onPick: () => void; registered: boolean }) {
  const state = slotState(slot.count, slot.min_people, slot.max_people);
  const left = slot.max_people - slot.count;
  const need = slot.min_people - slot.count;
  return (
    <article
      className={cn(
        "card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5",
        state === "confirme" && "border-emerald-500/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-display text-[26px] font-bold leading-none text-white">{fmtSlotTime(slot.starts_at)}</p>
          <p className="text-sm font-medium text-ink-200">{slot.title}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmtSlotTime(slot.starts_at, slot.duration_min)}</span>
          {slot.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {slot.location}</span>}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex gap-1" aria-label={`${slot.count} inscrits sur ${slot.max_people}`}>
            {Array.from({ length: slot.max_people }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2.5 w-5 rounded-full",
                  i < slot.count ? (state === "attente" ? "bg-amber-400" : "bg-emerald-400") : i < slot.min_people ? "bg-ink-600" : "bg-ink-750",
                )}
              />
            ))}
          </div>
          <span className={cn("text-xs font-medium", state === "attente" ? "text-amber-300" : state === "complet" ? "text-ink-400" : "text-emerald-300")}>
            {state === "complet"
              ? "Complet"
              : state === "confirme"
                ? `Confirmé · ${left} place${left > 1 ? "s" : ""}`
                : `${slot.count}/${slot.min_people} · encore ${need} pour confirmer`}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <p className="font-display text-2xl font-bold text-white">{fmtPrice(slot.price)}</p>
        <Button onClick={onPick} disabled={state === "complet" || registered} className="min-w-[140px]">
          {registered ? <><Check className="h-4 w-4" /> Inscrit(e)</> : state === "complet" ? "Complet" : "Je m'inscris"}
        </Button>
      </div>
    </article>
  );
}

function RegisterModal({ slot, onClose, onFull }: { slot: PublicSlot; onClose: () => void; onFull: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", website: "" });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const missing = CONSENTS.filter((c) => c.required && !checks[c.key]).length;

  async function submit() {
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("Indique ton prénom et ton nom.");
    if (!EMAIL_RE.test(f.email.trim())) return setErr("Adresse email invalide.");
    if (!validPhone(f.phone)) return setErr("Numéro de téléphone invalide.");
    if (missing) return setErr("Coche toutes les cases obligatoires.");
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/ct/public/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, slotId: slot.id, consents: checks }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) onFull();
        throw new Error(j.error || "Inscription impossible.");
      }
      if (!j.token) throw new Error("Inscription impossible.");
      saveReg({ token: j.token, label: slot.title, starts_at: slot.starts_at });
      router.push(`/cross-training/inscription?t=${j.token}&nouveau=1`);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Inscription"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={saving} onClick={submit}>Valider mon inscription</Button>
        </>
      }
    >
      <div className="mb-5 rounded-xl border border-royal-500/25 bg-royal-600/[0.08] p-3.5">
        <p className="font-semibold text-white">{slot.title}</p>
        <p className="text-sm text-ink-300">{fmtSlotFull(slot.starts_at, slot.duration_min)}</p>
        {slot.location && <p className="text-sm text-ink-400">{slot.location}</p>}
        <p className="mt-1.5 text-sm text-ink-300">
          {fmtPrice(slot.price)} · à régler par carte <strong className="text-white">seulement quand le groupe atteint {slot.min_people} personnes</strong>.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" required>
            <Input value={f.firstName} onChange={set("firstName")} autoComplete="given-name" maxLength={60} />
          </Field>
          <Field label="Nom" required>
            <Input value={f.lastName} onChange={set("lastName")} autoComplete="family-name" maxLength={60} />
          </Field>
        </div>
        <Field label="Email" required hint="Tu y recevras la confirmation et le lien de paiement.">
          <Input type="email" inputMode="email" value={f.email} onChange={set("email")} autoComplete="email" maxLength={160} />
        </Field>
        <Field label="Téléphone" required>
          <Input type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" maxLength={30} placeholder="06 12 34 56 78" />
        </Field>
        {/* Piège à robots, invisible pour les humains */}
        <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

        <fieldset className="space-y-2.5 pt-1">
          <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">Conditions de participation</legend>
          {CONSENTS.map((c) => (
            <label
              key={c.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-[13px] leading-snug transition",
                checks[c.key] ? "border-royal-500/50 bg-royal-600/10 text-ink-100" : "border-ink-700 bg-ink-900/60 text-ink-300 hover:border-ink-600",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-royal-500"
                checked={!!checks[c.key]}
                onChange={(e) => setChecks({ ...checks, [c.key]: e.target.checked })}
              />
              <span>
                {c.text(slot.min_people)}
                {c.required && <span className="text-royal-400"> *</span>}
              </span>
            </label>
          ))}
          <p className="text-xs text-ink-500">* obligatoire</p>
        </fieldset>
        {err && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
      </div>
    </Modal>
  );
}

export default function CrossTrainingPage() {
  return (
    <Suspense>
      <CrossTrainingInner />
    </Suspense>
  );
}
