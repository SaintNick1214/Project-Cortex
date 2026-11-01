export function GET() {
  return Response.json(
    { code: "LEGACY_APP_VOTES_RETIRED", version: 1 },
    { status: 410 }
  );
}
export const PATCH = GET;
