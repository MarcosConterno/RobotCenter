import type { Metadata } from "next";

import PasswordRecoveryResetForm from "@/components/auth/PasswordRecoveryResetForm";

export const metadata: Metadata = {
  title: "Definir nova senha",
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <PasswordRecoveryResetForm token={token} />;
}
