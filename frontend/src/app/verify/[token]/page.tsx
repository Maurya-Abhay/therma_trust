import type { Metadata } from "next";
import { VerifyPage } from "../../../screens/public/VerifyPage";

export const metadata: Metadata = {
  title: "Capability verification",
  // Tokens are private share links, not something to index.
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ hash?: string }>;
}) {
  const { token } = await params;
  const { hash } = await searchParams;
  return <VerifyPage token={token} passportHash={hash ?? null} />;
}
