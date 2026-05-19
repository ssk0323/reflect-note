# reflect-note 開発ルール

リフレクション（振り返り）を支援するアプリの開発リポジトリ。
このファイルは Claude Code と一緒に開発する際の共通ルール。

## 開発フロー（必ずこの順で進める）

最初に **全体像** を固めてから個別タスクに降ろす。いきなり 1 機能ずつ細かく詰めない。

### A. プロジェクト・新領域の立ち上げ時（最初に 1 回）

1. **全体像ドキュメント作成** — `/overview` でアプリの目的・主要機能・データモデル・技術構成・スコープ外をまとめて `docs/overview.md` に落とす
2. **計画作成** — `/plan` で全体像をマイルストーンと Issue 候補リストに分解し `docs/plan.md` に落とす
3. **ToDo化（一括 Issue 起票）** — `/issue` で計画から複数 Issue をまとめて起票

### B. 個別 Issue を実装するとき（Issue ごとに繰り返す）

4. **必要なら細かい仕様詰め** — `/spec` で対象 Issue の受け入れ条件をブラッシュアップ（曖昧さが残っていれば）
5. **TDD 開発** — `/tdd` で Red → Green → Refactor。1 Issue = 1 ブランチ
6. **PR 作成** — `/pr` で PR を作成。Issue を `Closes #N` で紐付ける
7. **Copilot レビュー** — `gh pr edit --add-reviewer copilot-pull-request-reviewer` で依頼
8. **レビュー対応** — 指摘を修正コミット。会話で議論したものは PR コメントにも残す
9. **マージ** — `Squash and merge` を基本。マージ後にブランチ削除

全体像・計画は **生きたドキュメント**。実装中に方針が変わったら `docs/overview.md` / `docs/plan.md` を更新する。

スキップしてよいのは「typo修正」「依存パッケージのバージョン上げ」など軽微な変更のみ。

## Git 戦略（GitHub Flow）

- 常に `main` から派生。`main` は常にデプロイ可能な状態を保つ
- ブランチ名: `<type>/<issue番号>-<短い説明>`
  - 例: `feat/12-add-reflection-list`, `fix/34-empty-state-crash`
  - `type` は `feat | fix | refactor | docs | test | chore`
- コミットメッセージは **Conventional Commits**
  - `feat: ...` / `fix: ...` / `refactor: ...` / `test: ...` / `docs: ...` / `chore: ...`
  - 本文は「なぜそうしたか」を1〜2行で
- 1コミット = 1論理単位。WIPコミットは `git rebase -i` で整理してから PR を出す（or squash merge で吸収）
- `main` への直接 push は禁止。必ず PR 経由

## Issue 管理

- すべての変更は Issue 起点。基本は `/plan` の結果から `/issue` で一括起票する
- 1 件だけの追加・修正を起票するときは `/issue` を単発で使ってもよい
- ラベル: `type:feat | type:fix | type:refactor | type:docs | type:test | type:chore` と `priority:high|mid|low`
- Issue には「受け入れ条件（Acceptance Criteria）」を箇条書きで必ず書く — これが TDD のテストケースになる

## TDD ルール

- まず失敗するテストを書く（Red）
- 最小実装で通す（Green）
- 重複・読みにくさを直す（Refactor）
- テストが書きづらい場合は設計が悪いシグナル。実装前に Claude と相談する
- テストフレームワークは技術スタック決定時に確定（Vitest / Jest など）

## PR ルール

- タイトル: Conventional Commits 準拠（`feat: 振り返り一覧を表示する` など）
- 本文: PR テンプレートに従う（Summary / Test plan / 関連 Issue）
- 1 PR = 1 Issue が基本。大きくなりそうなら Issue を分割する
- レビュアー: GitHub Copilot を必ず追加
- セルフレビューしてから依頼する

## Claude Code との協働方針

- **全体像が未確定なら、まず `/overview` で全体像ドキュメントを作る**。1 機能ずついきなり細かく詰めない
- 個別 Issue で仕様が曖昧なら `/spec` でヒアリング
- 手戻りを避けるため、実装前に Plan を共有して合意する
- 実装中に方針が変わったら、まず会話で擦り合わせてから手を動かす
- 不明点は推測で進めず質問する

## 技術スタック

- **フレームワーク**: Next.js (App Router) + TypeScript
- **スタイル**: Tailwind CSS
- **テスト**: Vitest + React Testing Library
- **Lint / Format**: ESLint + Prettier
- **デプロイ**: Vercel（Hobby プラン、無料枠）
- **DB / 認証**: Supabase（Postgres + Google OAuth）※ Issue #2 以降で導入
- **パッケージマネージャー**: npm
- **Node.js**: 20 LTS 想定

詳細なセットアップ手順は README.md を参照。Issue #1 完了時に上記が動く状態になる。
