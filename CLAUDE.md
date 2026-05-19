# reflect-note 開発ルール

リフレクション（振り返り）を支援するアプリの開発リポジトリ。
このファイルは Claude Code と一緒に開発する際の共通ルール。

## 開発フロー（必ずこの順で進める）

1. **仕様ヒアリング** — `/spec` で Claude Code が機能を1つずつ深掘り質問する
2. **Plan 作成** — ヒアリング結果から実装方針・タスク分解を作る（必要なら `ExitPlanMode` で承認）
3. **Issue 化** — `/issue` で GitHub Issue を作成（テンプレート利用）
4. **TDD 開発** — `/tdd` で Red → Green → Refactor のサイクル。1 Issue = 1 ブランチ
5. **PR 作成** — `/pr` で PR を作成。Issue を `Closes #N` で紐付ける
6. **Copilot レビュー** — `gh pr edit --add-reviewer copilot-pull-request-reviewer` 等で依頼
7. **レビュー対応** — 指摘を修正コミット。会話で議論したものは PR コメントにも残す
8. **マージ** — `Squash and merge` を基本。マージ後にブランチ削除

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

- すべての変更は Issue 起点。`/spec` で固まった仕様を `/issue` で起票する
- ラベル: `type:feat | type:fix | type:refactor | type:docs` と `priority:high|mid|low`
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

- 仕様が曖昧なら **必ず先にヒアリング**。手を動かす前に `/spec`
- 手戻りを避けるため、実装前に Plan を共有して合意する
- 実装中に方針が変わったら、まず会話で擦り合わせてから手を動かす
- 不明点は推測で進めず質問する

## 技術スタック

未定。`/spec` で最初の機能を詰める際に併せて決定する。決まったらこの CLAUDE.md に追記する。
