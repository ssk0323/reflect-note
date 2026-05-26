import { notFound } from "next/navigation";
import { getFlow } from "@/lib/flows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toJstDateString } from "@/lib/records/targetDate";
import { EditClient } from "./EditClient";
import { FlowClient } from "./FlowClient";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ edit?: string; date?: string; from?: string }>;
};

export const dynamic = "force-dynamic";

export default async function FlowPage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const flow = getFlow(type);

  if (!flow) {
    notFound();
  }

  const { edit, date, from } = await searchParams;

  if (edit) {
    // team review P1: edit param に UUID 検証を入れて、不正値で Postgres の
    // uuid cast エラー (22P02) を踏み 500 を返してしまう経路を 404 に倒す。
    if (!UUID_RE.test(edit)) {
      notFound();
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("records")
      .select("id, answers, target_date, created_at")
      .eq("id", edit)
      .eq("type", flow.type)
      .maybeSingle();

    if (error) {
      // 実際のバックエンドエラー (DB 接続障害等) は notFound で隠さず、
      // エラーバウンダリで処理させる。"行が無い" 場合のみ 404 にする。
      console.error("Failed to fetch record for editing", error);
      throw new Error("記録の取得に失敗しました");
    }
    if (!data) {
      notFound();
    }

    // target_date が NULL の旧データ向け fallback。created_at の JST 日付を渡し、
    // EditClient 側で週/月フローには normalizeTargetDate で月曜/1日に丸めて使う。
    const fallbackDate = toJstDateString(new Date(data.created_at));

    // recordId が変わったら EditClient を再マウントして state をリセット。
    // useState は初回しか初期化されないため、key で remount を強制する。
    // PR #47 review: from=flow なら「キャンセルで日付選択に戻る」「保存後ホーム」
    // それ以外 (history 経由など) は従来通り /history に戻す。
    return (
      <EditClient
        key={data.id}
        flow={flow}
        recordId={data.id}
        initialAnswers={data.answers}
        initialTargetDate={data.target_date}
        initialFallbackDate={fallbackDate}
        from={from}
      />
    );
  }

  return <FlowClient flow={flow} initialDate={date} />;
}
