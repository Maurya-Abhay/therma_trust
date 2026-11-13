import { LandingPage } from "../screens/LandingPage";
import { RedirectIfSignedIn } from "../components/RedirectIfSignedIn";

export default function Home() {
  return (
    <>
      <RedirectIfSignedIn />
      <LandingPage />
    </>
  );
}
