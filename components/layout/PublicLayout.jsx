import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileTabBar } from "./MobileTabBar";
import { OnboardingTour } from "./OnboardingTour";

export function PublicLayout({ children }) {
  return (
    <>
      <Header />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileTabBar />
      <OnboardingTour />
    </>
  );
}
