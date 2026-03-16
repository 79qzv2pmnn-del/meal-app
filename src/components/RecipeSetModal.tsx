"use client";

import { useState } from "react";
import { Recipe, RecipeSet } from "../types";

interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface Props {
  set: RecipeSet;
  recipes: Recipe[];
  onRecord: (description: string, nutrition: Nutrition) => void;
  onClose: () => void;
}

export default function RecipeSetModal({ set, recipes, onRecord, onClose }: Props) {
  const [items, setItems] = useState(
    set.items.map(item => ({ ...item, enabled: true }))
  );

  const getRecipe = (id: string) => recipes.find(r => r.id === id);

  const calcNutrition = (recipeId: string, amount: number): Nutrition => {
    const recipe = getRecipe(recipeId);
    if (!recipe || recipe.baseAmount === 0) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
    const ratio = amount / recipe.baseAmount;
    return {
      calories: Math.round(recipe.calories * ratio),
      protein: Math.round(recipe.protein * ratio * 10) / 10,
      fat: Math.round(recipe.fat * ratio * 10) / 10,
      carbs: Math.round(recipe.carbs * ratio * 10) / 10,
    };
  };

  const totals = items
    .filter(i => i.enabled)
    .reduce((acc, item) => {
      const n = calcNutrition(item.recipeId, item.amount);
      return {
        calories: acc.calories + n.calories,
        protein: Math.round((acc.protein + n.protein) * 10) / 10,
        fat: Math.round((acc.fat + n.fat) * 10) / 10,
        carbs: Math.round((acc.carbs + n.carbs) * 10) / 10,
      };
    }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

  const handleRecord = () => {
    const description = items
      .filter(i => i.enabled)
      .map(i => {
        const r = getRecipe(i.recipeId);
        return r ? `${r.name}${i.amount}${r.unit}` : "";
      })
      .filter(Boolean)
      .join("、");
    onRecord(`${set.name}（${description}）`, totals);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="font-bold text-white">{set.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
        </div>

        <div className="p-4 flex flex-col gap-2 max-h-80 overflow-y-auto">
          {items.map((item, idx) => {
            const recipe = getRecipe(item.recipeId);
            if (!recipe) return null;
            const n = calcNutrition(item.recipeId, item.amount);
            return (
              <div
                key={item.recipeId}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${item.enabled ? "bg-gray-900 border-gray-700" : "bg-gray-900/40 border-gray-800 opacity-50"}`}
              >
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={e => setItems(items.map((it, i) => i === idx ? { ...it, enabled: e.target.checked } : it))}
                  className="w-4 h-4 accent-emerald-500 shrink-0"
                />
                <span className="flex-1 text-sm text-gray-200 truncate">{recipe.name}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.amount}
                    onChange={e => setItems(items.map((it, i) => i === idx ? { ...it, amount: Number(e.target.value) } : it))}
                    disabled={!item.enabled}
                    className="w-16 bg-gray-800 border border-gray-700 rounded p-1 text-center text-white text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-40"
                  />
                  <span className="text-xs text-gray-400">{recipe.unit}</span>
                </div>
                <span className="text-xs text-gray-500 w-14 text-right font-mono">{n.calories}kcal</span>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-gray-700">
          <div className="grid grid-cols-4 gap-2 text-center mb-4">
            <div><p className="text-[10px] text-gray-400">Kcal</p><p className="font-bold text-white">{totals.calories}</p></div>
            <div><p className="text-[10px] text-gray-400">P</p><p className="font-bold text-blue-400">{totals.protein}</p></div>
            <div><p className="text-[10px] text-gray-400">F</p><p className="font-bold text-yellow-400">{totals.fat}</p></div>
            <div><p className="text-[10px] text-gray-400">C</p><p className="font-bold text-emerald-400">{totals.carbs}</p></div>
          </div>
          <button
            onClick={handleRecord}
            disabled={items.filter(i => i.enabled).length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition-colors"
          >
            記録する
          </button>
        </div>
      </div>
    </div>
  );
}
