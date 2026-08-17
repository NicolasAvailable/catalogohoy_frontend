import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// catalogohoy.com/r/plan/:slug → redirige al panel de planes del catálogo.
// El botón del template de WhatsApp `payment_failed` apunta acá (base fija
// catalogohoy.com/r/plan/{{1}}). Meta APPENDEA el parámetro a la base que
// incluye el literal "{{1}}", así que el slug puede llegar como
// "{{1}}mi-tienda": tomamos el tramo final con forma de slug.

const PlanRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const clean =
      (slug ?? "").match(/[a-z0-9][a-z0-9-]*$/i)?.[0]?.toLowerCase() ?? "";
    if (!clean) {
      setError(true);
      return;
    }
    window.location.replace(`https://${clean}.catalogohoy.com/admin/plans`);
  }, [slug]);

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
          <p className="text-muted-foreground">Abriendo tu panel de planes…</p>
        </>
      )}
    </div>
  );
};

export default PlanRedirect;
