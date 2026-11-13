import type { Metadata } from "next";
import { ForgotPasswordPage } from "../../screens/ForgotPasswordPage";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return <ForgotPasswordPage />;
}
