import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Política de Privacidad
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Última actualización: 13 de marzo de 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90 text-[15px] leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              1. Introducción
            </h2>
            <p>
              En <strong>CatalogoHoy</strong> ("nosotros", "nuestro" o "la Plataforma"), accesible
              desde <strong>catalogohoy.com</strong>, nos comprometemos a proteger la privacidad de
              nuestros usuarios. Esta Política de Privacidad describe qué datos personales
              recopilamos, cómo los usamos, con quién los compartimos y cuáles son tus derechos
              sobre ellos.
            </p>
            <p>
              Al registrarte o utilizar CatalogoHoy, aceptas las prácticas descritas en esta
              política. Si no estás de acuerdo, por favor no utilices nuestros servicios.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              2. Datos que Recopilamos
            </h2>

            <h3 className="font-display text-lg font-medium text-foreground mt-4">
              2.1 Datos proporcionados por el usuario
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Datos de cuenta:</strong> nombre, dirección de correo electrónico y
                contraseña al registrarte.
              </li>
              <li>
                <strong>Datos del negocio:</strong> nombre de la tienda, descripción, productos
                (nombre, precio, imágenes, descripciones) y cualquier información que incluyas en tu
                catálogo digital.
              </li>
              <li>
                <strong>Número de WhatsApp Business:</strong> al conectar tu cuenta de WhatsApp
                Business mediante el flujo de Embedded Signup de Meta.
              </li>
              <li>
                <strong>Identificadores de WhatsApp Business API:</strong> WABA ID (WhatsApp
                Business Account ID) y Phone Number ID, necesarios para operar la integración de
                mensajería.
              </li>
              <li>
                <strong>Contenido de mensajes:</strong> los mensajes enviados y recibidos a través
                de la integración de WhatsApp Business se almacenan para mostrarlos en el panel de
                conversaciones.
              </li>
              <li>
                <strong>Datos de pago:</strong> la información de facturación y pago es procesada
                directamente por Stripe. CatalogoHoy no almacena números de tarjeta de crédito ni
                datos financieros sensibles.
              </li>
            </ul>

            <h3 className="font-display text-lg font-medium text-foreground mt-4">
              2.2 Datos recopilados automáticamente
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Dirección IP y user agent:</strong> para seguridad, prevención de fraude y
                análisis de uso.
              </li>
              <li>
                <strong>Datos de uso del producto:</strong> interacciones con la plataforma
                (páginas visitadas, funciones utilizadas) recopilados mediante PostHog para mejorar
                el producto.
              </li>
              <li>
                <strong>Cookies y tecnologías similares:</strong> utilizamos cookies esenciales para
                el funcionamiento de la plataforma y cookies analíticas para entender el uso del
                servicio.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              3. Propósito del Procesamiento de Datos
            </h2>
            <p>Utilizamos tus datos para los siguientes fines:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Proveer el servicio:</strong> crear y publicar tu catálogo digital, gestionar
                tu cuenta, procesar mensajes de WhatsApp Business y facilitar la comunicación con tus
                clientes.
              </li>
              <li>
                <strong>Procesamiento de pagos:</strong> gestionar suscripciones y facturación a
                través de Stripe.
              </li>
              <li>
                <strong>Mejorar el producto:</strong> analizar el uso de la plataforma para
                identificar mejoras, corregir errores y desarrollar nuevas funcionalidades.
              </li>
              <li>
                <strong>Soporte al cliente:</strong> responder a tus consultas y resolver problemas
                técnicos.
              </li>
              <li>
                <strong>Seguridad:</strong> detectar y prevenir actividades fraudulentas, abuso del
                servicio y accesos no autorizados.
              </li>
              <li>
                <strong>Cumplimiento legal:</strong> cumplir con obligaciones legales y regulatorias
                aplicables.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              4. Terceros y Datos Compartidos
            </h2>
            <p>
              Compartimos datos con los siguientes proveedores de servicios, estrictamente para
              operar la plataforma:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Meta Platforms, Inc. (Facebook/WhatsApp):</strong> utilizamos la WhatsApp
                Business API (Cloud API), Facebook Login for Business y Embedded Signup. Al conectar
                tu cuenta de WhatsApp Business, Meta recibe y procesa tu número de teléfono, WABA
                ID, Phone Number ID y el contenido de los mensajes enviados y recibidos. El uso de
                estos datos por parte de Meta se rige por la{" "}
                <a
                  href="https://www.whatsapp.com/legal/business-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Política de WhatsApp Business
                </a>{" "}
                y la{" "}
                <a
                  href="https://www.facebook.com/privacy/policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Política de Privacidad de Meta
                </a>
                .
              </li>
              <li>
                <strong>Supabase, Inc.:</strong> proveedor de infraestructura (base de datos,
                autenticación y almacenamiento de archivos). Los datos se almacenan en servidores
                seguros gestionados por Supabase.
              </li>
              <li>
                <strong>Stripe, Inc.:</strong> procesamiento de pagos y suscripciones. Stripe
                recibe los datos de facturación necesarios para procesar los pagos.
              </li>
              <li>
                <strong>PostHog, Inc.:</strong> análisis de producto. PostHog recibe datos de uso
                anonimizados para ayudarnos a mejorar la plataforma.
              </li>
            </ul>
            <p className="mt-3">
              No vendemos, alquilamos ni compartimos tus datos personales con terceros para fines
              publicitarios o de marketing. Solo compartimos datos cuando es necesario para prestar
              el servicio, cumplir con la ley o proteger nuestros derechos.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              5. Retención de Datos
            </h2>
            <p>Conservamos tus datos durante los siguientes períodos:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Datos de cuenta y negocio:</strong> mientras tu cuenta esté activa. Si
                cancelas tu suscripción, los datos se conservarán durante 30 días adicionales antes
                de ser eliminados, para permitir la reactivación.
              </li>
              <li>
                <strong>Mensajes de WhatsApp:</strong> mientras tu cuenta esté activa. Se eliminan
                junto con los demás datos de la cuenta tras la cancelación.
              </li>
              <li>
                <strong>Registros de seguridad (IP, user agent):</strong> hasta 90 días.
              </li>
              <li>
                <strong>Datos analíticos:</strong> se almacenan de forma agregada y anonimizada, sin
                límite de tiempo definido.
              </li>
            </ul>
            <p className="mt-3">
              Si solicitas la eliminación de tus datos, los eliminaremos en un plazo máximo de 30
              días desde la solicitud, salvo que exista una obligación legal que nos requiera
              conservarlos.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              6. Tus Derechos
            </h2>
            <p>
              Dependiendo de tu ubicación, puedes ejercer los siguientes derechos sobre tus datos
              personales:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Acceso:</strong> solicitar una copia de los datos personales que tenemos
                sobre ti.
              </li>
              <li>
                <strong>Rectificación:</strong> corregir datos inexactos o incompletos.
              </li>
              <li>
                <strong>Eliminación:</strong> solicitar la eliminación de todos tus datos personales.
                Consulta nuestra{" "}
                <Link to="/data-deletion" className="text-primary hover:underline">
                  página de eliminación de datos
                </Link>{" "}
                para instrucciones detalladas.
              </li>
              <li>
                <strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso
                común.
              </li>
              <li>
                <strong>Oposición:</strong> oponerte al procesamiento de tus datos para fines
                específicos.
              </li>
              <li>
                <strong>Restricción:</strong> solicitar la limitación del procesamiento de tus datos.
              </li>
            </ul>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos, escríbenos a{" "}
              <a
                href="mailto:catalogohoy@outlook.com"
                className="text-primary hover:underline"
              >
                catalogohoy@outlook.com
              </a>
              . Responderemos a tu solicitud en un plazo máximo de 30 días. El ejercicio de estos
              derechos es completamente gratuito.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              7. Seguridad de los Datos
            </h2>
            <p>
              Implementamos medidas técnicas y organizativas para proteger tus datos, incluyendo:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Cifrado en tránsito (HTTPS/TLS) y en reposo.</li>
              <li>Autenticación segura con gestión de sesiones.</li>
              <li>Acceso restringido a datos personales solo al personal autorizado.</li>
              <li>Monitoreo continuo de la infraestructura.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              8. Cumplimiento Legal
            </h2>
            <p>
              Esta política está diseñada para cumplir con las siguientes regulaciones aplicables:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>GDPR</strong> (Reglamento General de Protección de Datos — Unión Europea):
                si eres residente de la UE, tienes todos los derechos descritos en la Sección 6.
              </li>
              <li>
                <strong>CCPA</strong> (Ley de Privacidad del Consumidor de California): si eres
                residente de California, tienes derecho a conocer qué datos recopilamos, solicitar
                su eliminación y optar por no compartirlos.
              </li>
              <li>
                <strong>Legislación latinoamericana aplicable:</strong> cumplimos con las leyes de
                protección de datos vigentes en los países donde operamos, incluyendo la LOPD y
                normativas equivalentes.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              9. Menores de Edad
            </h2>
            <p>
              CatalogoHoy no está dirigido a menores de 18 años. No recopilamos deliberadamente
              datos de menores. Si descubrimos que hemos recopilado datos de un menor, los
              eliminaremos de inmediato.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              10. Cambios a esta Política
            </h2>
            <p>
              Podemos actualizar esta Política de Privacidad periódicamente. Publicaremos cualquier
              cambio en esta página con una nueva fecha de "Última actualización". Si los cambios
              son significativos, te notificaremos por correo electrónico o mediante un aviso en la
              plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              11. Contacto
            </h2>
            <p>
              Si tienes preguntas o inquietudes sobre esta política o el tratamiento de tus datos,
              contáctanos:
            </p>
            <ul className="list-none pl-0 space-y-1 mt-2">
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:catalogohoy@outlook.com"
                  className="text-primary hover:underline"
                >
                  catalogohoy@outlook.com
                </a>
              </li>
              <li>
                <strong>Sitio web:</strong> catalogohoy.com
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
