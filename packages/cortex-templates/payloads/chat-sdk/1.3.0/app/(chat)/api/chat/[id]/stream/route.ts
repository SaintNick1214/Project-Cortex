import { identifier, withRuntime } from "@/lib/runtime/server";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withRuntime(request, async (client) => {
    const { id } = await context.params;
    const handle = await client.attach(identifier(id));
    return client.observe(handle);
  });
}
