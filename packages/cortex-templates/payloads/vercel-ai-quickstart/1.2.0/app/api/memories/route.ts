import {
  requireSession,
  selectSpace,
  errorResponse,
  AppError,
} from "@/lib/app-auth";
import { withCortex } from "@/lib/cortex";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const account = await requireSession(req),
      params = new URL(req.url).searchParams;
    const space = selectSpace(account, {
      userId: params.get("userId"),
      tenantId: params.get("tenantId"),
      memorySpaceId: params.get("memorySpaceId"),
    });
    const limit = Number(params.get("limit") ?? "20");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new AppError(400, "limit must be 1 to 100");
    return await withCortex(account, async (cortex) => {
      const records = await cortex.vector.list({
        memorySpaceId: space,
        userId: account.accountId,
        limit,
      });
      if (
        records.some(
          (record) =>
            record.memorySpaceId !== space ||
            record.userId !== account.accountId ||
            record.tenantId !== account.tenantId,
        )
      )
        throw new AppError(503, "Backend returned an out-of-scope record");
      return Response.json({
        memories: records,
        count: records.length,
        memorySpaceId: space,
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
