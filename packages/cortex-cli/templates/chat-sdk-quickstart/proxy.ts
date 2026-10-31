import { NextResponse } from "next/server";
/** Host JWT verification happens on Convex; application cookies cannot grant data access. */
export function proxy() {
  return NextResponse.next();
}
export const config = { matcher: ["/", "/chat/:id", "/api/:path*"] };
