import { redirect } from "next/navigation";
import { getAuthenticatedEmployee } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getActiveCustomerSessionForEmployee } from "@/lib/sessions/activeCustomerSession";
import { CustomerWaitingScreen } from "@/components/customer/CustomerWaitingScreen";

export default async function CustomerEntryPage() {
  const employee = await getAuthenticatedEmployee();
  if (!employee) redirect("/auth/login");

  const [i18n, activeSession] = await Promise.all([
    getI18n(),
    getActiveCustomerSessionForEmployee(employee.id),
  ]);

  if (activeSession) {
    redirect(`/customer/${activeSession.id}?device=${encodeURIComponent(activeSession.customerDeviceId)}`);
  }

  return (
    <CustomerWaitingScreen
      employeeName={employee.full_name}
      translations={i18n.translations}
    />
  );
}
