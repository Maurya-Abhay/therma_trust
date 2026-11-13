import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterPage } from "../../screens/RegisterPage";

export const metadata: Metadata = { title: "Create your account" };

export default function Page() {
  // RegisterPage reads ?role= on the client; Suspense lets the rest prerender.
  return (
    <Suspense>
      <RegisterPage />
    </Suspense>
  );
}
