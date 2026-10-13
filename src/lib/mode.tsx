"use client";

import { createContext, useContext, type ReactNode } from "react";

/** « coach » : application complète. « client » : espace personnel d'un client. */
export type AppMode = "coach" | "client";

const ModeContext = createContext<AppMode>("coach");

export function ModeProvider({ mode, children }: { mode: AppMode; children: ReactNode }) {
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>;
}

export function useMode(): AppMode {
  return useContext(ModeContext);
}

/** Liens adaptés à l'espace (coach ou client). */
export function usePaths() {
  const mode = useMode();
  const client = mode === "client";
  return {
    mode,
    isClient: client,
    program: (id: string) => (client ? `/espace/programmes/${id}` : `/programs/${id}`),
    sessionNew: (q: { client?: string | null; program?: string | null } = {}) => {
      const params = new URLSearchParams();
      if (!client && q.client) params.set("client", q.client);
      if (q.program) params.set("program", q.program);
      const qs = params.toString();
      return `${client ? "/espace/seances/nouvelle" : "/sessions/new"}${qs ? `?${qs}` : ""}`;
    },
    session: (id: string) => (client ? `/espace/seances/${id}` : `/sessions/${id}`),
    clientSessions: (clientId: string) => (client ? "/espace/seances" : `/clients/${clientId}?tab=seances`),
    clientPrograms: (clientId: string | null) =>
      client ? "/espace" : clientId ? `/clients/${clientId}?tab=programmes` : "/programs",
    clientHome: (clientId: string) => (client ? "/espace" : `/clients/${clientId}`),
  };
}
