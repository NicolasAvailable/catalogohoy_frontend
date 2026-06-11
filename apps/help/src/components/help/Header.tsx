import { Link } from "react-router-dom";
import logo from "@/assets/logo.svg";
import { SearchBar } from "./SearchBar";

export const Header = ({ withSearch = false }: { withSearch?: boolean }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/85 backdrop-blur-md">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4">
          <Link to="/" className="flex items-center gap-1.5 shrink-0" aria-label="Centro de ayuda — Inicio">
            <img src={logo} alt="" className="h-9 w-9" aria-hidden="true" />
            <span className="font-display font-bold text-lg text-foreground leading-tight">
              Catálogo Hoy
              <span className="block text-[11px] font-medium text-muted-foreground -mt-0.5">
                Centro de ayuda
              </span>
            </span>
          </Link>

          {withSearch && (
            <div className="ml-auto hidden sm:block w-full max-w-xs">
              <SearchBar size="sm" />
            </div>
          )}

          <a
            href="https://auth.catalogohoy.com/login"
            target="_blank"
            rel="noopener noreferrer"
            className={`${withSearch ? "" : "ml-auto"} hidden sm:inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-700 transition-colors`}
          >
            Ir a mi panel
          </a>
        </div>
        {withSearch && (
          <div className="sm:hidden pb-3">
            <SearchBar size="sm" />
          </div>
        )}
      </div>
    </header>
  );
};
