import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Clock, Trash2, CheckCircle } from "lucide-react";

const DataDeletion = () => {
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
          Eliminación de Datos
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Última actualización: 13 de marzo de 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/90 text-[15px] leading-relaxed">
          <section>
            <p>
              En <strong>CatalogoHoy</strong> respetamos tu derecho a controlar tus datos
              personales. Puedes solicitar la eliminación completa de tu cuenta y todos los datos
              asociados en cualquier momento, de forma <strong>completamente gratuita</strong>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Cómo Solicitar la Eliminación de tus Datos
            </h2>

            <div className="space-y-6 mt-6">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-medium text-foreground">
                    Paso 1: Envía tu solicitud
                  </h3>
                  <p className="mt-1">
                    Envía un correo electrónico a{" "}
                    <a
                      href="mailto:catalogohoy@outlook.com?subject=Solicitud de eliminación de datos"
                      className="text-primary hover:underline font-medium"
                    >
                      catalogohoy@outlook.com
                    </a>{" "}
                    con el asunto <strong>"Solicitud de eliminación de datos"</strong>. Incluye en
                    el correo:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 mt-2">
                    <li>Tu nombre completo.</li>
                    <li>La dirección de correo electrónico asociada a tu cuenta.</li>
                    <li>El nombre de tu negocio/tienda en CatalogoHoy (si aplica).</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-medium text-foreground">
                    Paso 2: Verificación de identidad
                  </h3>
                  <p className="mt-1">
                    Para proteger tu privacidad, verificaremos tu identidad confirmando que la
                    solicitud proviene del titular de la cuenta. Esto puede incluir un correo de
                    confirmación enviado a la dirección registrada.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-medium text-foreground">
                    Paso 3: Eliminación de datos
                  </h3>
                  <p className="mt-1">
                    Una vez verificada tu identidad, procederemos a eliminar todos tus datos de
                    nuestros sistemas.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-medium text-foreground">
                    Paso 4: Confirmación
                  </h3>
                  <p className="mt-1">
                    Recibirás un correo de confirmación cuando la eliminación haya sido completada.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Tiempo de Respuesta
            </h2>
            <p>
              Procesaremos tu solicitud en un plazo máximo de <strong>30 días</strong> desde la
              recepción del correo. En la mayoría de los casos, la eliminación se completa en menos
              de 7 días hábiles.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Datos que Serán Eliminados
            </h2>
            <p>
              Al procesar tu solicitud, eliminaremos de forma permanente los siguientes datos:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Datos de cuenta:</strong> nombre, correo electrónico, contraseña y
                preferencias de configuración.
              </li>
              <li>
                <strong>Datos del negocio:</strong> nombre de la tienda, productos, precios,
                descripciones e imágenes del catálogo.
              </li>
              <li>
                <strong>Datos de WhatsApp Business:</strong> número de teléfono registrado, WABA ID,
                Phone Number ID y la conexión con WhatsApp Business API.
              </li>
              <li>
                <strong>Mensajes:</strong> todo el historial de conversaciones de WhatsApp
                almacenado en nuestra plataforma.
              </li>
              <li>
                <strong>Datos de facturación:</strong> historial de suscripción y registros de pago
                en nuestra plataforma (los registros en Stripe se gestionan según sus propias
                políticas de retención).
              </li>
              <li>
                <strong>Archivos:</strong> todas las imágenes y archivos subidos a la plataforma.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Excepciones
            </h2>
            <p>
              En ciertos casos, podemos retener datos mínimos cuando sea requerido por ley (por
              ejemplo, registros de facturación por obligaciones fiscales). En tal caso, te
              informaremos qué datos deben conservarse y por cuánto tiempo.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Costo
            </h2>
            <p>
              La solicitud de eliminación de datos es <strong>completamente gratuita</strong>. No se
              cobra ninguna tarifa por ejercer este derecho.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Contacto
            </h2>
            <p>
              Si tienes preguntas sobre el proceso de eliminación de datos, contáctanos:
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

          <section>
            <p className="text-sm text-muted-foreground">
              Para más información sobre cómo tratamos tus datos, consulta nuestra{" "}
              <Link to="/privacy-policy" className="text-primary hover:underline">
                Política de Privacidad
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DataDeletion;
