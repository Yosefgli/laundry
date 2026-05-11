import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { getActiveCustomerSessionForEmployee } from "@/lib/sessions/activeCustomerSession";

export async function GET() {
  try {
    const employee = await requireEmployee();
    const session = await getActiveCustomerSessionForEmployee(employee.id);

    return NextResponse.json({ data: session, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
