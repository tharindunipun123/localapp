import { Header } from "./Header";
import { Footer } from "./Footer";

export function PublicLayout({ children }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
