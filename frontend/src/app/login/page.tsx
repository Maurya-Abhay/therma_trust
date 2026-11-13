import type { Metadata } from "next";
import { LoginPage } from "../../screens/LoginPage";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <LoginPage />;
}
