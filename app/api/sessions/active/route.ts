import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { getBackgroundSessionsForEmployee } from "@/lib/sessions/backgroundSessions";

export async function GET() {
  try {
    const employee = await requireEmployee();
    const sessions = await getBackgroundSessionsForEmployee(employee.id);
    return NextResponse.json({ data: sessions, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
