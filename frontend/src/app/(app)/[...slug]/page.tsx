import type { Metadata } from "next";
import { SpaLoader } from "../../../spa/SpaLoader";

// Every signed-in screen (dashboards, jobs, reports...) is served by this one
// route: the page is identical for every path, so it is generated once and
// cached, and the client-side router inside picks the screen from the URL.
export const metadata: Metadata = {
  title: { absolute: "ThermaTrust" },
  // Everything behind this route needs a login; there is nothing to index.
  robots: { index: false, follow: false },
};

export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <SpaLoader />;
}
