import { GameRoom } from "@/components/GameRoom";

type PageProps = { params: Promise<{ code: string }> };

export default async function GamePage({ params }: PageProps) {
  const { code } = await params;
  return <GameRoom code={code} />;
}
