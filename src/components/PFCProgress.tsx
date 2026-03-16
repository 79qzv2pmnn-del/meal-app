"use client";

import { PFCGoals } from "../types";

interface Props {
  goals: PFCGoals;
  actual: { calories: number; protein: number; fat: number; carbs: number };
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOver = max > 0 && value > max;
  const isNear = !isOver && pct >= 80;
  const barColor = isOver ? "bg-red-500" : isNear ? "bg-yellow-500" : color;

  return (
    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function PFCProgress({ goals, actual }: Props) {
  if (!goals.calories) return null;

  const items = [
    {
      label: "Kcal",
      value: actual.calories,
      max: goals.calories,
      color: "bg-gray-300",
      valueColor: "text-white",
    },
    {
      label: "P",
      value: Math.round(actual.protein),
      max: goals.protein,
      color: "bg-blue-500",
      valueColor: "text-blue-400",
    },
    {
      label: "F",
      value: Math.round(actual.fat),
      max: goals.fat,
      color: "bg-yellow-500",
      valueColor: "text-yellow-400",
    },
    {
      label: "C",
      value: Math.round(actual.carbs),
      max: goals.carbs,
      color: "bg-emerald-500",
      valueColor: "text-emerald-400",
    },
  ];

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
      <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wider">
        目標達成率
      </p>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-medium w-6">{item.label}</span>
              <span>
                <span className={`font-bold ${item.valueColor}`}>{item.value}</span>
                <span className="text-gray-600"> / {item.max}</span>
                {item.max > 0 && (
                  <span className="text-gray-600 ml-1">
                    ({Math.round((item.value / item.max) * 100)}%)
                  </span>
                )}
              </span>
            </div>
            <ProgressBar value={item.value} max={item.max} color={item.color} />
          </div>
        ))}
      </div>
    </div>
  );
}
