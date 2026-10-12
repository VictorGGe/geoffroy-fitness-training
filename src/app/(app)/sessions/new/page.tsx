"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingBlock } from "@/components/ui";
import { WorkoutEditor } from "@/components/WorkoutEditor";

function NewSession() {
  const p = useSearchParams();
  return <WorkoutEditor initialClientId={p.get("client")} initialProgramId={p.get("program")} initialSessionId={p.get("session")} />;
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <NewSession />
    </Suspense>
  );
}
