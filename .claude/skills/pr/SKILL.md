---
name: pr
description: 現在のブランチから PR を作成し、GitHub Copilot にレビューを依頼する。/tdd 完了後、または変更が一段落したときに使う。
---

現在のブランチの変更を Pull Request にまとめ、Copilot レビューを依頼する。

# 手順

1. **状態確認**（並列で実行可）
   - `git status` — コミット漏れがないか
   - `git diff main...HEAD` — main からの差分（PR の中身）
   - `git log main..HEAD --oneline` — このブランチで作ったコミット
   - 現在のブランチ名と紐づく Issue 番号を特定

2. **未コミットの変更があれば確認**
   - ユーザーに「これをPRに含めますか？」と聞き、必要ならコミットする
   - Conventional Commits で

3. **PR の中身を組み立てる**
   - **タイトル**: 最も大きい変更を表す Conventional Commits（`feat: 振り返り一覧を表示する` など）
   - **本文**: `.github/pull_request_template.md` のフォーマットに従う
     - Summary（1〜3 箇条書き）
     - Test plan（チェックボックス。手動確認も含む）
     - `Closes #<Issue番号>`

4. **ユーザーに最終確認**
   - タイトル・本文を提示し、AskUserQuestion で承認を取る

5. **push & PR 作成**
   - `git push -u origin <branch>`（初回）
   - `gh pr create --title "..." --body "..."`（本文は HEREDOC）
   - 作成された PR URL を表示

6. **Copilot レビューを依頼**
   - `gh pr edit <PR番号> --add-reviewer copilot-pull-request-reviewer`
   - 失敗したら（リポジトリで Copilot 未有効など）、ユーザーに有効化方法を案内
     - GitHub リポジトリ Settings → Code & automation → Code review limits / Copilot

7. **次のステップを促す**
   - 「Copilot のレビューが付いたら、指摘ごとに修正コミットを積みましょう」
   - 「すべて解決したら `Squash and merge` でマージしてください（または希望があればこちらでマージします）」

# 注意

- `main` への直接 push は禁止
- force push は CLAUDE.md / settings.json で禁止済み。レビュー対応中に履歴を綺麗にしたい場合は事前にユーザーに確認
- PR を出す前に必ずテストとlint/typecheckが緑であることを確認
- セルフレビューを促す: 「PR の Files changed を一度自分で見てから依頼しましょう」
