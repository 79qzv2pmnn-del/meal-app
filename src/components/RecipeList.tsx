"use client";

import { useState } from "react";
import { Recipe } from "../types";

interface Props {
  recipes: Recipe[];
  onChange: (recipes: Recipe[]) => void;
  onSelectRecipe: (recipe: Recipe) => void;
}

export default function RecipeList({ recipes, onChange, onSelectRecipe }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [baseAmount, setBaseAmount] = useState("100");
  const [unit, setUnit] = useState("g");

  const resetForm = () => {
    setName("");
    setDescription("");
    setCalories("");
    setProtein("");
    setFat("");
    setCarbs("");
    setBaseAmount("100");
    setUnit("g");
  };

  const handleAddRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newRecipe: Recipe = {
      id: editingId || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbs: Number(carbs) || 0,
      baseAmount: Number(baseAmount) || 1,
      unit: unit.trim() || "人前",
    };

    onChange(
      editingId
        ? recipes.map((recipe) => (recipe.id === editingId ? newRecipe : recipe))
        : [...recipes, newRecipe]
    );

    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  const handleEdit = (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(recipe.id);
    setName(recipe.name);
    setDescription(recipe.description || "");
    setCalories(recipe.calories.toString());
    setProtein(recipe.protein.toString());
    setFat(recipe.fat.toString());
    setCarbs(recipe.carbs.toString());
    setBaseAmount(recipe.baseAmount.toString());
    setUnit(recipe.unit);
    setIsAdding(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("このマイレシピを削除しますか？")) {
      onChange(recipes.filter((recipe) => recipe.id !== id));
    }
  };

  const filteredRecipes = recipes.filter(
    (recipe) =>
      recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-xl mb-6">
      <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2 whitespace-nowrap">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          マイレシピ
        </h2>

        <div className="flex-1 min-w-[150px] max-w-sm">
          <div className="relative">
            <input
              type="text"
              placeholder="レシピを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-full py-1.5 px-3 pl-8 text-sm text-gray-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        <button
          onClick={() => {
            if (isAdding) {
              setIsAdding(false);
              setEditingId(null);
              resetForm();
            } else {
              setIsAdding(true);
            }
          }}
          className={`text-sm px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${isAdding ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-900/20"}`}
        >
          {isAdding ? "キャンセル" : "＋ 新規登録"}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddRecipe} className="bg-gray-900 p-4 rounded-lg mb-4 border border-emerald-900/50">
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="レシピ名（例：筋肉カレー）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-800 border-b border-gray-600 p-2 text-white focus:outline-none focus:border-emerald-500"
              required
            />
            <input
              type="text"
              placeholder="メモ（オプション）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-gray-800 border-b border-gray-600 p-2 text-sm text-gray-300 focus:outline-none focus:border-emerald-500"
            />

            <div className="grid grid-cols-4 gap-2 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase">Kcal</label>
                <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} className="bg-gray-800 rounded p-2 text-center text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase">P (g)</label>
                <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} className="bg-gray-800 rounded p-2 text-center text-blue-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase">F (g)</label>
                <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} className="bg-gray-800 rounded p-2 text-center text-yellow-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase">C (g)</label>
                <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} className="bg-gray-800 rounded p-2 text-center text-emerald-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" required />
              </div>
            </div>

            <div className="flex gap-4 mt-2">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase">基準量 (数値)</label>
                <input type="number" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} placeholder="100" className="bg-gray-800 border-b border-gray-600 p-2 text-white text-sm focus:outline-none focus:border-emerald-500" required />
              </div>
              <div className="flex-x flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase">単位</label>
                <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g" className="w-20 bg-gray-800 border-b border-gray-600 p-2 text-white text-sm focus:outline-none focus:border-emerald-500" required />
              </div>
            </div>

            <button type="submit" className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg transition-colors">
              {editingId ? "更新する" : "保存する"}
            </button>
          </div>
        </form>
      )}

      {filteredRecipes.length === 0 && !isAdding ? (
        <p className="text-gray-500 text-sm text-center py-4">{recipes.length === 0 ? "マイレシピがありません。「＋ 新規登録」から追加しましょう。" : "検索条件に一致するレシピがありません。"}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
          {filteredRecipes.map((recipe) => (
            <div
              key={recipe.id}
              onClick={() => onSelectRecipe(recipe)}
              className="bg-gray-900 border border-gray-700 hover:border-emerald-500/50 hover:bg-gray-800 rounded-md p-2 cursor-pointer group transition-all flex flex-col justify-between min-h-[60px] sm:min-h-[70px]"
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-gray-200 text-xs truncate mr-1" title={recipe.name}>{recipe.name}</h3>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => handleEdit(recipe, e)} className="text-gray-500 hover:text-blue-400 p-0.5" title="編集">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={(e) => handleDelete(recipe.id, e)} className="text-gray-500 hover:text-red-400 p-0.5" title="削除">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500 mb-0.5 truncate h-3">
                  {recipe.baseAmount}{recipe.unit} {recipe.description && `・ ${recipe.description}`}
                </div>
                <div className="flex gap-1.5 text-[10px] font-mono leading-none">
                  <span className="text-gray-400">{recipe.calories}k</span>
                  <span className="text-blue-400">P{recipe.protein}</span>
                  <span className="text-yellow-400">F{recipe.fat}</span>
                  <span className="text-emerald-400">C{recipe.carbs}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
