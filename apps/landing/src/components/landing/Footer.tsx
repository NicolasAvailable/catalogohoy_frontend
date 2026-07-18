import logo from "@/assets/logo.svg";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

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
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="CatalogoHoy" className="h-7 w-7" />
            <span className="font-display font-bold text-lg text-foreground">CatalogoHoy</span>
          </div>
          <nav aria-label="Navegación del pie de página" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/features" className="hover:text-foreground transition-colors">Funciones</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Precios</Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">Preguntas frecuentes</Link>
            <Link to="/vender-por-whatsapp" className="hover:text-foreground transition-colors">Vender por WhatsApp</Link>
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacidad</Link>
            <Link to="/terms-of-service" className="hover:text-foreground transition-colors">Términos</Link>
            <Link to="/data-deletion" className="hover:text-foreground transition-colors">Eliminación de Datos</Link>
          </nav>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CatalogoHoy. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
