"use client";

import { useRef, useState } from "react";
import { Meal, Recipe, RecipeSet } from "../types";
import RecipeList from "./RecipeList";
import RecipeSetList from "./RecipeSetList";

interface Props {
  date: string;
  onAddMeal: (meal: Meal) => void;
  recipes: Recipe[];
  recipeSets: RecipeSet[];
  onChangeRecipes: (recipes: Recipe[]) => void;
  onChangeRecipeSets: (sets: RecipeSet[]) => void;
}

export default function MealInput({
  date,
  onAddMeal,
  recipes,
  recipeSets,
  onChangeRecipes,
  onChangeRecipeSets,
}: Props) {
  const [inputText, setInputText] = useState("");
  const [manualCal, setManualCal] = useState("");
  const [manualP, setManualP] = useState("");
  const [manualF, setManualF] = useState("");
  const [manualC, setManualC] = useState("");
  const [portion, setPortion] = useState("1");
  const [actualAmount, setActualAmount] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  const getTimestamp = () => {
    const today = new Date().toLocaleDateString("sv-SE");
    if (date === today) return Date.now();
    return new Date(`${date}T12:00:00`).getTime();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !manualCal) return;

    const multiplier = Number(portion) || 1;
    onAddMeal({
      id: crypto.randomUUID(),
      timestamp: getTimestamp(),
      date,
      description: inputText || "手入力",
      calories: Math.round((Number(manualCal) || 0) * multiplier),
      protein: Math.round((Number(manualP) || 0) * multiplier * 10) / 10,
      fat: Math.round((Number(manualF) || 0) * multiplier * 10) / 10,
      carbs: Math.round((Number(manualC) || 0) * multiplier * 10) / 10,
      isFromRecipe: !!selectedRecipe,
      recipeId: selectedRecipe?.id,
      actualAmount: Number(actualAmount) || undefined,
    });

    resetForm();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const resetForm = () => {
    setInputText("");
    setManualCal("");
    setManualP("");
    setManualF("");
    setManualC("");
    setPortion("1");
    setActualAmount("");
    setSelectedRecipe(null);
  };

  const handleRecipeSelect = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setInputText(recipe.name);
    setManualCal(recipe.calories.toString());
    setManualP(recipe.protein.toString());
    setManualF(recipe.fat.toString());
    setManualC(recipe.carbs.toString());
    setPortion("1");
    setActualAmount(recipe.baseAmount.toString());
  };

  const handleActualAmountChange = (value: string) => {
    setActualAmount(value);
    if (selectedRecipe && value) {
      setPortion((Number(value) / selectedRecipe.baseAmount).toFixed(2));
    }
  };

  const handlePortionChange = (value: string) => {
    setPortion(value);
    if (selectedRecipe && value) {
      setActualAmount((Number(value) * selectedRecipe.baseAmount).toFixed(0));
    }
  };

  const handleSetRecord = (
    description: string,
    nutrition: { calories: number; protein: number; fat: number; carbs: number }
  ) => {
    onAddMeal({
      id: crypto.randomUUID(),
      timestamp: getTimestamp(),
      date,
      description,
      ...nutrition,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <RecipeList
        recipes={recipes}
        onChange={onChangeRecipes}
        onSelectRecipe={handleRecipeSelect}
      />
      <RecipeSetList
        sets={recipeSets}
        recipes={recipes}
        onChange={onChangeRecipeSets}
        onRecord={handleSetRecord}
      />

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-xl transition-all relative">
        {selectedRecipe && (
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            レシピ選択中
            <button onClick={resetForm} className="ml-1 hover:text-emerald-200">×</button>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="食事名やメモ（例：朝食、筋肉カレー）"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none transition-all"
            rows={2}
          />

          <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-gray-900 border border-emerald-900/40 rounded-lg p-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 pb-2 border-b border-gray-800 gap-2">
              <span className="text-xs text-gray-400 font-bold">
                ベースの栄養素 (
                {selectedRecipe
                  ? `基準:${selectedRecipe.baseAmount}${selectedRecipe.unit}`
                  : "1人前"}
                )
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {selectedRecipe && (
                  <>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={actualAmount}
                        onChange={(e) => handleActualAmountChange(e.target.value)}
                        className="w-16 bg-gray-800 border border-emerald-500/50 rounded py-1 px-2 text-center text-white text-sm focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-xs text-gray-400">{selectedRecipe.unit}</span>
                    </div>
                    <span className="text-xs text-gray-600">or</span>
                  </>
                )}

                <div className="flex items-center gap-1">
                  <span className="text-xs text-emerald-400 font-bold">x</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={portion}
                    onChange={(e) => handlePortionChange(e.target.value)}
                    className="w-16 bg-gray-800 border border-emerald-500/50 rounded py-1 px-2 text-center text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">倍</span>
                </div>

                <span className="text-xs text-gray-400 font-mono ml-2">=</span>
                <span className="text-xs text-white font-mono bg-gray-800 px-2 py-1 rounded whitespace-nowrap">
                  {Math.round((Number(manualCal) || 0) * (Number(portion) || 1))} kcal
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase ml-1">Kcal</label>
                <input type="number" value={manualCal} onChange={(e) => setManualCal(e.target.value)} className="bg-gray-800 border border-gray-700/50 rounded p-2 text-center text-white text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase ml-1">P</label>
                <input type="number" value={manualP} onChange={(e) => setManualP(e.target.value)} className="bg-gray-800 border border-gray-700/50 rounded p-2 text-center text-blue-400 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase ml-1">F</label>
                <input type="number" value={manualF} onChange={(e) => setManualF(e.target.value)} className="bg-gray-800 border border-gray-700/50 rounded p-2 text-center text-yellow-400 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase ml-1">C</label>
                <input type="number" value={manualC} onChange={(e) => setManualC(e.target.value)} className="bg-gray-800 border border-gray-700/50 rounded p-2 text-center text-emerald-400 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!manualCal && !inputText.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
          >
            記録する
          </button>
        </form>
      </div>
    </div>
  );
}
