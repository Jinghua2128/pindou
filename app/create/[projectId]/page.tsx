import { Studio } from "@/components/editor/Studio";
export default async function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <Studio projectId={projectId} />;
}
