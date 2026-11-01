import { authenticate, errorResponse } from "@/lib/app-auth";
export async function POST(req: Request) {
  try {
    return await authenticate(req, "login");
  } catch (error) {
    return errorResponse(error);
  }
}
