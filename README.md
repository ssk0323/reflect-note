# reflect-note

リフレクション（振り返り）を支援するアプリ。

## 開発の進め方

Claude Code と一緒に進める前提。詳細は [CLAUDE.md](./CLAUDE.md) を参照。

```
[立ち上げ時]  /overview → /plan → /issue（一括起票）
[各 Issue]    /spec → /tdd → /pr → Copilot レビュー → マージ
```

主なコマンド（Claude Code 内で使う）:

| コマンド | 用途 |
| --- | --- |
| `/overview` | アプリ全体の設計をドキュメント化（`docs/overview.md`） |
| `/plan` | 実装計画とマイルストーン分解（`docs/plan.md`） |
| `/issue` | 計画から GitHub Issue を一括起票 |
| `/spec` | 個別 Issue の仕様を着手前に詰める |
| `/tdd` | Issue を TDD で実装する |
| `/pr` | PR を作成して Copilot レビューを依頼する |

## 技術スタック

- Next.js 16 (App Router) + TypeScript
- React 19
- Tailwind CSS v4
- Vitest + React Testing Library
- ESLint (eslint-config-next)
- デプロイ: Vercel（Hobby プラン）
- DB / 認証: Supabase（Postgres + Google OAuth）※ Issue #2 以降で導入

## 前提

- Node.js 20 以上（`package.json` の `engines` で明示）
- npm（lock ファイルは `package-lock.json`）
- Supabase プロジェクト（無料枠）
- Google Cloud OAuth Client（無料）

## セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数を用意
cp .env.example .env.local
# .env.local を編集して Supabase の URL / anon key / 許可メールを設定

# 開発サーバー起動（http://localhost:3000）
npm run dev

# テスト（Vitest）
npm test            # 1回実行
npm run test:watch  # ウォッチモード

# Lint
npm run lint

# 本番ビルド
npm run build
npm start
```

## Supabase セットアップ（初回のみ）

1. https://supabase.com/dashboard で新規プロジェクトを作成（リージョン: Tokyo 推奨）
2. **Project Settings → API** から以下を `.env.local` にコピー:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (新フォーマット `sb_publishable_...`)
3. **Authentication → Sign In / Providers → Google** を有効化し、Google Cloud で作成した OAuth Client ID / Secret を貼って Save
4. **SQL Editor** で `supabase/migrations/0001_create_records_table.sql` の内容を実行
5. `NEXT_PUBLIC_ALLOWED_EMAILS` に自分のメールアドレスを設定（カンマ区切りで複数可）

## Google Cloud OAuth Client セットアップ（初回のみ）

1. https://console.cloud.google.com で新規プロジェクトを作成
2. **Google Auth Platform → ブランディング** でアプリ名・サポートメールを設定
3. **対象** で User Type を External、テストユーザーに自分のメールを追加
4. **クライアント** で OAuth 2.0 Client ID を作成 (Web application):
   - **承認済みの JavaScript 生成元**: `http://localhost:3000`、本番ドメイン
   - **承認済みのリダイレクト URI**: Supabase の Callback URL（`https://<project>.supabase.co/auth/v1/callback`）
5. 表示された Client ID と Secret を Supabase に貼る

## ディレクトリ

```
src/
  app/                       Next.js App Router
    page.tsx                 トップページ
    layout.tsx               ルートレイアウト
    login/                   ログイン画面
    auth/callback/           OAuth コールバック
  lib/
    supabase/                Supabase Client/Server/Middleware ヘルパー
  middleware.ts              認証ガード（未ログイン redirect + 許可リスト検証）
supabase/
  migrations/                SQL マイグレーション（Supabase SQL Editor で実行）
docs/
  overview.md                アプリ全体像
  plan.md                    実装計画（マイルストーン + Issue 候補）
.claude/                     Claude Code 用設定 (agents / skills / settings)
.github/
  workflows/ci.yml           PR + main push で lint / test / build を実行
```

## CI

PR を作ると `.github/workflows/ci.yml` が `lint` → `test` → `build` を実行する。すべて緑になることがマージ条件。

## デプロイ

Vercel にリポジトリを接続し、`main` への push で本番デプロイ、PR ごとに Preview デプロイが走る想定（Issue #1 で初期設定）。
