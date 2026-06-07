import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { getActiveCustomerSessionForEmployee } from "@/lib/sessions/activeCustomerSession";
import { getBackgroundSessionsForEmployee } from "@/lib/sessions/backgroundSessions";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee();
    if (request.nextUrl.searchParams.get("target") === "customer") {
      const session = await getActiveCustomerSessionForEmployee(employee.id);
      return NextResponse.json({ data: session, error: null });
    }

    const sessions = await getBackgroundSessionsForEmployee(employee.id);
    return NextResponse.json({ data: sessions, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
