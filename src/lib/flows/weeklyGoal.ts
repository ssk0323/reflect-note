import type { Flow } from "./types";

export const weeklyGoalFlow: Flow = {
  type: "weeklyGoal",
  label: "週の目標設定",
  shortLabel: "週目標",
  intro: "今週の方向性と、優先したいことを決めます。",
  questions: [
    {
      kind: "textarea",
      key: "weekGoal",
      title: "今週の目標は？",
      helper: "今週の終わりに、これができていればOKと思えることを書きます。",
      placeholder: "例：研修資料のたたき台を完成させる",
    },
    {
      kind: "textarea",
      key: "weekFocus",
      title: "今週、特に大事にしたいことは？",
      helper: "判断に迷ったときの軸になる一言を書きます。",
      placeholder: "例：まず全体像を作り、細部は後から詰める",
    },
    {
      kind: "input",
      key: "weekPriority1",
      title: "今週の優先タスク 1つ目は？",
      helper: "今週進めたい重要タスクを書きます。",
      placeholder: "例：Day1資料の構成作成",
    },
    {
      kind: "input",
      key: "weekPriority2",
      title: "今週の優先タスク 2つ目は？",
      helper: "次に大事なタスクを書きます。",
      placeholder: "例：ワーク設計の見直し",
    },
    {
      kind: "input",
      key: "weekPriority3",
      title: "今週の優先タスク 3つ目は？",
      helper: "小さくても、今週進めたいことを書きます。",
      placeholder: "例：確認事項をクライアントに送る",
    },
  ],
};
