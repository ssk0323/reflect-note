import { notFound } from "next/navigation";
import { getFlow } from "@/lib/flows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecordRow } from "@/lib/records/types";
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
  let initialRecord: { id: string; answers: RecordRow["answers"] } | undefined;

  if (edit) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("records")
      .select("id, type, answers")
      .eq("id", edit)
      .eq("type", flow.type)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch record for editing", error);
      notFound();
    }
    if (!data) {
      notFound();
    }
    initialRecord = { id: data.id, answers: data.answers };
  }

  return <FlowClient flow={flow} initialRecord={initialRecord} />;
}
