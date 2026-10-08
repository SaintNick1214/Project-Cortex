import { logout, errorResponse } from "@/lib/app-auth";
export async function POST(req: Request) {
  try {
    return await logout(req);
  } catch (error) {
    return errorResponse(error);
  }
}
