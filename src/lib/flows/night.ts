import type { Flow } from "./types";

export const nightFlow: Flow = {
  type: "night",
  label: "夜のリフレクション",
  shortLabel: "夜",
  intro: "1日を短く振り返り、明日につなげます。",
  questions: [
    {
      kind: "textarea",
      key: "done",
      title: "今日できたことは？",
      helper: "小さなことでもOKです。できたことに目を向けます。",
      placeholder: "例：資料の構成を最後まで作れた",
    },
    {
      kind: "textarea",
      key: "good",
      title: "今日よかったことは？",
      helper: "気分を整えるために、よかったことを1つだけ書きます。",
      placeholder: "例：子どもと散歩できて気分転換になった",
    },
    {
      kind: "textarea",
      key: "stuck",
      title: "モヤモヤしたことは？",
      helper: "なければ「なし」で大丈夫です。",
      placeholder: "例：作業が予定より進まず少し焦った",
    },
    {
      kind: "textarea",
      key: "tomorrow",
      title: "明日に回すことは？",
      helper: "明日やる小さな一歩に変えます。",
      placeholder: "例：朝9時に、タイトル案を3つ出す",
    },
    {
      kind: "textarea",
      key: "tryTomorrow",
      title: "Try｜明日試したいことは？",
      helper: "改善というより、軽く試してみたい工夫を書きます。",
      placeholder: "例：午前中は通知を切って、最初の30分だけ資料作成に集中する",
    },
    {
      kind: "group",
      key: "timeUsage",
      title: "時間の使い方を振り返る",
      helper: "朝・午前・午後・夜に分けて、1日の時間の使い方をざっと棚卸しします。",
      fields: [
        {
          key: "timeMorning",
          label: "朝",
          placeholder: "例：子どもの準備をしてから、メール確認をした",
        },
        {
          key: "timeForenoon",
          label: "午前",
          placeholder: "例：研修資料の構成を作った",
        },
        {
          key: "timeAfternoon",
          label: "午後",
          placeholder: "例：打ち合わせが長引いて、資料作成は少しだけ進めた",
        },
        {
          key: "timeNight",
          label: "夜",
          placeholder: "例：家事のあと、明日のタスクを整理した",
        },
      ],
    },
    {
      kind: "textarea",
      key: "messageToTomorrowSelf",
      title: "明日の自分へひとこと",
      helper: "明日の自分が少し前向きになれる言葉を残します。",
      placeholder: "例：完璧じゃなくていいので、まず10分だけ始めよう。",
    },
  ],
};
