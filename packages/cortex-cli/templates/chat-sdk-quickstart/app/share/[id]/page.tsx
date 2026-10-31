import { RuntimeChatSDK } from "@/components/runtime-chat";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RuntimeChatSDK conversationId={id} />;
}
