import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

/** Scrolls to top on every route change. */
const ScrollToTop = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
};

export const Layout = ({
  children,
  withSearch = true,
}: {
  children: ReactNode;
  withSearch?: boolean;
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ScrollToTop />
      <Header withSearch={withSearch} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};
