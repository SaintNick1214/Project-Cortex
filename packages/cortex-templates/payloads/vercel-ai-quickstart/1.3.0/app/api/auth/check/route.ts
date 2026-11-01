import { authStatus, errorResponse } from "@/lib/app-auth";
export async function GET(req: Request) {
  try {
    return Response.json(await authStatus(req));
  } catch (error) {
    return errorResponse(error);
  }
}
