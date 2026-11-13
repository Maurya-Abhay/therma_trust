import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordPage } from "../../screens/ResetPasswordPage";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default function Page() {
  // The page reads ?uid= and ?token= on the client; Suspense lets the rest prerender.
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}
