"use client";

import { useState } from "react";
import { Recipe, RecipeSet, PFCGoals } from "../types";

interface NutritionTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface PlannedItem {
  id: string;
  label: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  amount: number;
  unit: string;
}

interface Props {
  goals: PFCGoals;
  todayTotals: NutritionTotals;
  recipes: Recipe[];
  recipeSets: RecipeSet[];
  onClose: () => void;
}

function scaleNutrition(recipe: Recipe, amount: number) {
  const ratio = amount > 0 ? amount / recipe.baseAmount : 1;
  return {
    calories: Math.round(recipe.calories * ratio),
    protein: Math.round(recipe.protein * ratio * 10) / 10,
    fat: Math.round(recipe.fat * ratio * 10) / 10,
    carbs: Math.round(recipe.carbs * ratio * 10) / 10,
  };
}

export default function AIConsultModal({ goals, todayTotals, recipes, recipeSets, onClose }: Props) {
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([]);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [showSetPicker, setShowSetPicker] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualFat, setManualFat] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [checkedRecipeIds, setCheckedRecipeIds] = useState<Set<string>>(new Set());

  // 計画済みの合計
  const plannedTotals = plannedItems.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      fat: acc.fat + item.fat,
      carbs: acc.carbs + item.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  // 残り（摂取済み + 計画済みを引いた値）
  const remaining = {
    calories: Math.max(0, goals.calories - todayTotals.calories - plannedTotals.calories),
    protein: Math.max(0, goals.protein - todayTotals.protein - plannedTotals.protein),
    fat: Math.max(0, goals.fat - todayTotals.fat - plannedTotals.fat),
    carbs: Math.max(0, goals.carbs - todayTotals.carbs - plannedTotals.carbs),
  };

  const rawRemaining = {
    calories: goals.calories - todayTotals.calories - plannedTotals.calories,
    protein: goals.protein - todayTotals.protein - plannedTotals.protein,
    fat: goals.fat - todayTotals.fat - plannedTotals.fat,
    carbs: goals.carbs - todayTotals.carbs - plannedTotals.carbs,
  };

  const toggleRecipeCheck = (recipe: Recipe) => {
    const alreadyChecked = checkedRecipeIds.has(recipe.id);
    setCheckedRecipeIds((prev) => {
      const next = new Set(prev);
      if (alreadyChecked) next.delete(recipe.id);
      else next.add(recipe.id);
      return next;
    });
    if (alreadyChecked) {
      // チェックを外したら前提リストからも除去（同名の最後の1件を削除）
      setPlannedItems((prev) => {
        const idx = [...prev].reverse().findIndex((item) => item.label === recipe.name);
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        return prev.filter((_, i) => i !== realIdx);
      });
    } else {
      const nutrition = scaleNutrition(recipe, recipe.baseAmount);
      setPlannedItems((prev) => [
        ...prev,
        { id: crypto.randomUUID(), label: recipe.name, amount: recipe.baseAmount, unit: recipe.unit, ...nutrition },
      ]);
    }
  };

  const addRecipeSet = (set: RecipeSet) => {
    const newItems: PlannedItem[] = set.items
      .map((item) => {
        const recipe = recipes.find((r) => r.id === item.recipeId);
        if (!recipe) return null;
        const nutrition = scaleNutrition(recipe, item.amount);
        return {
          id: crypto.randomUUID(),
          label: recipe.name,
          amount: item.amount,
          unit: recipe.unit,
          ...nutrition,
        } as PlannedItem;
      })
      .filter(Boolean) as PlannedItem[];
    setPlannedItems((prev) => [...prev, ...newItems]);
    setShowSetPicker(false);
  };

  const addManual = () => {
    if (!manualName.trim()) return;
    const item: PlannedItem = {
      id: crypto.randomUUID(),
      label: manualName.trim(),
      amount: 0,
      unit: "",
      calories: Number(manualCalories) || 0,
      protein: Number(manualProtein) || 0,
      fat: Number(manualFat) || 0,
      carbs: Number(manualCarbs) || 0,
    };
    setPlannedItems((prev) => [...prev, item]);
    setManualName("");
    setManualCalories("");
    setManualProtein("");
    setManualFat("");
    setManualCarbs("");
    setShowManualForm(false);
  };

  const removeItem = (id: string) => {
    const item = plannedItems.find((i) => i.id === id);
    if (item) {
      const recipe = recipes.find((r) => r.name === item.label);
      if (recipe) {
        setCheckedRecipeIds((prev) => {
          const next = new Set(prev);
          next.delete(recipe.id);
          return next;
        });
      }
    }
    setPlannedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const generatePrompt = () => {
    const lines: string[] = [];

    lines.push("# 食事提案をお願いします");
    lines.push("");
    lines.push("## 今日の目標栄養素");
    lines.push(`- カロリー: ${goals.calories} kcal`);
    lines.push(`- タンパク質: ${goals.protein} g`);
    lines.push(`- 脂質: ${goals.fat} g`);
    lines.push(`- 炭水化物: ${goals.carbs} g`);
    lines.push("");
    lines.push("## 今日すでに摂取した栄養素");
    lines.push(`- カロリー: ${todayTotals.calories} kcal`);
    lines.push(`- タンパク質: ${Math.round(todayTotals.protein * 10) / 10} g`);
    lines.push(`- 脂質: ${Math.round(todayTotals.fat * 10) / 10} g`);
    lines.push(`- 炭水化物: ${Math.round(todayTotals.carbs * 10) / 10} g`);

    if (plannedItems.length > 0) {
      lines.push("");
      lines.push("## これから食べる予定（前提条件）");
      plannedItems.forEach((item) => {
        const amtStr = item.amount > 0 ? ` (${item.amount}${item.unit})` : "";
        lines.push(`- ${item.label}${amtStr}: ${item.calories} kcal / P ${item.protein}g / F ${item.fat}g / C ${item.carbs}g`);
      });
      lines.push("");
      lines.push("## 前提を含めた残り栄養素");
    } else {
      lines.push("");
      lines.push("## 残り栄養素");
    }

    lines.push(`- カロリー: ${rawRemaining.calories} kcal${rawRemaining.calories < 0 ? "（超過）" : ""}`);
    lines.push(`- タンパク質: ${Math.round(rawRemaining.protein * 10) / 10} g${rawRemaining.protein < 0 ? "（超過）" : ""}`);
    lines.push(`- 脂質: ${Math.round(rawRemaining.fat * 10) / 10} g${rawRemaining.fat < 0 ? "（超過）" : ""}`);
    lines.push(`- 炭水化物: ${Math.round(rawRemaining.carbs * 10) / 10} g${rawRemaining.carbs < 0 ? "（超過）" : ""}`);

    if (recipes.length > 0) {
      lines.push("");
      lines.push("## 使えるマイレシピ一覧");
      recipes.forEach((r) => {
        lines.push(`- ${r.name} (${r.baseAmount}${r.unit}あたり): ${r.calories} kcal / P ${r.protein}g / F ${r.fat}g / C ${r.carbs}g`);
      });
    }

    lines.push("");
    lines.push("上記の残り栄養素にできるだけ近づくような食事を提案してください。");
    lines.push("カロリーよりもP・F・C（タンパク質・脂質・炭水化物）のグラム数を優先して近づけてください。カロリーはPFCから逆算されるため、PFCが合えばカロリーの多少のズレは問題ありません。");
    lines.push("マイレシピの中から使えるものがあれば優先的に提案してください。");

    return lines.join("\n");
  };

  const handleCopy = async () => {
    const prompt = generatePrompt();
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredRecipes = recipes.filter(
    (r) =>
      recipeSearch === "" ||
      r.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(recipeSearch.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl w-full max-w-lg border border-gray-700 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">AIに相談</h2>
            <p className="text-xs text-gray-400 mt-0.5">残り栄養素とレシピをAI用プロンプトにまとめます</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">
          {/* 今日の摂取済み */}
          <div>
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">摂取済み</h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Kcal", value: todayTotals.calories, color: "text-white" },
                { label: "P", value: Math.round(todayTotals.protein * 10) / 10 + "g", color: "text-blue-400" },
                { label: "F", value: Math.round(todayTotals.fat * 10) / 10 + "g", color: "text-yellow-400" },
                { label: "C", value: Math.round(todayTotals.carbs * 10) / 10 + "g", color: "text-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-900 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500">{label}</p>
                  <p className={`text-sm font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 前提条件 */}
          <div>
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
              これから食べる予定（前提条件）
            </h3>

            {plannedItems.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {plannedItems.map((item) => (
                  <div key={item.id} className="bg-gray-900 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.label}</p>
                      <p className="text-xs text-gray-500">
                        {item.calories}kcal / P{item.protein}g / F{item.fat}g / C{item.carbs}g
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 追加ボタン群 */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setShowRecipePicker(true); setShowSetPicker(false); setShowManualForm(false); }}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg transition-colors border border-gray-600"
              >
                + マイレシピから
              </button>
              {recipeSets.length > 0 && (
                <button
                  onClick={() => { setShowSetPicker(true); setShowRecipePicker(false); setShowManualForm(false); }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg transition-colors border border-gray-600"
                >
                  + 定番セットから
                </button>
              )}
              <button
                onClick={() => { setShowManualForm(true); setShowRecipePicker(false); setShowSetPicker(false); }}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg transition-colors border border-gray-600"
              >
                + 手動入力
              </button>
            </div>

            {/* マイレシピピッカー */}
            {showRecipePicker && (
              <div className="mt-3 bg-gray-900 rounded-xl border border-gray-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 font-medium">マイレシピを選択</p>
                  <button onClick={() => { setShowRecipePicker(false); setCheckedRecipeIds(new Set()); setRecipeSearch(""); }} className="text-gray-500 hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  placeholder="レシピ名で検索..."
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none mb-2"
                />
                {filteredRecipes.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2 text-center">レシピがありません</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {filteredRecipes.map((recipe) => {
                      const checked = checkedRecipeIds.has(recipe.id);
                      return (
                        <button
                          key={recipe.id}
                          onClick={() => toggleRecipeCheck(recipe)}
                          className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors text-left w-full ${checked ? "bg-emerald-900/40 border border-emerald-700/50" : "hover:bg-gray-700 border border-transparent"}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white">{recipe.name}</p>
                            <p className="text-xs text-gray-500">
                              {recipe.baseAmount}{recipe.unit} — {recipe.calories}kcal / P{recipe.protein}g / F{recipe.fat}g / C{recipe.carbs}g
                            </p>
                          </div>
                          {checked && (
                            <span className="text-xs text-emerald-400 font-medium flex-shrink-0">選択中</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 定番セットピッカー */}
            {showSetPicker && (
              <div className="mt-3 bg-gray-900 rounded-xl border border-gray-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 font-medium">定番セットを選択</p>
                  <button onClick={() => setShowSetPicker(false)} className="text-gray-500 hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {recipeSets.map((set) => {
                    const setTotal = set.items.reduce((acc, item) => {
                      const recipe = recipes.find((r) => r.id === item.recipeId);
                      if (!recipe) return acc;
                      const n = scaleNutrition(recipe, item.amount);
                      return {
                        calories: acc.calories + n.calories,
                        protein: acc.protein + n.protein,
                      };
                    }, { calories: 0, protein: 0 });
                    return (
                      <button
                        key={set.id}
                        onClick={() => addRecipeSet(set)}
                        className="text-left px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <p className="text-sm text-white">{set.name}</p>
                        <p className="text-xs text-gray-500">
                          {set.items.length}品 — 計 {setTotal.calories}kcal / P{Math.round(setTotal.protein * 10) / 10}g
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 手動入力フォーム */}
            {showManualForm && (
              <div className="mt-3 bg-gray-900 rounded-xl border border-gray-700 p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400 font-medium">手動入力</p>
                  <button onClick={() => setShowManualForm(false)} className="text-gray-500 hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="食事名（例：筋肉カレー）"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none mb-2"
                />
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: "Kcal", value: manualCalories, setter: setManualCalories, placeholder: "650" },
                    { label: "P(g)", value: manualProtein, setter: setManualProtein, placeholder: "35" },
                    { label: "F(g)", value: manualFat, setter: setManualFat, placeholder: "15" },
                    { label: "C(g)", value: manualCarbs, setter: setManualCarbs, placeholder: "80" },
                  ].map(({ label, value, setter, placeholder }) => (
                    <label key={label} className="flex flex-col gap-1">
                      <span className="text-[10px] text-gray-500">{label}</span>
                      <input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        placeholder={placeholder}
                        className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
                <button
                  onClick={addManual}
                  disabled={!manualName.trim()}
                  className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                >
                  追加
                </button>
              </div>
            )}
          </div>

          {/* 残り栄養素（前提差し引き後） */}
          <div>
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
              残り栄養素{plannedItems.length > 0 ? "（前提を差し引き後）" : ""}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Kcal", value: rawRemaining.calories, color: "text-white" },
                { label: "P", value: Math.round(rawRemaining.protein * 10) / 10 + "g", color: "text-blue-400" },
                { label: "F", value: Math.round(rawRemaining.fat * 10) / 10 + "g", color: "text-yellow-400" },
                { label: "C", value: Math.round(rawRemaining.carbs * 10) / 10 + "g", color: "text-emerald-400" },
              ].map(({ label, value, color }) => {
                const numVal = typeof value === "number" ? value : parseFloat(value);
                const isOver = numVal < 0;
                return (
                  <div key={label} className={`bg-gray-900 rounded-lg p-2 text-center ${isOver ? "border border-red-500/30" : ""}`}>
                    <p className="text-[10px] text-gray-500">{label}</p>
                    <p className={`text-sm font-bold ${isOver ? "text-red-400" : color}`}>{value}</p>
                    {isOver && <p className="text-[9px] text-red-500">超過</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* フッター：コピーボタン */}
        <div className="p-5 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={handleCopy}
            className={`w-full font-bold py-3 rounded-xl transition-colors text-sm ${
              copied
                ? "bg-emerald-700 text-white"
                : "bg-emerald-500 hover:bg-emerald-400 text-gray-950"
            }`}
          >
            {copied ? "コピーしました！" : "プロンプトをコピー"}
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            ChatGPT や Claude にそのまま貼り付けて相談できます
          </p>
        </div>
      </div>
    </div>
  );
}
