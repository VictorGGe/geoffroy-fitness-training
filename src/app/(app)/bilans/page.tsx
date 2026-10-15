"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardCheck, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, cn } from "@/components/ui";
import { IntakeFields } from "@/components/IntakePanel";
import { useToast } from "@/components/toast";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { errorMessage, fmtDate, fullName, parseNum, todayISO } from "@/lib/format";
import { constraintsFromIntake, goalFromIntake, levelFromPractice, type IntakeAnswers } from "@/lib/intake";
import type { Client } from "@/lib/types";

type Mode = "new" | "existing";

export default function BilanPage() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("new");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useAsync(async () => {
    const sb = getSupabase();
    const [clients, intakes] = await Promise.all([
      sb.from("clients").select("id, first_name, last_name, archived").order("last_name"),
      sb.from("client_intakes").select("id, client_id, assessed_on").order("assessed_on", { ascending: false }).limit(10),
    ]);
    return {
      clients: unwrap(clients) as Pick<Client, "id" | "first_name" | "last_name" | "archived">[],
      intakes: intakes.error ? [] : ((intakes.data ?? []) as { id: string; client_id: string; assessed_on: string }[]),
      missing: !!intakes.error,
    };
  });

  const clientsById = useMemo(() => new Map((data?.clients ?? []).map((c) => [c.id, c])), [data]);

  async function save() {
    setError(null);
    const sb = getSupabase();
    if (mode === "new" && (!firstName.trim() || !lastName.trim())) return setError("Indiquez le prénom et le nom du client.");
    if (mode === "existing" && !clientId) return setError("Choisissez le client.");
    if (!date) return setError("Indiquez la date du bilan.");

    setSaving(true);
    let id = clientId;
    let created = false;
    try {
      if (mode === "new") {
        const spw = parseNum(answers.wished_frequency ?? "");
        const res = await sb
          .from("clients")
          .insert({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            goal: goalFromIntake(answers),
            level: levelFromPractice(answers.practice_level),
            sessions_per_week: spw !== null && Number.isInteger(spw) && spw >= 0 && spw <= 14 ? spw : null,
            constraints: constraintsFromIntake(answers),
          })
          .select("id")
          .single();
        if (res.error) throw res.error;
        id = res.data.id;
        created = true;
      }

      const ins = await sb.from("client_intakes").insert({ client_id: id, assessed_on: date, answers });
      if (ins.error) {
        if (created) await sb.from("clients").delete().eq("id", id);
        if (/client_intakes/.test(ins.error.message))
          throw new Error("Fonction non activée : exécutez le fichier SQL 20261015000005_intake.sql dans Supabase.");
        throw ins.error;
      }

      // Première pesée : le poids indiqué au bilan démarre le suivi de poids
      const w = parseNum(answers.weight_kg ?? "");
      if (created && w !== null && w >= 20 && w <= 400) {
        await sb.from("weigh_ins").insert({ client_id: id, measured_on: date, weight_kg: w, comment: "Bilan de départ" });
      }

      toast.success(created ? "Client créé et bilan de départ enregistré." : "Bilan de départ enregistré.");
      router.push(`/clients/${id}?tab=bilans`);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Bilan de départ" subtitle="Remplis le questionnaire : la fiche du client est créée automatiquement à l'enregistrement." />

      {data?.missing && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Fonction non activée : exécutez le fichier <code>supabase/migrations/20261015000005_intake.sql</code> dans Supabase &gt; SQL Editor.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          <IntakeFields
            answers={answers}
            onChange={setAnswers}
            date={date}
            onDate={setDate}
            header={
              <div className="space-y-3 sm:col-span-2">
                <div className="inline-flex rounded-lg border border-ink-700 bg-ink-900 p-0.5 text-sm font-medium">
                  {[
                    { k: "new" as const, label: "Nouveau client", icon: UserPlus },
                    { k: "existing" as const, label: "Client existant", icon: Users },
                  ].map(({ k, label, icon: Icon }) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMode(k)}
                      className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 transition", mode === k ? "bg-royal-600 text-white" : "text-ink-400 hover:text-ink-100")}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
                {mode === "new" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Prénom" required>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80} autoFocus />
                    </Field>
                    <Field label="Nom" required>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} />
                    </Field>
                  </div>
                ) : (
                  <Field label="Client" required>
                    <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                      <option value="">— Choisir —</option>
                      {(data?.clients ?? [])
                        .filter((c) => !c.archived)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {fullName(c)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                )}
              </div>
            }
          />

          {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

          <div className="sticky bottom-20 z-20 flex items-center justify-end gap-3 rounded-2xl border border-ink-700 bg-ink-900/95 p-3 backdrop-blur lg:bottom-4">
            <span className="mr-auto hidden text-sm text-ink-400 sm:block">
              {mode === "new" ? "La fiche client, le bilan et la première pesée seront créés." : "Le bilan sera ajouté à la fiche du client."}
            </span>
            <Button onClick={save} loading={saving} size="lg">
              <ClipboardCheck className="h-4 w-4" /> {mode === "new" ? "Créer le client et enregistrer" : "Enregistrer le bilan"}
            </Button>
          </div>
        </div>

        <aside className="order-first xl:order-none">
          <Card title="Derniers bilans" padded={false}>
            {!data?.intakes.length ? (
              <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title="Aucun bilan pour l'instant" />
            ) : (
              <ul className="divide-y divide-ink-750">
                {data.intakes.map((i) => {
                  const c = clientsById.get(i.client_id);
                  return (
                    <li key={i.id}>
                      <Link href={`/clients/${i.client_id}?tab=bilans`} className="group flex items-center gap-3 px-4 py-3 hover:bg-ink-800">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{c ? fullName(c) : "Client"}</p>
                          <p className="text-xs text-ink-400">{fmtDate(i.assessed_on)}</p>
                        </div>
                        {c?.archived && <Badge tone="amber">Archivé</Badge>}
                        <ChevronRight className="h-4 w-4 text-ink-600 group-hover:text-royal-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
