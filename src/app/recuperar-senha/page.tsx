import type { Metadata } from "next";

import PasswordRecoveryRequestForm from "@/components/auth/PasswordRecoveryRequestForm";

export const metadata: Metadata = {
  title: "Recuperar senha",
  referrer: "no-referrer",
};

export default function RecoverPasswordPage() {
  return <PasswordRecoveryRequestForm />;
}
