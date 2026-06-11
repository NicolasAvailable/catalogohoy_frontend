import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="mt-20 bg-foreground text-white/70">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p className="font-display font-semibold text-white">
            Catálogo Hoy · Centro de ayuda
          </p>
          <nav className="flex items-center gap-6">
            <Link to="/" className="hover:text-white transition-colors">
              Inicio
            </Link>
            <a
              href="https://catalogohoy.com"
              className="hover:text-white transition-colors"
            >
              Sitio web
            </a>
            <a
              href="https://auth.catalogohoy.com/login"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Iniciar sesión
            </a>
          </nav>
        </div>
        <p className="mt-6 text-xs text-white/40">
          ¿No encuentras lo que buscas? Escríbenos por WhatsApp desde tu panel y
          con gusto te ayudamos.
        </p>
      </div>
    </footer>
  );
};
