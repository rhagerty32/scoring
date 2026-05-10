"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PublicGamePayload } from "@/lib/server/gameState";

const PALETTE = ["#f97316", "#5eead4", "#fbbf24", "#fb7185", "#4ade80", "#38bdf8", "#fcd34d", "#f472b6"];

export function ScoreChart({ game }: { game: PublicGamePayload }) {
  const { points, keys } = game.chart;
  const yMax = useMemo(() => {
    let max = game.targetScore;
    for (const pt of points) {
      for (const k of keys) {
        const v = pt[k];
        if (typeof v === "number" && Number.isFinite(v) && v > max) max = v;
      }
    }
    return Math.ceil(max * 1.06);
  }, [points, keys, game.targetScore]);

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-6 text-base text-[var(--game-muted)] shadow-[var(--game-shadow)] sm:text-sm">
        Complete at least one round to see the chart.
      </div>
    );
  }

  const nameById = new Map(game.players.map((p) => [p.id, p.displayName]));

  return (
    <div className="h-[min(52svh,420px)] w-full rounded-2xl border border-white/10 bg-[var(--game-surface)] p-2 shadow-[var(--game-shadow)] sm:h-80 sm:p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 2, left: -8, bottom: 28 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="round" tick={{ fill: "var(--game-muted)", fontSize: 11 }} tickMargin={8} />
          <YAxis
            tick={{ fill: "var(--game-muted)", fontSize: 11 }}
            width={28}
            tickMargin={4}
            domain={[0, yMax]}
            allowDataOverflow={false}
          />
          <ReferenceLine
            y={game.targetScore}
            stroke="rgba(255,255,255,0.35)"
            strokeDasharray="5 5"
            label={{
              value: "Goal",
              position: "right",
              fill: "var(--game-muted)",
              fontSize: 10,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--game-surface-2)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "var(--game-text)",
              fontSize: 14,
              padding: "10px 12px",
            }}
            labelFormatter={(v) => `Round ${v}`}
            formatter={(value, name) => [value, nameById.get(String(name)) ?? name]}
          />
          <Legend
            verticalAlign="bottom"
            height={44}
            wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
            formatter={(value) => nameById.get(String(value)) ?? String(value)}
          />
          {keys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
