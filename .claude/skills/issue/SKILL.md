---
name: issue
description: 固まった仕様を GitHub Issue として登録する。/spec の後、または既に仕様が決まっている変更を Issue 化したいときに使う。
---

仕様書（`/spec` で生成したもの、または会話で既に固まっているもの）を GitHub Issue として登録する。

# 手順

1. **対象の仕様を確認**
   - 直近の会話に仕様書がある場合はそれを使う
   - ない場合は「どの仕様を Issue 化しますか？」とユーザーに確認

2. **Issue の中身を組み立てる**
   - **タイトル**: `feat: ...` / `fix: ...` / `refactor: ...` などの Conventional Commits 形式
   - **本文**: `.github/ISSUE_TEMPLATE/feature.md` または `bug.md` の形式に合わせる
     - 概要
     - 背景・目的
     - 受け入れ条件（チェックボックス。**これが TDD のテストになる**）
     - スコープ外
     - 未確定事項（あれば）

3. **ラベルを決める**
   - `type:feat | type:fix | type:refactor | type:docs | type:test | type:chore` から 1 つ
   - `priority:high | priority:mid | priority:low` から 1 つ
   - 既存ラベルを `gh label list` で確認。なければ作成して良いかユーザーに確認

4. **ユーザーに最終確認**
   - タイトル・本文・ラベルを提示
   - 「この内容で起票しますか？」を AskUserQuestion で確認

5. **Issue を作成**
   - `gh issue create --title "..." --body "..." --label "..."`
   - 本文は HEREDOC で渡す
   - 作成後、Issue 番号と URL をユーザーに返す

6. **次のステップを促す**
   - 「`/tdd <issue番号>` で TDD 実装を始めますか？」

# 注意

- 受け入れ条件が **観測可能・検証可能** か再チェック（曖昧なら `/spec` に戻る）
- 大きすぎる Issue は分割を提案する目安: 受け入れ条件が 7 個を超える、複数機能にまたがる
- ユーザーが起票前に内容を直したい場合は会話で更新し、最終承認まで `gh issue create` は実行しない
