"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Meal, PFCGoals, Recipe, RecipeSet } from "../types";
import MealInput from "../components/MealInput";
import MealList from "../components/MealList";
import DateNavigator, { toDateKey } from "../components/DateNavigator";
import PFCProgress from "../components/PFCProgress";
import GoalSettings from "../components/GoalSettings";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const DEFAULT_GOALS: PFCGoals = {
  calories: 2500,
  protein: 150,
  fat: 70,
  carbs: 300,
};

interface MealAppRow {
  meals: Meal[] | null;
  recipes: Recipe[] | null;
  recipe_sets: RecipeSet[] | null;
  goals: PFCGoals | null;
}

function migrateMeals(meals: Meal[]): Meal[] {
  return meals.map((meal) => ({
    ...meal,
    date: meal.date ?? toDateKey(new Date(meal.timestamp)),
  }));
}

function LoginCard({
  mode,
  setMode,
  email,
  password,
  setEmail,
  setPassword,
  error,
  message,
  isBusy,
  onSubmit,
}: {
  mode: "signin" | "signup";
  setMode: (mode: "signin" | "signup") => void;
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  error: string;
  message: string;
  isBusy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">MealApp</p>
        <h1 className="text-3xl font-bold mt-3">食事を記録する</h1>
        <p className="text-sm text-gray-400 mt-3 leading-6">
          PC とスマホで同じ記録を使えるようにするため、最初にアカウントでログインします。
        </p>

        <div className="grid grid-cols-2 gap-2 mt-6 bg-gray-950 border border-gray-800 rounded-2xl p-1">
          <button
            onClick={() => setMode("signin")}
            className={`rounded-xl py-2 text-sm transition-colors ${mode === "signin" ? "bg-emerald-500 text-gray-950 font-semibold" : "text-gray-400 hover:text-white"}`}
          >
            ログイン
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`rounded-xl py-2 text-sm transition-colors ${mode === "signup" ? "bg-emerald-500 text-gray-950 font-semibold" : "text-gray-400 hover:text-white"}`}
          >
            初回登録
          </button>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-gray-300">メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-gray-300">パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="8文字以上がおすすめ"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {message && (
            <p className="text-sm text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isBusy || !email || !password}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-semibold rounded-xl px-4 py-3 transition-colors"
          >
            {isBusy ? "処理中..." : mode === "signin" ? "ログインする" : "アカウントを作る"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [isBooting, setIsBooting] = useState(isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeSets, setRecipeSets] = useState<RecipeSet[]>([]);
  const [goals, setGoals] = useState<PFCGoals>(DEFAULT_GOALS);
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey());
  const [showGoalSettings, setShowGoalSettings] = useState(false);
  const [toast, setToast] = useState("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [syncError, setSyncError] = useState("");
  const [hasLoadedData, setHasLoadedData] = useState(false);

  const resetLocalData = () => {
    setMeals([]);
    setRecipes([]);
    setRecipeSets([]);
    setGoals(DEFAULT_GOALS);
    setHasLoadedData(false);
    setSyncStatus("idle");
    setSyncError("");
  };

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      if (!data.session) {
        resetLocalData();
      }
      setIsBooting(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      if (!nextSession) {
        resetLocalData();
      }
      setIsBooting(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;

    if (!session) return;

    let cancelled = false;
    const client = supabase;
    const userId = session.user.id;

    async function loadData() {
      setIsBooting(true);
      setSyncError("");

      const { data, error } = await client
        .from("mealapp_data")
        .select("meals, recipes, recipe_sets, goals")
        .eq("user_id", userId)
        .maybeSingle<MealAppRow>();

      if (cancelled) return;

      if (error) {
        setSyncError("クラウド上のデータを読めませんでした");
      } else {
        setMeals(migrateMeals(data?.meals ?? []));
        setRecipes(data?.recipes ?? []);
        setRecipeSets(data?.recipe_sets ?? []);
        setGoals(data?.goals ?? DEFAULT_GOALS);
      }

      setHasLoadedData(true);
      setIsBooting(false);
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!supabase || !session || !hasLoadedData) return;

    const client = supabase;
    const userId = session.user.id;
    const timer = window.setTimeout(async () => {
      setSyncStatus("saving");
      const { error } = await client.from("mealapp_data").upsert(
        {
          user_id: userId,
          meals,
          recipes,
          recipe_sets: recipeSets,
          goals,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        setSyncStatus("error");
        setSyncError("クラウド保存に失敗しました");
        return;
      }

      setSyncStatus("saved");
      setSyncError("");
    }, 800);

    return () => window.clearTimeout(timer);
  }, [goals, hasLoadedData, meals, recipeSets, recipes, session]);

  const selectedMeals = useMemo(
    () => meals.filter((meal) => meal.date === selectedDate),
    [meals, selectedDate]
  );

  const totalKcal = selectedMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const totalP = selectedMeals.reduce((sum, meal) => sum + meal.protein, 0);
  const totalF = selectedMeals.reduce((sum, meal) => sum + meal.fat, 0);
  const totalC = selectedMeals.reduce((sum, meal) => sum + meal.carbs, 0);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setAuthError("");
    setAuthMessage("");
    setIsAuthBusy(true);

    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthError(error.message);
      } else if (data.session) {
        setAuthMessage("登録してログインしました");
      } else {
        setAuthMessage("登録できました。確認メールが届いた場合はメールを開いてください。");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
      }
    }

    setIsAuthBusy(false);
  };

  const handleAddMeal = (meal: Meal) => {
    setMeals((prev) => [meal, ...prev].sort((a, b) => b.timestamp - a.timestamp));
  };

  const handleDeleteMeal = (id: string) => {
    if (window.confirm("この記録を削除しますか？")) {
      setMeals((prev) => prev.filter((meal) => meal.id !== id));
    }
  };

  const handleUpdateMeal = (updatedMeal: Meal) => {
    setMeals((prev) =>
      prev
        .map((meal) => (meal.id === updatedMeal.id ? updatedMeal : meal))
        .sort((a, b) => b.timestamp - a.timestamp)
    );
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl">
          <h1 className="text-2xl font-bold">最初に Supabase の設定が必要です</h1>
          <p className="text-sm text-gray-400 mt-3 leading-6">
            GitHub Pages で PC とスマホの記録を同期するため、保存先を Supabase にしています。
            次の 2 つを GitHub の設定に入れると使えるようになります。
          </p>
          <div className="mt-5 bg-gray-950 rounded-2xl border border-gray-800 p-4 font-mono text-sm text-emerald-300">
            <p>NEXT_PUBLIC_SUPABASE_URL</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            セットアップ手順は README にまとめています。
          </p>
        </div>
      </main>
    );
  }

  if (isBooting) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  if (!session) {
    return (
      <LoginCard
        mode={authMode}
        setMode={setAuthMode}
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        error={authError}
        message={authMessage}
        isBusy={isAuthBusy}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  const headerLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const isToday = selectedDate === toDateKey();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8 font-sans pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-700 text-white text-sm px-5 py-2.5 rounded-full shadow-xl border border-gray-600 animate-in fade-in slide-in-from-top-2 duration-200 whitespace-nowrap">
          {toast}
        </div>
      )}

      {showGoalSettings && (
        <GoalSettings
          goals={goals}
          onSave={setGoals}
          onClose={() => setShowGoalSettings(false)}
        />
      )}

      <main className="max-w-2xl mx-auto flex flex-col gap-5">
        <header className="flex items-start justify-between border-b border-gray-800 pb-4 gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              MealApp
              <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-sm">
                Sync
              </span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">{headerLabel}</p>
            <p className="text-xs text-gray-500 mt-2">
              {syncStatus === "saving" && "保存中"}
              {syncStatus === "saved" && "保存済み"}
              {syncStatus === "error" && "保存エラー"}
            </p>
            {syncError && <p className="text-xs text-red-400 mt-1">{syncError}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGoalSettings(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
              title="目標設定"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={handleSignOut}
              className="text-xs bg-gray-950 hover:bg-gray-800 text-gray-300 px-4 py-2 rounded-lg border border-gray-700 transition font-medium"
            >
              ログアウト
            </button>
          </div>
        </header>

        <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} />

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-gray-800 p-3 md:p-4 rounded-xl border border-gray-700 text-center shadow-sm">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-medium">Kcal</p>
            <p className="text-lg md:text-2xl font-bold text-white mt-1">{totalKcal}</p>
          </div>
          <div className="bg-gray-800 p-3 md:p-4 rounded-xl border border-gray-700 text-center shadow-sm">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-medium">P (g)</p>
            <p className="text-lg md:text-2xl font-bold text-blue-400 mt-1">{totalP}</p>
          </div>
          <div className="bg-gray-800 p-3 md:p-4 rounded-xl border border-gray-700 text-center shadow-sm">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-medium">F (g)</p>
            <p className="text-lg md:text-2xl font-bold text-yellow-400 mt-1">{totalF}</p>
          </div>
          <div className="bg-gray-800 p-3 md:p-4 rounded-xl border border-gray-700 text-center shadow-sm">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-medium">C (g)</p>
            <p className="text-lg md:text-2xl font-bold text-emerald-400 mt-1">{totalC}</p>
          </div>
        </section>

        {goals.calories > 0 && (
          <PFCProgress
            goals={goals}
            actual={{ calories: totalKcal, protein: totalP, fat: totalF, carbs: totalC }}
          />
        )}

        <section>
          <MealInput
            date={selectedDate}
            onAddMeal={handleAddMeal}
            recipes={recipes}
            recipeSets={recipeSets}
            onChangeRecipes={setRecipes}
            onChangeRecipeSets={setRecipeSets}
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-200">
              {isToday ? "今日のタイムライン" : "この日の記録"}
            </h2>
            <span className="text-xs text-gray-500">{selectedMeals.length}件</span>
          </div>
          <MealList meals={selectedMeals} onDelete={handleDeleteMeal} onUpdate={handleUpdateMeal} />
        </section>
      </main>
    </div>
  );
}
