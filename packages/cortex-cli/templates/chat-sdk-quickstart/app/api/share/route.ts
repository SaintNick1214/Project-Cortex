export function GET() {
  return Response.json(
    { code: "USE_AUTHORIZED_BACKEND_SHARING", version: 1 },
    { status: 410 }
  );
}
export const POST = GET;
export const DELETE = GET;
