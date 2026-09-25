import { Studio } from "@/components/editor/Studio";
export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <Studio roomId={roomId} />;
}
