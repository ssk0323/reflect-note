import { notFound } from "next/navigation";
import { getFlow } from "@/lib/flows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EditClient } from "./EditClient";
import { FlowClient } from "./FlowClient";

type PageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export const dynamic = "force-dynamic";

export default async function FlowPage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const flow = getFlow(type);

  if (!flow) {
    notFound();
  }

  const { edit } = await searchParams;

  if (edit) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("records")
      .select("id, answers")
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

    // recordId が変わったら EditClient を再マウントして state をリセット。
    // useState は初回しか初期化されないため、key で remount を強制する。
    return (
      <EditClient
        key={data.id}
        flow={flow}
        recordId={data.id}
        initialAnswers={data.answers}
      />
    );
  }

  return <FlowClient flow={flow} />;
}
