import type { Flow } from "./types";

export const monthlyGoalFlow: Flow = {
  type: "monthlyGoal",
  label: "月の目標設定",
  shortLabel: "月目標",
  intro: "今月の方向性と、達成したいことを決めます。",
  questions: [
    {
      kind: "textarea",
      key: "monthGoal",
      title: "今月の目標は？",
      helper: "今月の終わりに、これができていればOKと思えることを書きます。",
      placeholder: "例：リフレクションアプリのMVPを触れる状態にする",
    },
    {
      kind: "textarea",
      key: "monthTheme",
      title: "今月のテーマは？",
      helper: "今月大事にしたい考え方や姿勢を書きます。",
      placeholder: "例：完璧よりも、まず使える形にする",
    },
    {
      kind: "input",
      key: "monthPriority1",
      title: "今月の重点タスク 1つ目は？",
      helper: "今月進めたい重要タスクを書きます。",
      placeholder: "例：基本画面を作る",
    },
    {
      kind: "input",
      key: "monthPriority2",
      title: "今月の重点タスク 2つ目は？",
      helper: "次に大事なタスクを書きます。",
      placeholder: "例：ローカル保存を実装する",
    },
    {
      kind: "input",
      key: "monthPriority3",
      title: "今月の重点タスク 3つ目は？",
      helper: "小さくても、今月進めたいことを書きます。",
      placeholder: "例：スマホ表示を整える",
    },
  ],
};
