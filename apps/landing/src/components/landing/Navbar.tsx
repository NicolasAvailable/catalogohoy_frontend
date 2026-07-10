import logo from "@/assets/logo.svg";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Links reales a páginas (crawleables, habilitan sitelinks en Google) +
// anclas ancladas a la raíz para que funcionen desde cualquier ruta.
const navLinks = [
  { href: "/#how-it-works", label: "Cómo funciona" },
  { href: "/features", label: "Funciones" },
  { href: "/pricing", label: "Precios" },
  { href: "/faq", label: "FAQ" },
  { href: "/#contact", label: "Contacto" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <nav aria-label="Navegación principal" className="container mx-auto flex items-center justify-between h-16 px-4 max-w-6xl">
        {/* Logo */}
        <a href="/" className="flex items-center" aria-label="CatalogoHoy — Inicio">
          <img src={logo} alt="" className="h-11 w-11" aria-hidden="true" />
          <span className="font-display font-bold text-xl text-foreground">
            CatalogoHoy
          </span>
        </a>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-foreground transition-colors">
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop auth buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://auth.catalogohoy.com/signup" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-foreground/20 bg-white px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-all"
          >
            Empezar gratis
          </a>
          <a
            href="https://auth.catalogohoy.com/login" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-700 transition-all hover:shadow-lg hover:shadow-primary/25"
          >
            Iniciar sesión
          </a>
        </div>

        {/* Mobile hamburger button */}
        <button
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-foreground hover:bg-muted transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="md:hidden overflow-hidden bg-background/95 backdrop-blur-md border-b border-border"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="py-3 px-3 rounded-lg text-base font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {link.label}
                </a>
              ))}

              <hr className="my-2 border-border" />

              <a
                href="https://auth.catalogohoy.com/signup" target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center justify-center rounded-xl border border-foreground/20 bg-white px-5 py-3 text-base font-semibold text-foreground hover:bg-muted transition-all"
              >
                Empezar gratis
              </a>
              <a
                href="https://auth.catalogohoy.com/login" target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary-700 transition-all"
              >
                Iniciar sesión
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
