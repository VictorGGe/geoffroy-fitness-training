"use client";

import { useState } from "react";
import { History, TrendingUp } from "lucide-react";
import { ErrorBlock, LoadingBlock, PageHeader, Tabs } from "@/components/ui";
import { ProgressionPanel, SessionHistory } from "@/components/TrainingPanels";
import { getMyClientProfile } from "@/lib/data";
import { useAsync } from "@/lib/hooks";

export default function ClientSessionsPage() {
  const [tab, setTab] = useState<"historique" | "progression">("historique");
  const { data: me, loading, error, reload } = useAsync(() => getMyClientProfile());

  if (loading) return <LoadingBlock />;
  if (error || !me) return <ErrorBlock message={error ?? "Profil introuvable."} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Mes séances" subtitle="Tes séances réalisées et ta progression exercice par exercice." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "historique", label: "Historique", icon: <History className="h-3.5 w-3.5" /> },
          { key: "progression", label: "Progression", icon: <TrendingUp className="h-3.5 w-3.5" /> },
        ]}
      />
      {tab === "historique" ? <SessionHistory clientId={me.id} /> : <ProgressionPanel clientId={me.id} />}
    </>
  );
}
