import { motion } from "framer-motion";
import { Instagram, ShieldCheck } from "lucide-react";

const WHATSAPP_NUMBER = "584220240947";
const INSTAGRAM_URL = "https://www.instagram.com/catalogohoy/";
const EMAIL = "nicolas@catalogohoy.com";

const Contact = () => {
  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="py-24 md:py-32 bg-white"
    >
      <div className="container mx-auto px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2
            id="contact-heading"
            className="font-display font-extrabold text-3xl md:text-4xl text-foreground leading-tight"
          >
            ¿Alguna pregunta?
          </h2>
          <p className="mt-3 text-muted-foreground text-base md:text-lg">
            Ponerte en contacto con nosotros es muy fácil
          </p>

          {/* Channel buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-7 py-3 text-white font-semibold text-sm shadow-lg shadow-[#25D366]/25 hover:bg-[#1fbe5a] transition-colors w-full sm:w-auto"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-5 h-5 fill-white"
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.04 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.453 3.488z" />
              </svg>
              Escríbenos por WhatsApp
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-white font-semibold text-sm shadow-lg shadow-pink-500/25 transition-opacity hover:opacity-90 w-full sm:w-auto"
              style={{
                background:
                  "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              }}
            >
              <Instagram className="h-5 w-5" />
              Escríbenos por Instagram
            </a>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3.5 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Siempre responderemos lo más rápido posible
          </div>

          <p className="mt-6 text-sm text-muted-foreground max-w-xl mx-auto">
            También nos puedes escribir directamente desde tu servicio de Email a{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="font-semibold text-primary underline underline-offset-2 hover:text-primary-700"
            >
              {EMAIL}
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;
