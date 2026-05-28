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
import { playerColorByIndex, playerColorMapFromStandings, playerIdsByStandings } from "@/lib/client/playerColors";
import type { PublicGamePayload } from "@/lib/server/gameState";

export function ScoreChart({ game }: { game: PublicGamePayload }) {
  const { points } = game.chart;
  const keys = useMemo(() => {
    const byStandings = playerIdsByStandings(game.standings);
    const known = new Set(byStandings);
    const trailing = game.chart.keys.filter((id) => !known.has(id));
    return [...byStandings, ...trailing];
  }, [game.standings, game.chart.keys]);
  const colors = useMemo(() => playerColorMapFromStandings(game.standings), [game.standings]);
  const yMax = useMemo(() => {
    let max = game.type === "hand-and-foot" ? 0 : game.targetScore;
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

  const nameById =
    game.type === "hand-and-foot"
      ? new Map(game.teams.map((t) => [t.id, t.name]))
      : new Map(game.players.map((p) => [p.id, p.displayName]));
  const legendPayload = keys.map((id) => ({
    value: nameById.get(id) ?? id,
    type: "line" as const,
    color: colors.get(id) ?? playerColorByIndex(0),
    id,
  }));

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
          {game.type !== "hand-and-foot" && game.targetScore > 0 ? (
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
          ) : null}
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
          {/* recharts Legend `payload` prop is supported at runtime; types omit it in this version */}
          <Legend
            {...({ payload: legendPayload } as object)}
            verticalAlign="bottom"
            height={44}
            wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
          />
          {keys.map((k) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={colors.get(k) ?? playerColorByIndex(0)}
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
