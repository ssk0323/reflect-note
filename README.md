# reflect-note

リフレクション（振り返り）を支援するアプリ。

## 開発の進め方

Claude Code と一緒に進める前提。詳細は [CLAUDE.md](./CLAUDE.md) を参照。

```
仕様ヒアリング → Plan → Issue → TDD → PR → Copilot レビュー → マージ
```

主なコマンド（Claude Code 内で使う）:

| コマンド | 用途 |
| --- | --- |
| `/spec` | 機能の仕様を Claude にヒアリングしてもらう |
| `/issue` | 固まった仕様を GitHub Issue にする |
| `/tdd` | Issue を TDD で実装する |
| `/pr` | PR を作成して Copilot レビューを依頼する |

## セットアップ

技術スタック未定。最初の `/spec` で決定する。
