"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Meal, PendingMeal, PFCGoals, Recipe, RecipeSet } from "../types";
import MealInput from "../components/MealInput";
import MealList from "../components/MealList";
import DateNavigator, { toDateKey } from "../components/DateNavigator";
import PFCProgress from "../components/PFCProgress";
import GoalSettings from "../components/GoalSettings";
import AIConsultModal from "../components/AIConsultModal";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const DEFAULT_GOALS: PFCGoals = {
  calories: 3300,
  protein: 150,
  fat: 80,
  carbs: 400,
};
const PUBLIC_APP_URL = "https://79qzv2pmnn-del.github.io/meal-app/";
const BACKUP_KEY_PREFIX = "mealapp_backup:";
const LOCAL_RECOVERY_USER_ID = "local-recovery";

const CONDITION_PRESETS = [
  { value: "風邪", label: "風邪" },
  { value: "怪我", label: "怪我" },
  { value: "腰痛", label: "腰痛" },
  { value: "疲労", label: "疲労" },
  { value: "その他", label: "その他" },
] as const;

interface MealAppRow {
  meals: Meal[] | null;
  recipes: Recipe[] | null;
  recipe_sets: RecipeSet[] | null;
  goals: PFCGoals | null;
  updated_at: string | null;
  pending_meals: PendingMeal[] | null;
}

interface LocalBackupSnapshot {
  version: 1;
  userId: string;
  savedAt: string;
  meals: Meal[];
  recipes: Recipe[];
  recipeSets: RecipeSet[];
  goals: PFCGoals;
}

function getBackupKey(userId: string) {
  return `${BACKUP_KEY_PREFIX}${userId}`;
}

function parseLocalBackup(raw: string | null, expectedUserId?: string): LocalBackupSnapshot | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LocalBackupSnapshot>;
    if (
      parsed?.version !== 1 ||
      (expectedUserId && parsed.userId !== expectedUserId) ||
      typeof parsed.userId !== "string" ||
      !Array.isArray(parsed.meals) ||
      !Array.isArray(parsed.recipes) ||
      !Array.isArray(parsed.recipeSets) ||
      !parsed.goals ||
      typeof parsed.savedAt !== "string"
    ) {
      return null;
    }

    return {
      version: 1,
      userId: parsed.userId,
      savedAt: parsed.savedAt,
      meals: migrateMeals(parsed.meals as Meal[]),
      recipes: parsed.recipes as Recipe[],
      recipeSets: parsed.recipeSets as RecipeSet[],
      goals: parsed.goals as PFCGoals,
    };
  } catch {
    return null;
  }
}

function readLocalBackup(userId: string): LocalBackupSnapshot | null {
  if (typeof window === "undefined") return null;
  return parseLocalBackup(window.localStorage.getItem(getBackupKey(userId)), userId);
}

function readLatestLocalBackup(): LocalBackupSnapshot | null {
  if (typeof window === "undefined") return null;

  const backups: LocalBackupSnapshot[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(BACKUP_KEY_PREFIX)) continue;

    const backup = parseLocalBackup(window.localStorage.getItem(key));
    if (backup && hasMeaningfulData(backup)) {
      backups.push(backup);
    }
  }

  return backups.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())[0] ?? null;
}

function writeLocalBackup(snapshot: LocalBackupSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getBackupKey(snapshot.userId), JSON.stringify(snapshot));
}

function hasMeaningfulData(snapshot: Pick<LocalBackupSnapshot, "meals" | "recipes" | "recipeSets">) {
  return snapshot.meals.length > 0 || snapshot.recipes.length > 0 || snapshot.recipeSets.length > 0;
}

function getSnapshotCounts(snapshot: Pick<LocalBackupSnapshot, "meals" | "recipes" | "recipeSets">) {
  return {
    meals: snapshot.meals.length,
    recipes: snapshot.recipes.length,
    recipeSets: snapshot.recipeSets.length,
  };
}

function getLatestMealTimestamp(snapshot: Pick<LocalBackupSnapshot, "meals"> | null) {
  if (!snapshot || snapshot.meals.length === 0) return 0;
  return snapshot.meals.reduce((latest, meal) => Math.max(latest, meal.timestamp ?? 0), 0);
}

function isSuspiciousMealShrink(
  previous: Pick<LocalBackupSnapshot, "meals"> | null,
  next: Pick<LocalBackupSnapshot, "meals">
) {
  const previousCount = previous?.meals.length ?? 0;
  const nextCount = next.meals.length;

  if (previousCount === 0 || nextCount >= previousCount) {
    return false;
  }

  if (nextCount === 0) {
    return true;
  }

  return previousCount >= 10 && nextCount <= previousCount * 0.5;
}

function isBackupAhead(
  backup: Pick<LocalBackupSnapshot, "meals" | "recipes" | "recipeSets"> | null,
  cloud: Pick<LocalBackupSnapshot, "meals" | "recipes" | "recipeSets">
) {
  if (!backup || !hasMeaningfulData(backup)) return false;

  const backupCounts = getSnapshotCounts(backup);
  const cloudCounts = getSnapshotCounts(cloud);
  if (
    backupCounts.meals > cloudCounts.meals ||
    backupCounts.recipes > cloudCounts.recipes ||
    backupCounts.recipeSets > cloudCounts.recipeSets
  ) {
    return true;
  }

  return getLatestMealTimestamp(backup) > getLatestMealTimestamp(cloud);
}

function migrateMeals(meals: Meal[]): Meal[] {
  return meals.map((meal) => ({
    ...meal,
    date: meal.date ?? toDateKey(new Date(meal.timestamp)),
    category: meal.category ?? "meal",
  }));
}

function isConditionEvent(meal: Meal): boolean {
  return meal.category === "condition";
}

