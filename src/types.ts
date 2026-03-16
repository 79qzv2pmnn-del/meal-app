export interface Meal {
    id: string;
    timestamp: number;
    date: string;         // 'YYYY-MM-DD' — 日付履歴・フィルタリング用
    description: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    imageUrl?: string;
    isFromRecipe?: boolean;
    recipeId?: string;
    actualAmount?: number;
}

export interface Recipe {
    id: string;
    name: string;
    description?: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    baseAmount: number;
    unit: string;
}

export interface RecipeSetItem {
    recipeId: string;
    amount: number;
}

export interface RecipeSet {
    id: string;
    name: string;
    items: RecipeSetItem[];
}

export interface PFCGoals {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
}
