import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
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
          Términos de Servicio
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Última actualización: 13 de marzo de 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90 text-[15px] leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              1. Aceptación de los Términos
            </h2>
            <p>
              Al acceder o utilizar <strong>CatalogoHoy</strong> ("la Plataforma"), accesible desde{" "}
              <strong>catalogohoy.com</strong>, aceptas quedar vinculado por estos Términos de
              Servicio. Si no estás de acuerdo con alguno de estos términos, no utilices la
              Plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              2. Descripción del Servicio
            </h2>
            <p>
              CatalogoHoy es una plataforma SaaS que permite a comerciantes y negocios:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Crear y publicar catálogos digitales con sus productos y servicios.
              </li>
              <li>
                Conectar su cuenta de WhatsApp Business mediante el flujo de Embedded Signup de Meta
                para enviar y recibir mensajes con sus clientes.
              </li>
              <li>
                Gestionar conversaciones de WhatsApp Business desde un panel centralizado.
              </li>
              <li>
                Compartir su catálogo digital a través de un enlace público.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              3. Registro y Cuenta
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Debes ser mayor de 18 años para crear una cuenta en CatalogoHoy.
              </li>
              <li>
                Eres responsable de proporcionar información precisa y mantenerla actualizada.
              </li>
              <li>
                Eres responsable de la seguridad de tu cuenta y contraseña. CatalogoHoy no será
                responsable por accesos no autorizados a tu cuenta derivados de tu negligencia.
              </li>
              <li>
                No puedes crear más de una cuenta por persona o negocio sin autorización previa.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              4. Uso Aceptable
            </h2>
            <p>Al utilizar CatalogoHoy, te comprometes a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Cumplir con todas las leyes y regulaciones aplicables.</li>
              <li>
                Cumplir con las{" "}
                <a
                  href="https://www.whatsapp.com/legal/business-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Políticas de WhatsApp Business
                </a>{" "}
                y las{" "}
                <a
                  href="https://developers.facebook.com/terms/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Condiciones de la Plataforma de Meta
                </a>
                .
              </li>
              <li>
                No enviar mensajes de spam, contenido no solicitado o mensajes masivos no
                autorizados a través de la integración de WhatsApp.
              </li>
              <li>
                No publicar contenido ilegal, fraudulento, difamatorio, obsceno o que infrinja
                derechos de terceros en tu catálogo.
              </li>
              <li>
                No intentar acceder a cuentas, sistemas o datos de otros usuarios.
              </li>
              <li>
                No utilizar la Plataforma para actividades que perjudiquen a CatalogoHoy, sus
                usuarios o terceros.
              </li>
              <li>
                No realizar ingeniería inversa, descompilar o intentar extraer el código fuente de
                la Plataforma.
              </li>
            </ul>
            <p className="mt-3">
              Nos reservamos el derecho de suspender o cancelar tu cuenta si violas estas
              condiciones de uso.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              5. Suscripciones y Pagos
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                CatalogoHoy ofrece planes de suscripción con diferentes niveles de funcionalidad.
                Los precios y características de cada plan están disponibles en nuestra página de
                precios.
              </li>
              <li>
                Los pagos se procesan a través de Stripe. Al suscribirte, autorizas el cobro
                recurrente según el plan elegido.
              </li>
              <li>
                Puedes cancelar tu suscripción en cualquier momento. La cancelación será efectiva al
                final del período de facturación vigente.
              </li>
              <li>
                Nos reservamos el derecho de modificar los precios con un aviso previo de 30 días.
                Los cambios de precio no afectarán al período de facturación en curso.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              6. Propiedad Intelectual
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>De CatalogoHoy:</strong> la Plataforma, su diseño, código, marca, logotipos
                y todo el contenido creado por CatalogoHoy son propiedad exclusiva de CatalogoHoy y
                están protegidos por leyes de propiedad intelectual.
              </li>
              <li>
                <strong>Del usuario:</strong> conservas todos los derechos sobre el contenido que
                publicas (productos, imágenes, descripciones). Al subir contenido a CatalogoHoy, nos
                otorgas una licencia limitada, no exclusiva y revocable para mostrar dicho contenido
                en el contexto del servicio (por ejemplo, en tu catálogo público).
              </li>
              <li>
                No adquirimos propiedad sobre tus datos ni tu contenido. Al cancelar tu cuenta,
                esta licencia se extingue.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              7. Integración con WhatsApp Business
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                La integración con WhatsApp Business se realiza a través de las APIs oficiales de
                Meta (WhatsApp Cloud API y Embedded Signup).
              </li>
              <li>
                Al conectar tu cuenta de WhatsApp Business, aceptas también los términos y
                condiciones de Meta/WhatsApp aplicables.
              </li>
              <li>
                CatalogoHoy no es responsable por interrupciones, cambios o limitaciones en el
                servicio de WhatsApp Business impuestas por Meta.
              </li>
              <li>
                Eres el único responsable del contenido de los mensajes que envías a tus clientes y
                del cumplimiento de las políticas de mensajería de WhatsApp.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              8. Limitación de Responsabilidad
            </h2>
            <p>
              CatalogoHoy se proporciona "tal cual" y "según disponibilidad". En la máxima medida
              permitida por la ley:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                No garantizamos que el servicio será ininterrumpido, libre de errores o
                completamente seguro.
              </li>
              <li>
                No somos responsables por daños indirectos, incidentales, especiales o consecuentes
                que resulten del uso o la imposibilidad de uso de la Plataforma.
              </li>
              <li>
                Nuestra responsabilidad total ante ti no excederá el monto que hayas pagado a
                CatalogoHoy durante los 12 meses anteriores al evento que dio origen al reclamo.
              </li>
              <li>
                No somos responsables por el contenido publicado por los usuarios en sus catálogos
                ni por los mensajes enviados a través de WhatsApp Business.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              9. Terminación
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Puedes cancelar tu cuenta en cualquier momento desde la configuración de tu perfil o
                contactándonos a{" "}
                <a
                  href="mailto:catalogohoy@outlook.com"
                  className="text-primary hover:underline"
                >
                  catalogohoy@outlook.com
                </a>
                .
              </li>
              <li>
                Nos reservamos el derecho de suspender o cancelar tu cuenta inmediatamente si:
                violas estos Términos, usas la Plataforma de forma fraudulenta, o si es requerido
                por ley.
              </li>
              <li>
                Tras la cancelación, tus datos serán eliminados según lo descrito en nuestra{" "}
                <Link to="/privacy-policy" className="text-primary hover:underline">
                  Política de Privacidad
                </Link>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              10. Modificaciones a los Términos
            </h2>
            <p>
              Podemos actualizar estos Términos de Servicio periódicamente. Publicaremos cualquier
              cambio en esta página con una nueva fecha de "Última actualización". Si los cambios
              son sustanciales, te notificaremos por correo electrónico o mediante un aviso en la
              Plataforma. El uso continuado del servicio después de los cambios constituye tu
              aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              11. Ley Aplicable y Jurisdicción
            </h2>
            <p>
              Estos Términos se regirán e interpretarán de acuerdo con las leyes aplicables en la
              jurisdicción donde CatalogoHoy opera. Cualquier disputa que surja en relación con
              estos Términos será sometida a los tribunales competentes de dicha jurisdicción.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              12. Privacidad
            </h2>
            <p>
              El tratamiento de tus datos personales se rige por nuestra{" "}
              <Link to="/privacy-policy" className="text-primary hover:underline">
                Política de Privacidad
              </Link>
              , que forma parte integral de estos Términos de Servicio.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              13. Contacto
            </h2>
            <p>
              Si tienes preguntas sobre estos Términos de Servicio, contáctanos:
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

export default TermsOfService;
