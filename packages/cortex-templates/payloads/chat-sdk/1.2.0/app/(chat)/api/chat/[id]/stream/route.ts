import { auth } from "@/app/(auth)/auth";
import { getChatById } from "@/lib/db/queries";
import { privateRequest } from "@/lib/private-request";
import { ChatSDKError } from "@/lib/errors";
/** Resume is optional. An owned request returns 204 when no durable resume is enabled. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return privateRequest(request, async () => {
    const session = await auth();
    if (!session?.user?.id)
      return new ChatSDKError("unauthorized:stream").toResponse();
    const { id } = await params;
    if (!(await getChatById({ id })))
      return new ChatSDKError("not_found:chat").toResponse();
    return new Response(null, { status: 204 });
  });
}
