# MealApp

GitHub Pages で公開できる、食事記録アプリです。  
AI 入力は使わず、`手入力 + マイレシピ + 定番セット` に絞っています。  
データは Supabase に保存するので、PC とスマホで同じ記録を見られます。

## できること

- 食事の手入力
- マイレシピ登録
- 定番セット登録
- 日別の記録確認
- PFC とカロリーの集計
- PC / スマホ同期

## 1. Supabase を用意する

1. Supabase で新しいプロジェクトを作る
2. SQL Editor を開く
3. [`supabase_setup.sql`](./supabase_setup.sql) の中身をそのまま実行する
4. `Authentication` で Email ログインを有効にしておく
5. `Project Settings > API` から次の 2 つを控える

- `Project URL`
- `anon public key`

## 2. GitHub Secrets を入れる

GitHub リポジトリの `Settings > Secrets and variables > Actions` で、次を追加します。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. GitHub Pages を有効にする

このリポジトリには [`deploy-pages.yml`](./.github/workflows/deploy-pages.yml) が入っています。  
`main` または `master` に push すると自動で GitHub Pages にデプロイされます。

GitHub 側で Pages を使うときは、`Settings > Pages` で `GitHub Actions` を選んでください。

## 4. 初回ログイン

公開 URL を開いたら:

1. `初回登録` を押す
2. メールアドレスとパスワードを入れる
3. 以後は同じ情報で PC とスマホからログインする

## Local Development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

`.env.local` には次を入れます。

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key"
```

## Build

```bash
npm run build
```

`next.config.ts` で static export 設定済みなので、GitHub Pages 用の `out` が作られます。
