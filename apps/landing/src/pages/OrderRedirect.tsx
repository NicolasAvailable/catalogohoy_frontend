import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// catalogohoy.com/o/:orderId → resuelve el tenant de la orden y redirige al
// admin del catálogo. El botón "Ver pedido" de las notificaciones WhatsApp
// apunta acá (base fija catalogohoy.com; el slug lo resuelve el RPC).
//
// La tabla `orders` tiene RLS, por eso usamos el RPC SECURITY DEFINER
// `get_order_redirect_slug`, que sólo devuelve el slug (dato público).

const SUPABASE_URL = "https://yvkurjivijnhliofmfmj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs";

const OrderRedirect = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      // Los botones URL dinámicos de Meta APPENDEAN el parámetro a la base del
      // template (que incluye "{{1}}"), así que el id puede llegar como
      // "{{1}}730". Tomamos los dígitos finales para obtener el id real.
      const id = (orderId ?? "").match(/\d+$/)?.[0] ?? "";
      if (!id) {
        setError(true);
        return;
      }
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_order_redirect_slug`,
          {
            method: "POST",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ p_order_id: Number(id) }),
          }
        );
        const slug = await res.json();
        if (cancelled) return;
        if (res.ok && typeof slug === "string" && slug) {
          window.location.replace(
            `https://${slug}.catalogohoy.com/admin/orders?order=${id}`
          );
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <h1 className="text-xl font-semibold">No encontramos ese pedido</h1>
          <p className="text-muted-foreground">
            Es posible que el enlace haya expirado o sea incorrecto.{" "}
            <a href="https://catalogohoy.com" className="underline">
              Ir al inicio
            </a>
          </p>
        </>
      ) : (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-foreground" />
          <p className="text-muted-foreground">Abriendo tu pedido…</p>
        </>
      )}
    </div>
  );
};

export default OrderRedirect;
