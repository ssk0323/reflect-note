import { notFound } from "next/navigation";
import { getFlow } from "@/lib/flows";
import { FlowClient } from "./FlowClient";

type PageProps = {
  params: Promise<{ type: string }>;
};

export default async function FlowPage({ params }: PageProps) {
  const { type } = await params;
  const flow = getFlow(type);

  if (!flow) {
    notFound();
  }

  return <FlowClient flow={flow} />;
}
