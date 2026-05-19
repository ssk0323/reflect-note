---
name: tdd
description: Issue を TDD（Red→Green→Refactor）で実装する。Issue 番号を指定して呼ぶか、現在のブランチに紐づく Issue を実装するときに使う。
---

GitHub Issue を TDD で実装する。

# 手順

1. **対象 Issue の特定**
   - `$ARGUMENTS` に Issue 番号があればそれを使う
   - なければ「どの Issue を実装しますか？」と確認
   - `gh issue view <番号>` で受け入れ条件を取得して確認

2. **ブランチ作成**
   - 現在 `main` にいる場合: `git switch -c <type>/<番号>-<短い説明>` で派生
   - 既にfeatureブランチにいる場合: ブランチ名が Issue 番号と一致するか確認。違えば確認
   - ブランチ名規則は CLAUDE.md 参照

3. **tdd-developer agent を起動**
   - Agent ツールで `subagent_type: tdd-developer` を指定
   - prompt には以下を含める:
     - Issue 番号と URL
     - 受け入れ条件のリスト
     - 既知の制約・関連ファイル
   - foreground 実行

4. **agent の進捗を見守る**
   - 各サイクル（Red/Green/Refactor）の節目でユーザーに状況を報告
   - テストが書きづらい・受け入れ条件が曖昧などのブロッカーが出たら、ユーザーに相談

5. **完了確認**
   - 全受け入れ条件のテストが緑か
   - lint / typecheck が通るか
   - 動作確認（UI / API）したか
   - 完了したら「`/pr` で PR を作成しますか？」と促す

# 注意

- テストフレームワーク未導入なら、**まず導入を別 Issue で起票** することを提案
- ユーザーが「テスト不要」と言った場合でも理由を確認。納得できる理由（プロトタイプ・スパイクなど）があれば TDD を外して進める
- 実装中に新たに分かったことは Issue にコメントで追記
