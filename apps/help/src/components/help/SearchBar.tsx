import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

export const SearchBar = ({
  size = "lg",
  initial = "",
  autoFocus = false,
}: {
  size?: "lg" | "sm";
  initial?: string;
  autoFocus?: boolean;
}) => {
  const [q, setQ] = useState(initial);
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) navigate(`/buscar?q=${encodeURIComponent(term)}`);
  };

  const big = size === "lg";

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <Search
        className={`absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground ${
          big ? "h-5 w-5" : "h-4 w-4"
        }`}
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Buscar artículos…"
        aria-label="Buscar en el centro de ayuda"
        className={`w-full rounded-xl border border-border bg-white text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition ${
          big ? "pl-12 pr-4 py-3.5 text-base" : "pl-10 pr-3 py-2.5 text-sm"
        }`}
      />
    </form>
  );
};
