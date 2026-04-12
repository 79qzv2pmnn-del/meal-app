"use client";

import { useState } from "react";
import { Meal } from "../types";

interface Props {
  meals: Meal[];
  onDelete: (id: string) => void;
  onUpdate: (meal: Meal) => void;
  onCopy: (meal: Meal) => void;
  onSaveToRecipe?: (meal: Meal) => void;
}

export default function MealList({ meals, onDelete, onUpdate, onCopy, onSaveToRecipe }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    description: string;
    calories: string;
    protein: string;
    fat: string;
    carbs: string;
    time: string;
    actualAmount: string;
    baseAmount: string;
    baseCalories: number;
    baseProtein: number;
    baseFat: number;
    baseCarbs: number;
  } | null>(null);

  if (meals.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 text-sm">
        まだ本日の記録がありません。<br />上のフォームから食事を追加してください。
      </div>
    );
  }

  const handleEditClick = (meal: Meal) => {
    const date = new Date(meal.timestamp);
    const timeString = `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    setEditingId(meal.id);
    setEditForm({
      description: meal.description,
      calories: meal.calories.toString(),
      protein: meal.protein.toString(),
      fat: meal.fat.toString(),
      carbs: meal.carbs.toString(),
      time: timeString,
      actualAmount: meal.actualAmount?.toString() ?? "",
      baseAmount: meal.actualAmount?.toString() ?? "",
      baseCalories: meal.calories,
      baseProtein: meal.protein,
      baseFat: meal.fat,
      baseCarbs: meal.carbs,
    });
  };

  const handleSave = (meal: Meal) => {
    if (!editForm) return;

    const [hours, minutes] = editForm.time.split(":").map(Number);
    const date = new Date(meal.timestamp);
    date.setHours(hours);
    date.setMinutes(minutes);

    onUpdate({
      ...meal,
      description: editForm.description,
      calories: Number(editForm.calories) || 0,
      protein: Number(editForm.protein) || 0,
      fat: Number(editForm.fat) || 0,
      carbs: Number(editForm.carbs) || 0,
      timestamp: date.getTime(),
      actualAmount: editForm.actualAmount ? Number(editForm.actualAmount) : meal.actualAmount,
    });

    setEditingId(null);
    setEditForm(null);
  };

  return (
    <div className="space-y-4">
      {meals.map((meal) => (
        <div key={meal.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm flex flex-col gap-3">
          {editingId === meal.id && editForm ? (
            <div className="flex flex-col gap-3 animate-in fade-in duration-200">
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs text-emerald-400 font-bold">レコード編集</span>
                <div className="flex items-center gap-2">
                  {editForm.baseAmount && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editForm.actualAmount}
                        onChange={(e) => {
                          const newAmount = e.target.value;
                          const base = Number(editForm.baseAmount);
                          if (base > 0 && newAmount) {
                            const ratio = Number(newAmount) / base;
                            setEditForm({
                              ...editForm,
                              actualAmount: newAmount,
                              calories: Math.round(editForm.baseCalories * ratio).toString(),
                              protein: (Math.round(editForm.baseProtein * ratio * 10) / 10).toString(),
                              fat: (Math.round(editForm.baseFat * ratio * 10) / 10).toString(),
                              carbs: (Math.round(editForm.baseCarbs * ratio * 10) / 10).toString(),
                            });
                          } else {
                            setEditForm({ ...editForm, actualAmount: newAmount });
                          }
                        }}
                        className="w-16 bg-gray-900 border border-emerald-500/50 rounded p-1 text-center text-white text-sm focus:border-emerald-500 focus:outline-none"
                        placeholder="量"
                      />
                      <span className="text-xs text-gray-400">g</span>
                    </div>
                  )}
                  <input
                    type="time"
                    value={editForm.time}
                    onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                    className="bg-gray-900 border border-gray-700 rounded p-1 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-emerald-500 focus:outline-none resize-none"
                rows={2}
              />

              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase">Kcal</label>
                  <input type="number" value={editForm.calories} onChange={(e) => setEditForm({ ...editForm, calories: e.target.value })} className="bg-gray-900 border border-gray-700 rounded p-1.5 text-center text-white text-sm focus:border-emerald-500 focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase">P</label>
                  <input type="number" value={editForm.protein} onChange={(e) => setEditForm({ ...editForm, protein: e.target.value })} className="bg-gray-900 border border-gray-700 rounded p-1.5 text-center text-blue-400 text-sm focus:border-emerald-500 focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase">F</label>
                  <input type="number" value={editForm.fat} onChange={(e) => setEditForm({ ...editForm, fat: e.target.value })} className="bg-gray-900 border border-gray-700 rounded p-1.5 text-center text-yellow-400 text-sm focus:border-emerald-500 focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase">C</label>
                  <input type="number" value={editForm.carbs} onChange={(e) => setEditForm({ ...editForm, carbs: e.target.value })} className="bg-gray-900 border border-gray-700 rounded p-1.5 text-center text-emerald-400 text-sm focus:border-emerald-500 focus:outline-none" />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors">
                  キャンセル
                </button>
                <button onClick={() => handleSave(meal)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors">
                  保存する
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400 font-medium whitespace-pre-wrap">
                    {new Date(meal.timestamp).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}{" "}
                    {meal.isFromRecipe && <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800 ml-1">レシピ追加</span>}
                  </span>
                  <p className="text-gray-200 mt-1 whitespace-pre-wrap leading-relaxed">{meal.description}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEditClick(meal)} className="text-gray-600 hover:text-blue-400 transition-colors p-1" aria-label="編集">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => onCopy(meal)} className="text-gray-600 hover:text-emerald-400 transition-colors p-1" aria-label="コピー">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                  {onSaveToRecipe && (
                    <button onClick={() => onSaveToRecipe(meal)} className="text-gray-600 hover:text-yellow-400 transition-colors p-1" aria-label="マイレシピに保存">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    </button>
                  )}
                  <button onClick={() => onDelete(meal.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1" aria-label="削除">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex gap-4 text-sm mt-2 pt-3 border-t border-gray-700">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">Kcal</span>
                  <span className="font-semibold text-white">{meal.calories}</span>
                </div>
                <div className="flex flex-col border-l border-gray-700 pl-4">
                  <span className="text-xs text-gray-500">P (g)</span>
                  <span className="font-semibold text-blue-400">{meal.protein}</span>
                </div>
                <div className="flex flex-col border-l border-gray-700 pl-4">
                  <span className="text-xs text-gray-500">F (g)</span>
                  <span className="font-semibold text-yellow-400">{meal.fat}</span>
                </div>
                <div className="flex flex-col border-l border-gray-700 pl-4">
                  <span className="text-xs text-gray-500">C (g)</span>
                  <span className="font-semibold text-emerald-400">{meal.carbs}</span>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
