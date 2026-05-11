import { LoginForm } from "@/components/auth/LoginForm";
import { getI18n } from "@/lib/i18n/server";

export default async function LoginPage() {
  const { translations } = await getI18n();
  return <LoginForm translations={translations} />;
}
