import { chat } from "@/lib/chat";
export function POST(request: Request) {
  return chat(request, false);
}
