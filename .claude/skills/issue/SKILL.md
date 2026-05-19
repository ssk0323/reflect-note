---
name: issue
description: 計画 (docs/plan.md) から GitHub Issue を一括起票する。または個別の固まった仕様を Issue として登録する。
---

GitHub Issue を起票する。基本は **`docs/plan.md` から複数 Issue を一括起票** する。単発の追加にも使える。

# 2 つのモード

## モード A: 計画から一括起票（推奨）

前提: `docs/plan.md` が存在する。

1. **対象範囲を確認**
   - `$ARGUMENTS` に「M0」「M1」などマイルストーン指定があればそれを使う
   - なければ「どのマイルストーン or どの範囲を起票しますか？」と AskUserQuestion で確認
   - 既存 Issue と重複しないよう `gh issue list --state all` で確認

2. **既存ラベルを確認 / 不足分を作成**
   - `gh label list` で確認
   - `type:feat|fix|refactor|docs|test|chore` と `priority:high|mid|low` が無ければ作る前にユーザー確認

3. **Issue ドラフトを一覧で見せる**
   - 各 Issue について：タイトル / ラベル / 受け入れ条件のサマリを表で表示
   - 「この内容で N 件起票します。OK ですか？」と AskUserQuestion で承認を取る

4. **順番に `gh issue create` を実行**
   - 本文は `.github/ISSUE_TEMPLATE/feature.md` などのテンプレ形式に揃える
   - 本文は HEREDOC で渡す
   - 依存関係は本文に「依存: #N」で記載

5. **`docs/plan.md` を更新**
   - 起票済みの Issue 番号を埋め込む（`- [ ] #12 feat: ...` のように）

6. **次のステップを促す**
   - 「最初の Issue から `/spec <番号>` で詰めますか？それとも直接 `/tdd <番号>` で実装に入りますか？」

## モード B: 単発の Issue 起票

`docs/plan.md` に無い小さな改修（typo、依存更新、緊急 fix など）の場合。

1. ユーザーから内容を聞き、タイトル・受け入れ条件・ラベルを組み立てる
2. テンプレ形式（`.github/ISSUE_TEMPLATE/*.md`）に合わせる
3. ユーザーに最終確認後 `gh issue create`
4. URL を返す

# 注意

- 受け入れ条件が **観測可能・検証可能** か再チェック
- 大きすぎる Issue（受け入れ条件 7 個超 / 複数機能にまたがる）は分割
- 起票前に必ずユーザーの最終承認を取る
- 一括起票で途中失敗したら、どこまで成功したか必ず報告
