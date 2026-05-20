import type { Flow } from "./types";

export const monthlyReviewFlow: Flow = {
  type: "monthlyReview",
  label: "月の振り返り",
  shortLabel: "月振り返り",
  intro: "1ヶ月を振り返り、来月につなげます。",
  questions: [
    {
      kind: "textarea",
      key: "monthDone",
      title: "今月できたことは？",
      helper: "成果や前進したことを短く書きます。",
      placeholder: "例：MVPの主要機能を一通り作れた",
    },
    {
      kind: "textarea",
      key: "monthGood",
      title: "今月よかったことは？",
      helper: "今月のよかった出来事を1つ書きます。",
      placeholder: "例：毎週少しずつアプリの方向性を整理できた",
    },
    {
      kind: "textarea",
      key: "monthLearned",
      title: "今月わかったことは？",
      helper: "来月に活かせる学びを書きます。",
      placeholder: "例：機能を増やすより、入力体験を軽くする方が大事",
    },
    {
      kind: "textarea",
      key: "nextMonthTry",
      title: "来月試したいことは？",
      helper: "来月の改善案を1つ書きます。",
      placeholder: "例：ユーザーに1週間使ってもらい、入力しにくい項目を確認する",
    },
  ],
};
