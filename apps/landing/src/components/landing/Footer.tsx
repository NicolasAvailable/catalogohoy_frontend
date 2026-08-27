import logo from "@/assets/logo.svg";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const linkCls = "hover:text-foreground transition-colors";

const Footer = () => {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="border-t border-border bg-card py-12"
    >
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <img src={logo} alt="CatalogoHoy" className="h-7 w-7" />
              <span className="font-display font-bold text-lg text-foreground">
                CatalogoHoy
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Crea tu catálogo digital y vende por WhatsApp. Gratis para empezar.
            </p>
          </div>

          {/* Producto */}
          <nav aria-label="Producto" className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Producto</span>
            <Link to="/features" className={linkCls}>Funciones</Link>
            <Link to="/pricing" className={linkCls}>Precios</Link>
            <Link to="/faq" className={linkCls}>Preguntas frecuentes</Link>
          </nav>

          {/* Guías */}
          <nav aria-label="Guías" className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Guías</span>
            <Link to="/blog" className={linkCls}>Blog</Link>
            <Link to="/catalogo-digital" className={linkCls}>Catálogo digital</Link>
            <Link to="/catalogo-por-whatsapp" className={linkCls}>Catálogo por WhatsApp</Link>
            <Link to="/crear-catalogo-online-gratis" className={linkCls}>Crear catálogo gratis</Link>
            <Link to="/catalogo-para-tiendas-de-ropa" className={linkCls}>Catálogo para tiendas de ropa</Link>
            <Link to="/menu-digital-para-restaurantes" className={linkCls}>Menú digital para restaurantes</Link>
            <Link to="/blog/ventas-por-whatsapp/como-vender-por-whatsapp-guia-2026" className={linkCls}>Cómo vender por WhatsApp</Link>
            <Link to="/blog/por-pais" className={linkCls}>Guías por país</Link>
          </nav>

          {/* Legal */}
          <nav aria-label="Legal" className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Legal</span>
            <Link to="/privacy-policy" className={linkCls}>Privacidad</Link>
            <Link to="/terms-of-service" className={linkCls}>Términos</Link>
            <Link to="/data-deletion" className={linkCls}>Eliminación de datos</Link>
          </nav>
        </div>

        <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} CatalogoHoy. Todos los derechos reservados.
        </p>
      </div>
    </motion.footer>
  );
};

export default Footer;
