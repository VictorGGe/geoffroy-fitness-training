"use client";

import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui";
import { NutritionPanel } from "@/components/NutritionPanel";
import { getMyClientProfile } from "@/lib/data";
import { useAsync } from "@/lib/hooks";

export default function ClientNutritionPage() {
  const { data: me, loading, error, reload } = useAsync(() => getMyClientProfile());

  if (loading) return <LoadingBlock />;
  if (error || !me) return <ErrorBlock message={error ?? "Profil introuvable."} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Ma nutrition" subtitle="Note ce que tu manges et suis tes calories et tes macros au jour le jour." />
      <NutritionPanel clientId={me.id} />
    </>
  );
}
