"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { fmtDate, fmtDateShort, fmtNum } from "@/lib/format";

export const CHART_COLORS = ["#4A6CF7", "#E7E9EE", "#7393FF", "#9AA2B2", "#2443BD"];

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
  dashed?: boolean;
}

function DarkTooltip({ active, payload, label, unit }: Partial<TooltipContentProps<number, string>> & { unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <p className="mb-1 font-medium text-ink-200">{fmtDate(String(label))}</p>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => (
          <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink-300">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name} : <span className="font-semibold tabular-nums text-white">{fmtNum(p.value, 2)}{unit ? ` ${unit}` : ""}</span>
          </p>
        ))}
    </div>
  );
}

/**
 * Graphique d'évolution dans le temps.
 * Les points sont reliés uniquement entre valeurs réellement saisies (connectNulls) :
 * aucune valeur intermédiaire n'est inventée, les points affichés sont les mesures réelles.
 */
export function TimeChart({
  data,
  series,
  unit,
  height = 260,
  references = [],
}: {
  data: Record<string, unknown>[];
  series: SeriesDef[];
  unit?: string;
  height?: number;
  references?: { y: number; label: string; color?: string }[];
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => fmtDateShort(String(d))} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            domain={["auto", "auto"]}
            tickFormatter={(v) => fmtNum(v)}
          />
          <Tooltip content={<DarkTooltip unit={unit} />} cursor={{ stroke: "#454E61", strokeDasharray: "3 3" }} />
          {references.map((r) => (
            <ReferenceLine
              key={r.label}
              y={r.y}
              stroke={r.color ?? "#22c55e"}
              strokeDasharray="6 4"
              ifOverflow="extendDomain"
              label={{ value: r.label, position: "insideTopRight", fill: r.color ?? "#22c55e", fontSize: 11 }}
            />
          ))}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2.5}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              dot={{ r: 3.5, strokeWidth: 0, fill: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
              activeDot={{ r: 5.5 }}
              connectNulls
              isAnimationActive
              animationDuration={700}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
