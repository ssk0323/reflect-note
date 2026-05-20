import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecordRow } from "@/lib/records/types";
import { HistoryClient } from "./HistoryClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("records")
    .select("id, type, answers, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          過去の記録を取得できませんでした
        </h1>
        <p className="mt-3 text-sm text-red-600">{error.message}</p>
      </main>
    );
  }

  const records = (data ?? []) as RecordRow[];
  return <HistoryClient records={records} />;
}
