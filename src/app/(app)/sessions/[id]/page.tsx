"use client";

import { useParams } from "next/navigation";
import { WorkoutEditor } from "@/components/WorkoutEditor";

export default function EditSessionPage() {
  const { id } = useParams<{ id: string }>();
  return <WorkoutEditor logId={id} />;
}
