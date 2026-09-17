import { currentUser, handle } from "@/server/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => Response.json({ user: await currentUser() }));
}
