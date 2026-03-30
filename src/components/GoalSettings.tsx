"use client";

import { useState } from "react";
import { PFCGoals } from "../types";

interface Props {
  goals: PFCGoals;
  onSave: (goals: PFCGoals) => void;
  onClose: () => void;
}

export default function GoalSettings({ goals, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    calories: goals.calories.toString(),
    protein: goals.protein.toString(),
    fat: goals.fat.toString(),
    carbs: goals.carbs.toString(),
  });

  const sanitizeNumber = (value: string) => value.replace(/^0+(\d)/, "$1");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      fat: Number(form.fat) || 0,
      carbs: Number(form.carbs) || 0,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg">1日の目標設定</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400 font-medium">カロリー (kcal)</label>
              <input
                type="number"
                value={form.calories}
                onChange={(e) => setForm({ ...form, calories: sanitizeNumber(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-center text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-blue-400 font-medium">タンパク質 (g)</label>
              <input
                type="number"
                value={form.protein}
                onChange={(e) => setForm({ ...form, protein: sanitizeNumber(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-blue-400 text-center text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-yellow-400 font-medium">脂質 (g)</label>
              <input
                type="number"
                value={form.fat}
                onChange={(e) => setForm({ ...form, fat: sanitizeNumber(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-yellow-400 text-center text-sm focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-emerald-400 font-medium">炭水化物 (g)</label>
              <input
                type="number"
                value={form.carbs}
                onChange={(e) => setForm({ ...form, carbs: sanitizeNumber(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-emerald-400 text-center text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors mt-1"
          >
            保存する
          </button>
        </form>
      </div>
    </div>
  );
}