function eventCoversDate(meal: Meal, date: string): boolean {
  if (!isConditionEvent(meal)) return false;
  const start = meal.date;
  const end = meal.endDate ?? meal.date;
  return start <= date && date <= end;
}

function getConditionBadgeLabel(description: string): string {
  const [type] = description.split(":");
  return type.trim() || "体調不良";
}

function getConditionDetail(description: string): string | null {
  const colonIndex = description.indexOf(":");
  if (colonIndex >= 0) {
    return description.slice(colonIndex + 1).trim() || null;
  }
  return CONDITION_PRESETS.some((preset) => preset.value === description) ? null : description;
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
  localBackup,
  onUseLocalBackup,
  onStartLocalOnly,
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
  localBackup: LocalBackupSnapshot | null;
  onUseLocalBackup: () => void;
  onStartLocalOnly: () => void;
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

        <div className="mt-5 border-t border-gray-800 pt-5">
          <p className="text-sm text-gray-300">クラウドに接続できない場合</p>
          {localBackup ? (
            <>
              <p className="text-xs text-gray-500 mt-2 leading-5">
                この端末に残っているバックアップを開けます。保存日時:{" "}
                {new Date(localBackup.savedAt).toLocaleString("ja-JP")}
              </p>
              <button
                type="button"
                onClick={onUseLocalBackup}
                className="mt-3 w-full bg-amber-400 hover:bg-amber-300 text-gray-950 font-semibold rounded-xl px-4 py-3 transition-colors"
              >
                この端末のバックアップで開く
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mt-2 leading-5">
                ログインなしで入力を始められます。入力後は JSONコピー から筋トレダッシュボードへ同期できます。
              </p>
              <button
                type="button"
                onClick={onStartLocalOnly}
                className="mt-3 w-full bg-amber-400 hover:bg-amber-300 text-gray-950 font-semibold rounded-xl px-4 py-3 transition-colors"
              >
                ログインなしで入力を始める
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [isBooting, setIsBooting] = useState(isSupabaseConfigured);
  const [isLocalOnlyMode, setIsLocalOnlyMode] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  const [meals, setMeals] = useState<Meal[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeSets, setRecipeSets] = useState<RecipeSet[]>([]);
  const [goals, setGoals] = useState<PFCGoals>(DEFAULT_GOALS);
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey());
  const [showGoalSettings, setShowGoalSettings] = useState(false);
  const [showAIConsult, setShowAIConsult] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [syncError, setSyncError] = useState("");
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [canSyncToCloud, setCanSyncToCloud] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const lastCloudUpdatedAt = useRef<string | null>(null);
  const [localBackup, setLocalBackup] = useState<LocalBackupSnapshot | null>(null);
  const [availableLocalBackup, setAvailableLocalBackup] = useState<LocalBackupSnapshot | null>(null);
  const [isUsingLocalBackup, setIsUsingLocalBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [shouldOfferBackupRestore, setShouldOfferBackupRestore] = useState(false);
  const [backupRestoreHint, setBackupRestoreHint] = useState("");
  const [conditionStartDate, setConditionStartDate] = useState<string>(toDateKey());
  const [conditionEndDate, setConditionEndDate] = useState<string>(toDateKey());
  const [conditionType, setConditionType] = useState<(typeof CONDITION_PRESETS)[number]["value"]>("風邪");
  const [conditionNote, setConditionNote] = useState("");
  const [showConditionSection, setShowConditionSection] = useState(false);
  const [copySource, setCopySource] = useState<Meal | null>(null);
  const [copyBaseAmount, setCopyBaseAmount] = useState("");
  const [copyAmount, setCopyAmount] = useState("");
  const [isLocalAccess, setIsLocalAccess] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [mobileOverride, setMobileOverrideState] = useState<boolean | null>(null);

  const setMobileOverride = (value: boolean | null) => {
    setMobileOverrideState(value);
    if (typeof window !== "undefined") {
      if (value === null) {
        window.localStorage.removeItem("mealapp_mobile_override");
      } else {
        window.localStorage.setItem("mealapp_mobile_override", value ? "1" : "0");
      }
    }
  };
  const [pendingMeals, setPendingMeals] = useState<PendingMeal[]>([]);
  const [mobileSendStatus, setMobileSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  // スマホからの送信を直列化するPromiseチェーン（race condition防止）
  const mobileSubmitChainRef = useRef<Promise<void>>(Promise.resolve());

  const isMobile = mobileOverride !== null ? mobileOverride : isMobileDevice;

  const resetLocalData = () => {
    setMeals([]);
    setRecipes([]);
    setRecipeSets([]);
    setGoals(DEFAULT_GOALS);
    setHasLoadedData(false);
    setCanSyncToCloud(false);
    setLocalBackup(null);
    setIsUsingLocalBackup(false);
    setIsRestoringBackup(false);
    setShouldOfferBackupRestore(false);
    setBackupRestoreHint("");
    setSyncStatus("idle");
    setSyncError("");
    setIsDirty(false);
    setIsLocalOnlyMode(false);
  };

  const applySnapshotToState = (snapshot: Pick<LocalBackupSnapshot, "meals" | "recipes" | "recipeSets" | "goals">) => {
    setMeals(migrateMeals(snapshot.meals));
    setRecipes(snapshot.recipes);
    setRecipeSets(snapshot.recipeSets);
    setGoals(snapshot.goals);
    setIsDirty(false);
  };

  const persistLocalBackup = (userId: string, snapshot: Pick<LocalBackupSnapshot, "meals" | "recipes" | "recipeSets" | "goals">) => {
    const nextBackup: LocalBackupSnapshot = {
      version: 1,
      userId,
      savedAt: new Date().toISOString(),
      meals: snapshot.meals,
      recipes: snapshot.recipes,
      recipeSets: snapshot.recipeSets,
      goals: snapshot.goals,
    };
    writeLocalBackup(nextBackup);
    setLocalBackup(nextBackup);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    setIsLocalAccess(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.")
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent;
    const mobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
    const narrowScreen = window.innerWidth < 768;
    setIsMobileDevice(mobileUA || narrowScreen);

    // localStorage から override を復元
    const stored = window.localStorage.getItem("mealapp_mobile_override");
    if (stored === "1") setMobileOverrideState(true);
    else if (stored === "0") setMobileOverrideState(false);

    setAvailableLocalBackup(readLatestLocalBackup());
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;
    const bootTimeout = window.setTimeout(() => {
      if (!mounted) return;
      setIsBooting(false);
      setAuthError("クラウドへの接続確認に時間がかかっています。ログインできない場合は端末バックアップで開けます。");
    }, 3500);

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        window.clearTimeout(bootTimeout);
        sessionRef.current = data.session ?? null;
        setSession(data.session ?? null);
        if (!data.session) {
          resetLocalData();
        }
        setIsBooting(false);
      })
      .catch(() => {
        if (!mounted) return;
        window.clearTimeout(bootTimeout);
        setIsBooting(false);
        setAuthError("クラウドへの接続に失敗しました。端末バックアップがあれば、そこから開けます。");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      sessionRef.current = nextSession ?? null;
      setSession(nextSession ?? null);
      if (!nextSession) {
        resetLocalData();
      }
      setIsBooting(false);
    });

    return () => {
      mounted = false;
      window.clearTimeout(bootTimeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;

    if (!session) return;

    // トークンリフレッシュ等で同一ユーザーのセッションが更新されても再ロードしない
    if (hasLoadedData) return;

    let cancelled = false;
    const client = supabase;
    const userId = session.user.id;

    async function loadData() {
      setIsBooting(true);
      setCanSyncToCloud(false);
      setIsUsingLocalBackup(false);
      setShouldOfferBackupRestore(false);
      setBackupRestoreHint("");
      setSyncError("");

      const backup = readLocalBackup(userId);
      setLocalBackup(backup);

      const { data, error } = await client
        .from("mealapp_data")
        .select("meals, recipes, recipe_sets, goals, updated_at, pending_meals")
        .eq("user_id", userId)
        .maybeSingle<MealAppRow>();

      if (cancelled) return;

      if (error) {
        setSyncStatus("error");
        if (backup && hasMeaningfulData(backup)) {
          applySnapshotToState(backup);
          setHasLoadedData(true);
          setIsUsingLocalBackup(true);
          setSyncError("クラウド上のデータを読めなかったため、この端末のバックアップを表示しています。内容を確認して「この端末のバックアップをクラウドへ戻す」を押せます。");
        } else {
          setSyncError("クラウド上のデータを読めませんでした。空データは保存していません。再読み込みしてください。");
        }
      } else {
        lastCloudUpdatedAt.current = data?.updated_at ?? null;
        setPendingMeals(data?.pending_meals ?? []);
        const cloudSnapshot = {
          meals: migrateMeals(data?.meals ?? []),
          recipes: data?.recipes ?? [],
          recipeSets: data?.recipe_sets ?? [],
          goals: data?.goals ?? DEFAULT_GOALS,
        };
        const backupHasData = !!backup && hasMeaningfulData(backup);
        const cloudHasData = hasMeaningfulData(cloudSnapshot);
        const cloudLooksSuspicious = backupHasData && isSuspiciousMealShrink(backup, cloudSnapshot);
        const backupAhead = isBackupAhead(backup, cloudSnapshot);

        if (!cloudHasData && backupHasData) {
          applySnapshotToState(backup);
          setHasLoadedData(true);
          setCanSyncToCloud(false);
          setIsUsingLocalBackup(true);
          setSyncStatus("error");
          const counts = getSnapshotCounts(backup);
          setSyncError(
            `クラウド上のデータが空だったため、この端末のバックアップを表示しています。記録 ${counts.meals} 件 / マイレシピ ${counts.recipes} 件 / 定番セット ${counts.recipeSets} 件。内容を確認して「この端末のバックアップをクラウドへ戻す」を押してください。`
          );
          setShouldOfferBackupRestore(true);
        } else if (cloudLooksSuspicious && backup) {
          applySnapshotToState(backup);
          setHasLoadedData(true);
          setCanSyncToCloud(false);
          setIsUsingLocalBackup(true);
          setSyncStatus("error");
          const backupCounts = getSnapshotCounts(backup);
          const cloudCounts = getSnapshotCounts(cloudSnapshot);
          setSyncError(
            `クラウド上の記録件数が急に減っていたため、この端末のバックアップを表示しています。クラウド ${cloudCounts.meals} 件 / 端末 ${backupCounts.meals} 件。内容を確認して「この端末のバックアップをクラウドへ戻す」を押してください。`
          );
          setShouldOfferBackupRestore(true);
        } else {
          applySnapshotToState(cloudSnapshot);
          setCanSyncToCloud(true);
          setHasLoadedData(true);
          setIsUsingLocalBackup(false);
          setSyncStatus("idle");
          setShouldOfferBackupRestore(backupAhead);
          if (backupAhead && backup) {
            const backupCounts = getSnapshotCounts(backup);
            const cloudCounts = getSnapshotCounts(cloudSnapshot);
            setBackupRestoreHint(
              `この端末のバックアップの方が新しい可能性があります。クラウド ${cloudCounts.meals} 件 / 端末 ${backupCounts.meals} 件。PCで追加した記録が消えたときは、内容を確認して「この端末のバックアップをクラウドへ戻す」を押してください。`
            );
          }
          if (cloudHasData || !backupHasData) {
            persistLocalBackup(userId, cloudSnapshot);
          }
        }
      }

      setIsBooting(false);
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [session, hasLoadedData]);

  useEffect(() => {
    if (!isLocalOnlyMode || !hasLoadedData || !isDirty) return;

    const timer = window.setTimeout(() => {
      const userId = localBackup?.userId ?? LOCAL_RECOVERY_USER_ID;
      persistLocalBackup(userId, { meals, recipes, recipeSets, goals });
      setIsDirty(false);
      setSyncStatus("saved");
      setSyncError("この端末に保存しました。クラウド同期は停止中です。");
    }, 800);

    return () => window.clearTimeout(timer);
  }, [goals, hasLoadedData, isDirty, isLocalOnlyMode, localBackup?.userId, meals, recipeSets, recipes]);

  useEffect(() => {
    // スマホは meals を直接保存しない（pending_meals 経由で送信する）
    if (!supabase || !hasLoadedData || !canSyncToCloud || !isDirty || isMobile) return;

    const client = supabase;
    const timer = window.setTimeout(async () => {
      const userId = sessionRef.current?.user.id;
      if (!userId) return;

      // 保存前にクラウドの updated_at を確認し、自分が読んだ後に別の端末が
      // 保存していたらスキップ（古いデータで上書きしない）
      const { data: latest } = await client
        .from("mealapp_data")
        .select("updated_at")
        .eq("user_id", userId)
        .maybeSingle<{ updated_at: string | null }>();

      if (latest?.updated_at && lastCloudUpdatedAt.current) {
        const cloudTime = new Date(latest.updated_at).getTime();
        const readTime = new Date(lastCloudUpdatedAt.current).getTime();
        if (cloudTime > readTime) {
          // 別の端末がより新しいデータを保存済み → 上書きせず再ロードを促す
          setSyncStatus("error");
          setSyncError("別の端末で保存されたデータがあります。ページを再読み込みして最新データを取得してください。");
          setIsDirty(false);
          return;
        }
      }

      setSyncStatus("saving");
      const savedAt = new Date().toISOString();
      const { error } = await client.from("mealapp_data").upsert(
        {
          user_id: userId,
          meals,
          recipes,
          recipe_sets: recipeSets,
          goals,
          updated_at: savedAt,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        setSyncStatus("error");
        setSyncError("クラウド保存に失敗しました");
        return;
      }

      lastCloudUpdatedAt.current = savedAt;
      setSyncStatus("saved");
      setSyncError("");
      persistLocalBackup(userId, { meals, recipes, recipeSets, goals });
      setIsUsingLocalBackup(false);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [canSyncToCloud, goals, hasLoadedData, isDirty, isMobile, meals, recipeSets, recipes]);

  const selectedMeals = useMemo(
    () => meals.filter((meal) => meal.date === selectedDate && !isConditionEvent(meal)),
    [meals, selectedDate]
  );

  const selectedConditionEvents = useMemo(
    () => meals.filter((meal) => eventCoversDate(meal, selectedDate)),
    [meals, selectedDate]
  );

  const totalKcal = selectedMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const totalP = selectedMeals.reduce((sum, meal) => sum + meal.protein, 0);
  const totalF = selectedMeals.reduce((sum, meal) => sum + meal.fat, 0);
  const totalC = selectedMeals.reduce((sum, meal) => sum + meal.carbs, 0);

  const buildMealAppExportPayload = () => ({
    source: "MealApp",
    version: 1,
    exportedAt: new Date().toISOString(),
    goals,
    meals,
    recipes,
    recipe_sets: recipeSets,
    recipeSets,
  });

  const handleCopyMealAppJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildMealAppExportPayload(), null, 2));
      setExportMessage("統合ツール用JSONをコピーしました。筋トレダッシュボードに貼り付けて取り込めます。");
    } catch {
      setExportMessage("コピーできませんでした。ブラウザの権限を確認してください。");
    }
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setAuthError("");
    setAuthMessage("");
    setIsAuthBusy(true);

    try {
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
    } catch {
      setAuthError("クラウドに接続できませんでした。端末バックアップがあれば、そこから開けます。");
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleAddMeal = (meal: Meal) => {
    if (isMobile && !isLocalOnlyMode) {
      // スマホ：送信を直列化して race condition を防ぐ
      const pendingMeal: PendingMeal = { ...meal, submittedAt: new Date().toISOString() };
      setPendingMeals((prev) => [...prev, pendingMeal]);
      mobileSubmitChainRef.current = mobileSubmitChainRef.current.then(() =>
        handleSubmitFromMobile(pendingMeal)
      );
    } else {
      setIsDirty(true);
      setMeals((prev) => [meal, ...prev].sort((a, b) => b.timestamp - a.timestamp));
    }
  };

  const handleAddConditionEvent = () => {
    const trimmedNote = conditionNote.trim();
    const description =
      conditionType === "その他"
        ? (trimmedNote || "その他")
        : (trimmedNote ? `${conditionType}: ${trimmedNote}` : conditionType);
    const event: Meal = {
      id: crypto.randomUUID(),
      timestamp: new Date(`${conditionStartDate}T12:00:00`).getTime(),
      date: conditionStartDate,
      endDate: conditionEndDate || conditionStartDate,
      description,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      category: "condition",
      loggingStatus: "記録停止",
    };
    setIsDirty(true);
    setMeals((prev) =>
      [event, ...prev].sort((a, b) => b.timestamp - a.timestamp)
    );
    setConditionType("風邪");
    setConditionNote("");
    setConditionStartDate(selectedDate);
    setConditionEndDate(selectedDate);
  };

  const handleDeleteMeal = (id: string) => {
    if (window.confirm("この記録を削除しますか？")) {
      setIsDirty(true);
      setMeals((prev) => prev.filter((meal) => meal.id !== id));
    }
  };

  const handleUpdateMeal = (updatedMeal: Meal) => {
    setIsDirty(true);
    setMeals((prev) =>
      prev
        .map((meal) => (meal.id === updatedMeal.id ? updatedMeal : meal))
        .sort((a, b) => b.timestamp - a.timestamp)
    );
  };

  const handleSaveToRecipe = (meal: Meal) => {
    const name = meal.description.split("\n")[0].trim().slice(0, 50) || "無題のレシピ";
    const newRecipe: Recipe = {
      id: crypto.randomUUID(),
      name,
      description: "",
      calories: meal.calories,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
      baseAmount: meal.actualAmount ?? 1,
      unit: meal.actualAmount ? "g" : "人前",
    };
    setIsDirty(true);
    setRecipes((prev) => [newRecipe, ...prev]);
    alert(`「${name}」をマイレシピに保存しました。`);
  };

  const handleCopyMeal = (meal: Meal) => {
    setCopySource(meal);
    setCopyBaseAmount(meal.actualAmount?.toString() ?? "");
    setCopyAmount("");
  };

  const handleConfirmCopy = () => {
    if (!copySource) return;
    const base = Number(copyBaseAmount);
    const newAmt = Number(copyAmount);
    let calories = copySource.calories;
    let protein = copySource.protein;
    let fat = copySource.fat;
    let carbs = copySource.carbs;
    if (base > 0 && newAmt > 0) {
      const ratio = newAmt / base;
      calories = Math.round(calories * ratio);
      protein = Math.round(protein * ratio * 10) / 10;
      fat = Math.round(fat * ratio * 10) / 10;
      carbs = Math.round(carbs * ratio * 10) / 10;
    }
    const copied: Meal = {
      ...copySource,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      date: selectedDate,
      calories,
      protein,
      fat,
      carbs,
      actualAmount: newAmt > 0 ? newAmt : (base > 0 ? base : copySource.actualAmount),
    };
    setIsDirty(true);
    setMeals((prev) => [copied, ...prev].sort((a, b) => b.timestamp - a.timestamp));
    setCopySource(null);
    setCopyBaseAmount("");
    setCopyAmount("");
  };

  // スマホ：pending_meal を1件ずつ直列でクラウドへ送信（race condition防止のため select→append→upsert）
  const handleSubmitFromMobile = async (toSend: PendingMeal) => {
    const currentSession = sessionRef.current;
    if (!supabase || !currentSession) return;
    setMobileSendStatus("sending");

    const { data: latest } = await supabase
      .from("mealapp_data")
      .select("pending_meals")
      .eq("user_id", currentSession.user.id)
      .maybeSingle<{ pending_meals: PendingMeal[] | null }>();

    const merged = [...(latest?.pending_meals ?? []), toSend];

    const { error } = await supabase
      .from("mealapp_data")
      .upsert({ user_id: currentSession.user.id, pending_meals: merged }, { onConflict: "user_id" });

    if (error) {
      setMobileSendStatus("error");
      return;
    }

    setMobileSendStatus("sent");
  };

  // スマホ「PCに送信」ボタン用：全 pendingMeals を1件ずつ直列で再送
  const handleResubmitAllFromMobile = () => {
    for (const meal of pendingMeals) {
      mobileSubmitChainRef.current = mobileSubmitChainRef.current.then(() =>
        handleSubmitFromMobile(meal)
      );
    }
  };

  // PC：pending meal を1件承認して本データへ取り込む
  const handleApprovePending = async (pendingMeal: PendingMeal) => {
    if (!supabase || !session) return;
    const { submittedAt: _s, ...meal } = pendingMeal;
    const newMeals = [meal, ...meals].sort((a, b) => b.timestamp - a.timestamp);
    const newPending = pendingMeals.filter((m) => m.id !== pendingMeal.id);
    setMeals(newMeals);
    setPendingMeals(newPending);
    setIsDirty(true);
    await supabase
      .from("mealapp_data")
      .upsert({ user_id: session.user.id, pending_meals: newPending }, { onConflict: "user_id" });
  };

  // PC：pending meal を1件却下
  const handleRejectPending = async (id: string) => {
    if (!supabase || !session) return;
    const newPending = pendingMeals.filter((m) => m.id !== id);
    setPendingMeals(newPending);
    await supabase
      .from("mealapp_data")
      .upsert({ user_id: session.user.id, pending_meals: newPending }, { onConflict: "user_id" });
  };

  // PC：pending meals をすべて承認
  const handleApproveAllPending = async () => {
    if (!supabase || !session) return;
    const toAdd = pendingMeals.map(({ submittedAt: _s, ...meal }) => meal);
    const newMeals = [...toAdd, ...meals].sort((a, b) => b.timestamp - a.timestamp);
    setMeals(newMeals);
    setPendingMeals([]);
    setIsDirty(true);
    await supabase
      .from("mealapp_data")
      .upsert({ user_id: session.user.id, pending_meals: [] }, { onConflict: "user_id" });
  };

  const handleSignOut = async () => {
    if (isLocalOnlyMode) {
      resetLocalData();
      setAvailableLocalBackup(readLatestLocalBackup());
      return;
    }
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const handleUseLocalBackup = () => {
    const backup = availableLocalBackup ?? readLatestLocalBackup();
    if (!backup) {
      handleStartLocalOnly();
      return;
    }

    applySnapshotToState(backup);
    setLocalBackup(backup);
    setHasLoadedData(true);
    setCanSyncToCloud(false);
    setIsUsingLocalBackup(true);
    setIsLocalOnlyMode(true);
    setSyncStatus("error");
    setSyncError("この端末のバックアップを表示しています。クラウド同期は停止中です。");
    setAuthError("");
  };

  const handleStartLocalOnly = () => {
    const snapshot: LocalBackupSnapshot = {
      version: 1,
      userId: LOCAL_RECOVERY_USER_ID,
      savedAt: new Date().toISOString(),
      meals: [],
      recipes: [],
      recipeSets: [],
      goals: DEFAULT_GOALS,
    };

    applySnapshotToState(snapshot);
    persistLocalBackup(snapshot.userId, snapshot);
    setLocalBackup(snapshot);
    setHasLoadedData(true);
    setCanSyncToCloud(false);
    setIsUsingLocalBackup(true);
    setIsLocalOnlyMode(true);
    setSyncStatus("error");
    setSyncError("ログインなしの入力モードです。入力後は JSONコピー で筋トレダッシュボードへ同期してください。");
    setAuthError("");
  };

  const handleRestoreLocalBackup = async () => {
    if (!supabase || !session || !localBackup) return;

    setIsRestoringBackup(true);
    setSyncStatus("saving");
    setSyncError("");

    const snapshot = {
      meals: localBackup.meals,
      recipes: localBackup.recipes,
      recipeSets: localBackup.recipeSets,
      goals: localBackup.goals,
    };

    const { error } = await supabase.from("mealapp_data").upsert(
      {
        user_id: session.user.id,
        meals: snapshot.meals,
        recipes: snapshot.recipes,
        recipe_sets: snapshot.recipeSets,
        goals: snapshot.goals,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      setSyncStatus("error");
      setSyncError("この端末のバックアップをクラウドへ戻せませんでした。通信を確認してもう一度試してください。");
      setIsRestoringBackup(false);
      return;
    }

    applySnapshotToState(snapshot);
    persistLocalBackup(session.user.id, snapshot);
    setHasLoadedData(true);
    setCanSyncToCloud(true);
    setIsUsingLocalBackup(false);
    setShouldOfferBackupRestore(false);
    setBackupRestoreHint("");
    setSyncStatus("saved");
    setSyncError("この端末のバックアップをクラウドへ戻しました。");
    setIsRestoringBackup(false);
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

  if (!session && !isLocalOnlyMode) {
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
        localBackup={availableLocalBackup}
        onUseLocalBackup={handleUseLocalBackup}
        onStartLocalOnly={handleStartLocalOnly}
      />
    );
  }

  // スマホ専用UI
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
        {/* ヘッダー */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950">
          <p className="text-xs font-bold tracking-widest text-emerald-400">MealApp</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHasLoadedData(false)}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title="更新"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setMobileOverride(false)}
              className="text-xs text-blue-400 hover:text-white transition-colors"
            >
              📱 スマホモード
            </button>
            <button
              onClick={handleSignOut}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              ログアウト
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* 送信ステータス */}
          {mobileSendStatus === "sending" && (
            <p className="text-xs text-blue-400 text-center">送信中...</p>
          )}
          {mobileSendStatus === "sent" && (
            <p className="text-xs text-emerald-400 text-center">PCに送信しました</p>
          )}
          {mobileSendStatus === "error" && (
            <p className="text-xs text-red-400 text-center">送信に失敗しました。再度お試しください。</p>
          )}

          {/* 入力フォーム */}
          <MealInput
            date={toDateKey()}
            onAddMeal={handleAddMeal}
            recipes={recipes}
            recipeSets={recipeSets}
            onChangeRecipes={(r) => { setIsDirty(true); setRecipes(r); }}
            onChangeRecipeSets={(rs) => { setIsDirty(true); setRecipeSets(rs); }}
            isMobile={true}
          />

          {/* 送信済みリスト */}
          {pendingMeals.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">送信済み（承認待ち）</h2>
              <div className="flex flex-col gap-2">
                {pendingMeals.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{m.description}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {m.calories}kcal
                        <span className="text-blue-400 ml-1">P{m.protein}</span>
                        <span className="text-yellow-400 ml-1">F{m.fat}</span>
                        <span className="text-emerald-400 ml-1">C{m.carbs}</span>
                        <span className="text-gray-500 ml-2">{new Date(m.submittedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span>
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const newPending = pendingMeals.filter((p) => p.id !== m.id);
                        setPendingMeals(newPending);
                        if (supabase && session) {
                          await supabase.from("mealapp_data").upsert(
                            { user_id: session.user.id, pending_meals: newPending },
                            { onConflict: "user_id" }
                          );
                        }
                      }}
                      className="text-gray-500 hover:text-red-400 transition-colors p-1 shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
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
      {showGoalSettings && (
        <GoalSettings
          goals={goals}
          onSave={(g) => { setIsDirty(true); setGoals(g); }}
          onClose={() => setShowGoalSettings(false)}
        />
      )}

      {showAIConsult && (
        <AIConsultModal
          goals={goals}
          todayTotals={{ calories: totalKcal, protein: totalP, fat: totalF, carbs: totalC }}
          recipes={recipes}
          recipeSets={recipeSets}
          onClose={() => setShowAIConsult(false)}
        />
      )}

      {copySource && (() => {
        const base = Number(copyBaseAmount);
        const newAmt = Number(copyAmount);
        const canScale = base > 0 && newAmt > 0;
        const ratio = canScale ? newAmt / base : 1;
        const previewKcal = canScale ? Math.round(copySource.calories * ratio) : copySource.calories;
        const previewP = canScale ? Math.round(copySource.protein * ratio * 10) / 10 : copySource.protein;
        const previewF = canScale ? Math.round(copySource.fat * ratio * 10) / 10 : copySource.fat;
        const previewC = canScale ? Math.round(copySource.carbs * ratio * 10) / 10 : copySource.carbs;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
            onClick={() => setCopySource(null)}
          >
            <div
              className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">記録をコピー</h3>
                <button onClick={() => setCopySource(null)} className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed mb-4 whitespace-pre-wrap">{copySource.description}</p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">元の量 (g)</span>
                  <input
                    type="number"
                    min="0"
                    value={copyBaseAmount}
                    onChange={(e) => setCopyBaseAmount(e.target.value)}
                    placeholder="例: 200"
                    className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-emerald-400">今回の量 (g)</span>
                  <input
                    type="number"
                    min="0"
                    value={copyAmount}
                    onChange={(e) => setCopyAmount(e.target.value)}
                    placeholder="例: 180"
                    className="bg-gray-900 border border-emerald-500/50 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    autoFocus
                  />
                </label>
              </div>

              <div className="bg-gray-900 rounded-xl p-3 flex gap-4 text-sm mb-4">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-500">Kcal</span>
                  <span className="font-semibold text-white">{previewKcal}</span>
                </div>
                <div className="flex flex-col items-center border-l border-gray-700 pl-4">
                  <span className="text-[10px] text-gray-500">P</span>
                  <span className="font-semibold text-blue-400">{previewP}</span>
                </div>
                <div className="flex flex-col items-center border-l border-gray-700 pl-4">
                  <span className="text-[10px] text-gray-500">F</span>
                  <span className="font-semibold text-yellow-400">{previewF}</span>
                </div>
                <div className="flex flex-col items-center border-l border-gray-700 pl-4">
                  <span className="text-[10px] text-gray-500">C</span>
                  <span className="font-semibold text-emerald-400">{previewC}</span>
                </div>
              </div>

              <button
                onClick={handleConfirmCopy}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                この内容で追加
              </button>
            </div>
          </div>
        );
      })()}

      <main className="max-w-2xl mx-auto flex flex-col gap-5">
        {isLocalAccess && (
          <section className="bg-sky-500/10 border border-sky-400/30 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-sky-200">普段は公開版を使うのがおすすめです</h2>
            <p className="text-xs text-sky-100/80 mt-2 leading-5">
              PC とスマホのズレを減らすため、普段の入力は PC もスマホも同じ公開URLで使ってください。
            </p>
            <a
              href={PUBLIC_APP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex mt-3 bg-sky-300 hover:bg-sky-200 text-sky-950 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              公開版を開く
            </a>
            <p className="text-[11px] text-sky-100/70 mt-2 break-all">{PUBLIC_APP_URL}</p>
          </section>
        )}

        <header className="flex items-start justify-between border-b border-gray-800 pb-4 gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              MealApp
              <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-sm">
                {isLocalOnlyMode ? "Local" : "Sync"}
              </span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">{headerLabel}</p>
            <p className="text-xs text-gray-500 mt-2">
              {syncStatus === "saving" && "保存中"}
              {syncStatus === "saved" && "保存済み"}
              {syncStatus === "error" && "保存エラー"}
            </p>
            {syncError && <p className="text-xs text-red-400 mt-1">{syncError}</p>}
            {exportMessage && <p className="text-xs text-emerald-300 mt-1">{exportMessage}</p>}
            {localBackup && hasMeaningfulData(localBackup) && (
              <p className="text-xs text-gray-500 mt-1">
                この端末のバックアップ: {new Date(localBackup.savedAt).toLocaleString("ja-JP")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAIConsult(true)}
              className="p-2 text-gray-400 hover:text-emerald-400 transition-colors rounded-lg hover:bg-gray-800"
              title="AIに相談"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
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
              onClick={handleCopyMealAppJson}
              className="text-xs bg-emerald-500 hover:bg-emerald-400 text-gray-950 px-4 py-2 rounded-lg transition font-semibold"
            >
              JSONコピー
            </button>
            <button
              onClick={() => setHasLoadedData(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
              title="更新"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setMobileOverride(isMobile ? false : true)}
              className={`text-xs px-3 py-2 rounded-lg border transition font-medium ${isMobile ? "bg-blue-500/20 border-blue-400/50 text-blue-300" : "bg-gray-950 border-gray-700 text-gray-400"}`}
              title="スマホ/PCモード切り替え"
            >
              {isMobile ? "📱 スマホ" : "💻 PC"}
            </button>
            <button
              onClick={handleSignOut}
              className="text-xs bg-gray-950 hover:bg-gray-800 text-gray-300 px-4 py-2 rounded-lg border border-gray-700 transition font-medium"
            >
              {isLocalOnlyMode ? "閉じる" : "ログアウト"}
            </button>
          </div>
        </header>

        {localBackup && hasMeaningfulData(localBackup) && (isUsingLocalBackup || !canSyncToCloud || shouldOfferBackupRestore) && (
          <section className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-amber-200">この端末に残っているバックアップがあります</h2>
            <p className="text-xs text-amber-100/80 mt-2 leading-5">
              保存日時: {new Date(localBackup.savedAt).toLocaleString("ja-JP")}
            </p>
            <p className="text-xs text-amber-100/80 mt-1 leading-5">
              記録 {localBackup.meals.length} 件 / マイレシピ {localBackup.recipes.length} 件 / 定番セット {localBackup.recipeSets.length} 件
            </p>
            {backupRestoreHint && (
              <p className="text-xs text-amber-100/80 mt-2 leading-5">{backupRestoreHint}</p>
            )}
            {session && supabase ? (
              <button
                type="button"
                onClick={handleRestoreLocalBackup}
                disabled={isRestoringBackup}
                className="mt-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {isRestoringBackup ? "復元中..." : "この端末のバックアップをクラウドへ戻す"}
              </button>
            ) : (
              <p className="text-xs text-amber-100/80 mt-2 leading-5">
                クラウド復旧後にログインできれば、このバックアップを戻せます。今はこの端末内に保存します。
              </p>
            )}
          </section>
        )}

        {/* PC：スマホからの承認待ちバナー */}
        {!isMobile && pendingMeals.length > 0 && (
          <section className="bg-violet-500/10 border border-violet-400/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-violet-200">スマホからの承認待ち ({pendingMeals.length}件)</h2>
                <p className="text-xs text-violet-300/70 mt-0.5">承認するとこの日の記録に追加されます</p>
              </div>
              <button
                onClick={handleApproveAllPending}
                className="text-xs bg-violet-500 hover:bg-violet-400 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                すべて承認
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {pendingMeals.map((m) => (
                <div key={m.id} className="flex items-center gap-3 bg-gray-900/60 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{m.description}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {m.calories}kcal
                      <span className="text-blue-400 ml-1">P{m.protein}</span>
                      <span className="text-yellow-400 ml-1">F{m.fat}</span>
                      <span className="text-emerald-400 ml-1">C{m.carbs}</span>
                      <span className="text-gray-500 ml-2">{m.date} · {new Date(m.submittedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}送信</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleApprovePending(m)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors shrink-0"
                  >
                    承認
                  </button>
                  <button
                    onClick={() => handleRejectPending(m.id)}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors px-1 shrink-0"
                  >
                    却下
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} />

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-gray-800 p-3 md:p-4 rounded-xl border border-gray-700 text-center shadow-sm">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-medium">Kcal</p>
            <p className="text-lg md:text-2xl font-bold text-white mt-1">{totalKcal}</p>
          </div>
          <div className="bg-gray-800 p-3 md:p-4 rounded-xl border border-gray-700 text-center shadow-sm">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-medium">P (g)</p>
            <p className="text-lg md:text-2xl font-bold text-blue-400 mt-1">{Math.round(totalP * 10) / 10}</p>
          </div>
          <div className="bg-gray-800 p-3 md:p-4 rounded-xl border border-gray-700 text-center shadow-sm">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-medium">F (g)</p>
            <p className="text-lg md:text-2xl font-bold text-yellow-400 mt-1">{Math.round(totalF * 10) / 10}</p>
          </div>
          <div className="bg-gray-800 p-3 md:p-4 rounded-xl border border-gray-700 text-center shadow-sm">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-medium">C (g)</p>
            <p className="text-lg md:text-2xl font-bold text-emerald-400 mt-1">{Math.round(totalC * 10) / 10}</p>
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
            onChangeRecipes={(r) => { setIsDirty(true); setRecipes(r); }}
            onChangeRecipeSets={(rs) => { setIsDirty(true); setRecipeSets(rs); }}
            isMobile={isMobile}
          />
        </section>

        {/* スマホ：送信キュー */}
        {isMobile && pendingMeals.length > 0 && (
          <section className="bg-blue-500/10 border border-blue-400/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-blue-200">送信待ち ({pendingMeals.length}件)</h2>
                <p className="text-xs text-blue-300/70 mt-0.5">PCで開いたときに承認して記録に追加されます</p>
              </div>
              <button
                onClick={handleResubmitAllFromMobile}
                disabled={mobileSendStatus === "sending"}
                className="text-xs bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                {mobileSendStatus === "sending" ? "送信中..." : "PCに送信"}
              </button>
            </div>
            {mobileSendStatus === "sent" && (
              <p className="text-xs text-blue-300 mb-2">送信しました。PCを開いて承認してください。</p>
            )}
            {mobileSendStatus === "error" && (
              <p className="text-xs text-red-400 mb-2">送信に失敗しました。もう一度お試しください。</p>
            )}
            <div className="flex flex-col gap-2">
              {pendingMeals.map((m) => (
                <div key={m.id} className="flex items-center gap-3 bg-gray-900/60 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{m.description}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {m.calories}kcal
                      <span className="text-blue-400 ml-1">P{m.protein}</span>
                      <span className="text-yellow-400 ml-1">F{m.fat}</span>
                      <span className="text-emerald-400 ml-1">C{m.carbs}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setPendingMeals((prev) => prev.filter((p) => p.id !== m.id))}
                    className="text-gray-500 hover:text-red-400 transition-colors p-1 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowConditionSection((v) => !v)}
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-750 transition-colors"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-200">休養や不調の期間</h2>
              <p className="text-xs text-gray-500 mt-0.5">風邪や怪我などで記録を止めたい期間を残します。</p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${showConditionSection ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showConditionSection && <div className="px-4 pb-4">
          <div className="grid md:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">開始日</span>
              <input
                type="date"
                value={conditionStartDate}
                max={conditionEndDate}
                onChange={(event) => setConditionStartDate(event.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">終了日</span>
              <input
                type="date"
                value={conditionEndDate}
                min={conditionStartDate}
                onChange={(event) => setConditionEndDate(event.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">種類</span>
              <select
                value={conditionType}
                onChange={(event) => setConditionType(event.target.value as (typeof CONDITION_PRESETS)[number]["value"])}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                {CONDITION_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">メモ</span>
              <input
                value={conditionNote}
                onChange={(event) => setConditionNote(event.target.value)}
                placeholder={conditionType === "その他" ? "例: 胃腸炎、寝不足" : "例: ぎっくり腰、喉の痛み"}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleAddConditionEvent}
            className="mt-3 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-lg transition-colors"
          >
            休養期間を保存
          </button>

          <div className="mt-4 space-y-3">
            {selectedConditionEvents.length === 0 ? (
              <div className="text-sm text-gray-500">この日にかかる体調イベントはありません。</div>
            ) : (
              selectedConditionEvents.map((event) => (
                <div key={event.id} className="bg-gray-900 border border-gray-700 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-sky-900/50 text-sky-300 px-2 py-1 rounded border border-sky-800">
                        {getConditionBadgeLabel(event.description)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {event.date} 〜 {event.endDate ?? event.date}
                      </span>
                      {getConditionDetail(event.description) && (
                        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded border border-gray-700">
                          {getConditionDetail(event.description)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMeal(event.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                    aria-label="削除"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
          </div>}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-200">
              {isToday ? "今日のタイムライン" : "この日の記録"}
            </h2>
            <span className="text-xs text-gray-500">{selectedMeals.length}件</span>
          </div>
          <MealList meals={selectedMeals} onDelete={handleDeleteMeal} onUpdate={handleUpdateMeal} onCopy={handleCopyMeal} onSaveToRecipe={handleSaveToRecipe} />
        </section>
      </main>
    </div>
  );
}
