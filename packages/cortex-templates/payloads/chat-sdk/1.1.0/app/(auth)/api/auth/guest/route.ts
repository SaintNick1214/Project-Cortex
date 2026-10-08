import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { signIn } from "@/app/(auth)/auth";
import { isDevelopmentEnvironment } from "@/lib/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const candidate = searchParams.get("redirectUrl") || "/";
  let redirectUrl = "/";
  try {
    const target = new URL(candidate, request.url);
    if (target.origin === new URL(request.url).origin)
      redirectUrl = target.pathname + target.search;
  } catch {
    /* Keep local default. */
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return signIn("guest", { redirect: true, redirectTo: redirectUrl });
}
