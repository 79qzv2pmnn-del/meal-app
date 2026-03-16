"use client";

import { useState } from "react";
import { Recipe, RecipeSet, RecipeSetItem } from "../types";
import RecipeSetModal from "./RecipeSetModal";

interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface Props {
  sets: RecipeSet[];
  recipes: Recipe[];
  onRecord: (description: string, nutrition: Nutrition) => void;
  onChange: (sets: RecipeSet[]) => void;
}

export default function RecipeSetList({
  sets,
  recipes,
  onRecord,
  onChange,
}: Props) {
  const [selectedSet, setSelectedSet] = useState<RecipeSet | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newItems, setNewItems] = useState<RecipeSetItem[]>([]);

  const handleAddRecipe = (recipe: Recipe) => {
    if (newItems.find((item) => item.recipeId === recipe.id)) return;
    setNewItems([...newItems, { recipeId: recipe.id, amount: recipe.baseAmount }]);
  };

  const handleSave = () => {
    if (!newName.trim() || newItems.length === 0) return;

    onChange(
      editingId
        ? sets.map((set) =>
            set.id === editingId
              ? { ...set, name: newName.trim(), items: newItems }
              : set
          )
        : [...sets, { id: crypto.randomUUID(), name: newName.trim(), items: newItems }]
    );

    setIsAdding(false);
    setEditingId(null);
    setNewName("");
    setNewItems([]);
  };

  const handleEdit = (set: RecipeSet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(set.id);
    setNewName(set.name);
    setNewItems(set.items);
    setIsAdding(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("このセットを削除しますか？")) {
      onChange(sets.filter((set) => set.id !== id));
    }
  };

  const handleRecord = (description: string, nutrition: Nutrition) => {
    onRecord(description, nutrition);
    setSelectedSet(null);
  };

  const getRecipeName = (id: string) =>
    recipes.find((recipe) => recipe.id === id)?.name ?? "？";

  if (sets.length === 0 && !isAdding) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-xl mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            定番セット
          </h2>
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            ＋ 新規作成
          </button>
        </div>
        <p className="text-gray-500 text-sm text-center py-3">よく食べる組み合わせを登録しましょう</p>
      </div>
    );
  }

  return (
    <>
      {selectedSet && (
        <RecipeSetModal
          set={selectedSet}
          recipes={recipes}
          onRecord={handleRecord}
          onClose={() => setSelectedSet(null)}
        />
      )}

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            定番セット
          </h2>
          <button
            onClick={() => {
              setIsAdding(!isAdding);
              setEditingId(null);
              setNewName("");
              setNewItems([]);
            }}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${isAdding ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white font-medium"}`}
          >
            {isAdding ? "キャンセル" : "＋ 新規作成"}
          </button>
        </div>

        {isAdding && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-emerald-900/50 flex flex-col gap-3">
            <input
              type="text"
              placeholder="セット名（例：定番朝食）"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-gray-800 border-b border-gray-600 p-2 text-white focus:outline-none focus:border-emerald-500"
            />

            {newItems.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-gray-400">選択中のレシピ</p>
                {newItems.map((item, idx) => (
                  <div key={item.recipeId} className="flex items-center gap-2 bg-gray-800 rounded p-2">
                    <span className="flex-1 text-sm text-gray-200 truncate">{getRecipeName(item.recipeId)}</span>
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) =>
                        setNewItems(
                          newItems.map((current, currentIndex) =>
                            currentIndex === idx
                              ? { ...current, amount: Number(e.target.value) }
                              : current
                          )
                        )
                      }
                      className="w-16 bg-gray-700 rounded p-1 text-center text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-gray-400">{recipes.find((recipe) => recipe.id === item.recipeId)?.unit}</span>
                    <button
                      onClick={() => setNewItems(newItems.filter((_, currentIndex) => currentIndex !== idx))}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs text-gray-400 mb-1.5">レシピから追加</p>
              <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
                {recipes
                  .filter((recipe) => !newItems.find((item) => item.recipeId === recipe.id))
                  .map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => handleAddRecipe(recipe)}
                      className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded p-2 text-left transition-colors"
                    >
                      <span className="text-sm text-gray-200">{recipe.name}</span>
                      <span className="text-xs text-emerald-400">＋</span>
                    </button>
                  ))}
                {recipes.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">先にマイレシピを登録してください</p>
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!newName.trim() || newItems.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold py-2 rounded-lg transition-colors"
            >
              {editingId ? "更新する" : "保存する"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sets.map((set) => (
            <div
              key={set.id}
              onClick={() => setSelectedSet(set)}
              className="bg-gray-900 border border-gray-700 hover:border-emerald-500/50 hover:bg-gray-800 rounded-lg p-3 cursor-pointer group transition-all"
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-gray-200 text-sm truncate mr-1">{set.name}</h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button onClick={(e) => handleEdit(set, e)} className="text-gray-600 hover:text-blue-400 p-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={(e) => handleDelete(set.id, e)} className="text-gray-600 hover:text-red-400 p-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 truncate">
                {set.items.map((item) => getRecipeName(item.recipeId)).join("・")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
