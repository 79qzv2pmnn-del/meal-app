"use client";

interface Props {
  selectedDate: string;
  onChange: (date: string) => void;
}

export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

function formatLabel(dateKey: string): { main: string; badge: string | null } {
  const todayKey = toDateKey();
  const yesterdayKey = addDays(todayKey, -1);
  const date = new Date(dateKey + "T00:00:00");
  const main = date.toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  if (dateKey === todayKey) return { main, badge: "TODAY" };
  if (dateKey === yesterdayKey) return { main, badge: "昨日" };
  return { main, badge: date.getFullYear().toString() };
}

export default function DateNavigator({ selectedDate, onChange }: Props) {
  const todayKey = toDateKey();
  const isToday = selectedDate === todayKey;
  const { main, badge } = formatLabel(selectedDate);

  return (
    <div className="flex items-center justify-between bg-gray-800/40 rounded-xl px-3 py-2.5 border border-gray-700/50">
      <button
        onClick={() => onChange(addDays(selectedDate, -1))}
        className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
        aria-label="前の日"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-0.5">
          {badge && (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isToday
                  ? "text-emerald-400 bg-emerald-400/10"
                  : "text-gray-400 bg-gray-700/50"
              }`}
            >
              {badge}
            </span>
          )}
          {!isToday && (
            <button
              onClick={() => onChange(todayKey)}
              className="text-xs text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition-colors"
            >
              今日に戻る
            </button>
          )}
        </div>
        <p className="text-sm font-semibold text-white">{main}</p>
      </div>

      <button
        onClick={() => onChange(addDays(selectedDate, 1))}
        disabled={isToday}
        className={`p-1.5 rounded-lg transition-colors ${
          isToday
            ? "text-gray-700 cursor-not-allowed"
            : "text-gray-400 hover:text-white hover:bg-gray-700/50"
        }`}
        aria-label="次の日"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
