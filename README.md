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

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Vitest + React Testing Library
- ESLint + Prettier
- デプロイ: Vercel（Hobby プラン）
- DB / 認証: Supabase（Postgres + Google OAuth）※ Issue #2 以降で導入

## セットアップ

未実装。Issue #1 完了時に `npm install` / `npm run dev` などが動くようになる予定。
