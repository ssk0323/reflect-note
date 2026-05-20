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

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動（http://localhost:3000）
npm run dev

# テスト（Vitest）
npm test          # 1回実行
npm run test:watch  # ウォッチモード

# Lint
npm run lint

# 本番ビルド
npm run build
npm start
```

## ディレクトリ

```
src/
  app/                  Next.js App Router (page / layout / global styles)
    page.tsx            トップページ
    page.test.tsx       サンプルテスト
docs/
  overview.md           アプリ全体像
  plan.md               実装計画（マイルストーン + Issue 候補）
.claude/                Claude Code 用設定 (agents / skills / settings)
.github/
  workflows/ci.yml      PR + main push で lint / test / build を実行
```

## CI

PR を作ると `.github/workflows/ci.yml` が `lint` → `test` → `build` を実行する。すべて緑になることがマージ条件。

## デプロイ

Vercel にリポジトリを接続し、`main` への push で本番デプロイ、PR ごとに Preview デプロイが走る想定（Issue #1 で初期設定）。
