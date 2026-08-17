import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// Redirige a una página del admin del catálogo a partir del slug de la URL.
// Lo usan los botones de las plantillas de WhatsApp de customer success:
//   /r/productos/:slug → admin/products/create   (activation_no_product)
//   /r/whatsapp/:slug  → admin/catalog/edit      (setup_missing_whatsapp)
//   /r/compartir/:slug → admin/catalog/edit      (activation_share_catalog, reengagement)
//
// Meta APPENDEA el parámetro al final de la URL base del botón (que incluye el
// literal "{{1}}"), así que el slug puede llegar como "{{1}}mi-tienda":
// tomamos el tramo final con forma de slug. Mismo patrón que PlanRedirect.

interface Props {
  /** Ruta del admin a la que redirigir, ej. "/admin/products/create". */
  to: string;
  /** Texto del spinner mientras redirige. */
  label: string;
}

const AdminRedirect = ({ to, label }: Props) => {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const clean =
      (slug ?? "").match(/[a-z0-9][a-z0-9-]*$/i)?.[0]?.toLowerCase() ?? "";
    if (!clean) {
      setError(true);
      return;
    }
    window.location.replace(`https://${clean}.catalogohoy.com${to}`);
  }, [slug, to]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <h1 className="text-xl font-semibold">No encontramos ese catálogo</h1>
          <p className="text-muted-foreground">
            Es posible que el enlace sea incorrecto.{" "}
            <a href="https://catalogohoy.com" className="underline">
              Ir al inicio
            </a>
          </p>
        </>
      ) : (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-foreground" />
          <p className="text-muted-foreground">{label}</p>
        </>
      )}
    </div>
  );
};

export default AdminRedirect;
