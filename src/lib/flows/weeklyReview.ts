import type { Flow } from "./types";

export const weeklyReviewFlow: Flow = {
  type: "weeklyReview",
  label: "週の振り返り",
  shortLabel: "週振り返り",
  intro: "今週を短く振り返り、来週につなげます。",
  questions: [
    {
      kind: "textarea",
      key: "weekDone",
      title: "今週できたことは？",
      helper: "成果や前進したことを短く書きます。",
      placeholder: "例：研修資料の全体構成が固まった",
    },
    {
      kind: "textarea",
      key: "weekGood",
      title: "今週よかったことは？",
      helper: "仕事でも生活でも、よかったことを1つ書きます。",
      placeholder: "例：早めに相談できたので手戻りを減らせた",
    },
    {
      kind: "textarea",
      key: "weekLearned",
      title: "今週わかったことは？",
      helper: "来週に活かせそうな学びを書きます。",
      placeholder: "例：午前中に重い作業を置くと進みやすい",
    },
    {
      kind: "textarea",
      key: "nextWeekTry",
      title: "来週試したいことは？",
      helper: "小さく試せる改善を書きます。",
      placeholder: "例：月曜朝に30分だけ週のタスク整理をする",
    },
  ],
};
