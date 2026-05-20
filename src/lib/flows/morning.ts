import type { Flow } from "./types";

export const morningFlow: Flow = {
  type: "morning",
  label: "朝のセットアップ",
  shortLabel: "朝",
  intro: "1日の目標と、今日やることを3つだけ決めます。",
  questions: [
    {
      kind: "textarea",
      key: "goal",
      title: "今日の目標は？",
      helper: "今日の終わりに「これができたらOK」と思えることを書きます。",
      placeholder: "例：研修資料の全体構成を固める",
    },
    {
      kind: "input",
      key: "task1",
      title: "今日やるタスク 1つ目は？",
      helper: "一番大事なタスクを書きます。",
      placeholder: "例：スライドの目次を作る",
    },
    {
      kind: "input",
      key: "task2",
      title: "今日やるタスク 2つ目は？",
      helper: "次に大事なタスクを書きます。",
      placeholder: "例：ワークの設問を3つ作る",
    },
    {
      kind: "input",
      key: "task3",
      title: "今日やるタスク 3つ目は？",
      helper: "小さめのタスクでも大丈夫です。",
      placeholder: "例：クライアントへの確認事項をまとめる",
    },
    {
      kind: "textarea",
      key: "attention",
      title: "今日、気をつけたいことは？",
      helper: "流されないための一言を書きます。",
      placeholder: "例：細部に入りすぎず、まず全体像を作る",
    },
  ],
};
