import type { RouteRecord } from "vite-react-ssg";
import { Outlet } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import Home from "./pages/Home";
import CategoryPage from "./pages/CategoryPage";
import ArticlePage from "./pages/ArticlePage";
import SearchPage from "./pages/SearchPage";
import NotFound from "./pages/NotFound";
import { categories } from "./content";

const Root = () => (
  <>
    <Analytics />
    <Outlet />
  </>
);

const articleSlugs = categories.flatMap((c) =>
  c.articles.map((a) => a.slug)
);

export const routes: RouteRecord[] = [
  {
    path: "/",
    element: <Root />,
    children: [
      { index: true, element: <Home /> },
      { path: "buscar", element: <SearchPage /> },
      {
        path: "c/:categorySlug",
        element: <CategoryPage />,
        getStaticPaths: () => categories.map((c) => `/c/${c.slug}`),
      },
      {
        path: "a/:articleSlug",
        element: <ArticlePage />,
        getStaticPaths: () => articleSlugs.map((s) => `/a/${s}`),
      },
      { path: "*", element: <NotFound /> },
    ],
  },
];
