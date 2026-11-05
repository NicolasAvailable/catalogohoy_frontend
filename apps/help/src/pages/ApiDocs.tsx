import { useState, type ReactNode } from "react";
import { Check, Copy, KeyRound, Bot, Shield, Gauge, Code2, Wrench, AlertTriangle, Image } from "lucide-react";
import { Layout } from "@/components/help/Layout";
import { Seo } from "@/lib/seo";

/**
 * Documentación pública de la API y el servidor MCP de Catálogo Hoy
 * (help.catalogohoy.com/api). Fuente técnica: supabase/functions/public-api.
 * Mantener al día con index.ts (scopes, herramientas, límites).
 */

const BASE = "https://api.catalogohoy.com/functions/v1/public-api";

const SECTIONS = [
  { id: "inicio", label: "Inicio rápido" },
  { id: "token", label: "Token de acceso" },
  { id: "permisos", label: "Permisos" },
  { id: "mcp", label: "Conectar un agente (MCP)" },
  { id: "rest", label: "API REST" },
  { id: "herramientas", label: "Herramientas" },
  { id: "archivos", label: "Fotos y archivos" },
  { id: "limites", label: "Límites y registro" },
  { id: "errores", label: "Errores" },
  { id: "seguridad", label: "Seguridad" },
];

const SCOPES: [string, string][] = [
  ["products:read", "Ver productos y categorías"],
  ["products:write", "Crear, editar y borrar productos; precios en lote; crear categorías"],
  ["orders:read", "Ver órdenes, estados y métricas de ventas"],
  ["orders:write", "Crear, editar, cambiar estado y borrar órdenes; estados propios"],
  ["customers:read", "Ver clientes"],
  ["settings:read", "Ver la configuración de la tienda y la tasa de cambio"],
  ["settings:write", "Cambiar configuración, horario, pagos, envíos, WhatsApp y tasa de cambio"],
  ["expenses:read", "Ver gastos y facturas de proveedores"],
  ["expenses:write", "Registrar, editar y borrar gastos"],
];

const TOOLS: { group: string; scope: string; items: [string, string][] }[] = [
  {
    group: "Productos y categorías",
    scope: "products",
    items: [
      ["list_products", "Busca y filtra productos (texto, categoría, con/sin foto, stock, precio, ocultos, en oferta). Paginado."],
      ["get_product", "Detalle completo de uno o varios productos por id."],
      ["create_product", "Crea un producto con precio, stock, tallas, variantes, categorías y fotos (photo_urls)."],
      ["update_product", "Edita solo los campos enviados. Agrega o reemplaza fotos."],
      ["bulk_edit_products", "Cambios en lote (ocultar, categoría, stock, descripción…) sobre muchos productos a la vez."],
      ["adjust_prices", "Sube o baja precios por porcentaje o monto, por filtro o categoría."],
      ["delete_product", "Elimina un producto."],
      ["list_categories", "Lista las categorías de la tienda."],
      ["create_category", "Crea una categoría."],
    ],
  },
  {
    group: "Órdenes y métricas",
    scope: "orders",
    items: [
      ["list_orders", "Lista órdenes por estado, días, búsqueda o producto."],
      ["get_order", "Detalle de una orden por número o id."],
      ["create_order", "Registra una venta manual. Mueve el stock igual que el panel."],
      ["update_order", "Edita productos, cliente, envío o pago de una orden."],
      ["set_order_status", "Cambia el estado (pending, completed, credit, cancelled o un estado propio)."],
      ["list_order_statuses", "Estados disponibles, incluidos los propios del tablero."],
      ["manage_order_status", "Crea, renombra o borra estados propios."],
      ["delete_order", "Elimina una orden."],
      ["get_metrics", "Ventas, órdenes, ticket promedio y productos más vendidos por período."],
    ],
  },
  {
    group: "Clientes",
    scope: "customers",
    items: [["list_customers", "Busca clientes por nombre o teléfono, con sus compras."]],
  },
  {
    group: "Configuración de la tienda",
    scope: "settings",
    items: [
      ["get_store_settings", "Toda la configuración: datos, horario, pagos, envíos, WhatsApp, redes, moneda."],
      ["update_store_settings", "Nombre, descripción, logo_url, banner_url, color, moneda, aceptar pedidos, redes…"],
      ["set_business_hours", "Horario por día o 24 horas."],
      ["set_whatsapp_sellers", "Vendedores de WhatsApp del catálogo (máx. 3)."],
      ["set_order_notifications", "Avisos de WhatsApp de pedidos nuevos y completados."],
      ["manage_payment_method", "Crea, edita o elimina métodos de pago (con descuento o recargo)."],
      ["manage_shipping_method", "Crea, edita o elimina métodos de envío."],
      ["get_exchange_rate", "Tasa de cambio que usa la tienda y la BCV del día (Venezuela)."],
      ["set_exchange_rate", "Cambia la tasa (BCV dólar, BCV euro o propia)."],
    ],
  },
  {
    group: "Gastos y facturas",
    scope: "expenses",
    items: [
      ["list_expenses", "Gastos por mes, estado o proveedor, con totales por moneda."],
      ["create_expense", "Registra un gasto o factura, con archivos adjuntos (attachment_urls)."],
      ["update_expense", "Edita, marca como pagada o registra abonos."],
      ["delete_expense", "Elimina un gasto."],
    ],
  },
];

const ERRORS: [string, string, string][] = [
  ["400", "invalid_json · invalid_arguments · invalid_file", "El body o un archivo no es válido."],
  ["401", "unauthorized · invalid_token · token_expired", "Falta el token, no existe, fue revocado o venció."],
  ["403", "missing_scope", "El token no tiene ese permiso."],
  ["404", "not_found · unknown_tool", "La ruta o la herramienta no existe."],
  ["422", "tool_error", "La acción no se pudo hacer (ej. producto no encontrado, límite del plan)."],
  ["429", "rate_limited", "Demasiadas llamadas. Reintenta después del header Retry-After."],
  ["500", "internal_error", "Error de Catálogo Hoy."],
];

const MCP_CONFIG = `{
  "mcpServers": {
    "catalogohoy": {
      "type": "http",
      "url": "${BASE}/mcp",
      "headers": { "Authorization": "Bearer cht_TU_TOKEN" }
    }
  }
}`;

const CURL_ME = `curl ${BASE}/v1/me \\
  -H "Authorization: Bearer $TOKEN"`;

const CURL_LIST = `curl "${BASE}/v1/products?has_photos=false&limit=20" \\
  -H "Authorization: Bearer $TOKEN"`;

const CURL_CREATE = `curl -X POST ${BASE}/v1/tools/create_product \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Zapato rojo",
    "price": 25,
    "stock": 10,
    "photo_urls": ["https://ejemplo.com/zapato.jpg"]
  }'`;

const CURL_STATUS = `curl -X POST ${BASE}/v1/tools/set_order_status \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "order_number": 120, "status": "completed" }'`;

const RESPONSE_OK = `{
  "data": {
    "created": true,
    "product": { "id": 4821, "name": "Zapato rojo", "price": 25, "stock": 10, "photos": 1 }
  }
}`;

const RESPONSE_ERR = `{
  "error": { "code": "missing_scope", "message": "El token no tiene el permiso products:write." }
}`;

const MCP_CALL = `POST ${BASE}/mcp
Authorization: Bearer cht_TU_TOKEN
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": { "name": "list_orders", "arguments": { "status": "pending" } }
}`;

const CodeBlock = ({ code, label }: { code: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* el navegador no dejó copiar */
    }
  };
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-medium text-slate-400">{label ?? ""}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const Section = ({ id, icon, title, children }: { id: string; icon: ReactNode; title: string; children: ReactNode }) => (
  <section id={id} className="scroll-mt-24 border-t border-border/70 pt-10 mt-10 first:mt-0 first:border-0 first:pt-0">
    <h2 className="flex items-center gap-2 font-display text-xl sm:text-2xl font-extrabold text-foreground">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      {title}
    </h2>
    <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-foreground/85">{children}</div>
  </section>
);

const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-medium text-foreground break-words">{children}</code>
);

const ApiDocs = () => (
  <Layout>
    <Seo
      title="API y MCP para desarrolladores"
      description="Conecta tu software o tus agentes de IA a Catálogo Hoy: productos, órdenes, clientes, configuración y gastos con un token de acceso por tienda."
      path="/api"
      type="article"
    />
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        {/* Índice */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">En esta página</p>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Code2 className="h-3.5 w-3.5" /> Para desarrolladores
          </span>
          <h1 className="mt-4 font-display text-3xl sm:text-4xl font-extrabold text-foreground">API y MCP de Catálogo Hoy</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Conecta tu software o tus agentes de IA a una tienda de Catálogo Hoy para gestionar productos, órdenes, clientes,
            configuración y gastos. Cada tienda da su propio token y decide qué se puede hacer con él.
          </p>

          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL base</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">{BASE}</p>
          </div>

          <div className="mt-10">
            <Section id="inicio" icon={<Bot className="h-4 w-4" />} title="Inicio rápido">
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  El dueño de la tienda entra a su panel, va a <strong>Perfil → API</strong> y pulsa <strong>Crear token</strong>.
                </li>
                <li>Elige qué puede hacer el token (por ejemplo, productos y órdenes) y lo copia. Se muestra una sola vez.</li>
                <li>
                  Tú lo usas en el header <C>Authorization: Bearer cht_…</C>, ya sea desde un agente de IA (MCP) o con llamadas REST.
                </li>
              </ol>
              <CodeBlock label="Probar el token" code={CURL_ME} />
            </Section>

            <Section id="token" icon={<KeyRound className="h-4 w-4" />} title="Token de acceso">
              <p>
                Los tokens empiezan con <C>cht_</C> y dan acceso a <strong>una sola tienda</strong>. No hace falta mandar ningún
                id de tienda: sale del token.
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Se envía en <C>Authorization: Bearer cht_…</C> (también se acepta el header <C>X-API-Key</C>).</li>
                <li>El dueño lo puede revocar en cualquier momento, y puede ponerle fecha de vencimiento.</li>
                <li>Deja de funcionar si quien lo creó deja de ser dueño o administrador de la tienda.</li>
                <li>Guárdalo como un secreto: no lo pongas en código del navegador ni en repositorios públicos.</li>
              </ul>
            </Section>

            <Section id="permisos" icon={<Shield className="h-4 w-4" />} title="Permisos (scopes)">
              <p>El dueño elige los permisos al crear el token. Una llamada fuera de ellos responde <C>403 missing_scope</C>.</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Scope</th>
                      <th className="px-4 py-2.5 font-semibold">Permite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCOPES.map(([s, d]) => (
                      <tr key={s} className="border-t border-border">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px]">{s}</td>
                        <td className="px-4 py-2.5">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="mcp" icon={<Bot className="h-4 w-4" />} title="Conectar un agente de IA (MCP)">
              <p>
                La API también es un servidor <strong>MCP</strong> (Model Context Protocol, transporte Streamable HTTP). Un agente
                compatible ve solo las herramientas que su token permite y las usa directamente.
              </p>
              <CodeBlock label="Configuración del cliente MCP" code={MCP_CONFIG} />
              <p>
                Métodos soportados: <C>initialize</C>, <C>tools/list</C>, <C>tools/call</C> y <C>ping</C>. Ejemplo de llamada directa:
              </p>
              <CodeBlock label="tools/call" code={MCP_CALL} />
            </Section>

            <Section id="rest" icon={<Code2 className="h-4 w-4" />} title="API REST">
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Ruta</th>
                      <th className="px-4 py-2.5 font-semibold">Qué hace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["GET /v1/me", "Tienda y permisos del token"],
                      ["GET /v1/tools", "Herramientas permitidas, con su JSON Schema"],
                      ["POST /v1/tools/{nombre}", "Ejecuta una herramienta. El body son sus argumentos en JSON"],
                      ["GET /v1/products", "Lista productos (filtros por query: search, category_id, has_photos, limit, offset…)"],
                      ["GET /v1/products/{id}", "Detalle de un producto"],
                      ["GET /v1/orders", "Lista órdenes (status, days, search, limit…)"],
                      ["GET /v1/orders/{número}", "Detalle de una orden"],
                      ["GET /v1/categories", "Lista categorías"],
                      ["GET /v1/customers", "Lista clientes"],
                      ["GET /v1/store", "Configuración de la tienda"],
                    ].map(([r, d]) => (
                      <tr key={r} className="border-t border-border">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px]">{r}</td>
                        <td className="px-4 py-2.5">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Las respuestas correctas vienen en <C>{"{ \"data\": … }"}</C> y los errores en <C>{"{ \"error\": { code, message } }"}</C>.
              </p>
              <CodeBlock label="Productos sin foto" code={CURL_LIST} />
              <CodeBlock label="Crear un producto con foto" code={CURL_CREATE} />
              <CodeBlock label="Respuesta" code={RESPONSE_OK} />
              <CodeBlock label="Marcar la orden #120 como pagada" code={CURL_STATUS} />
            </Section>

            <Section id="herramientas" icon={<Wrench className="h-4 w-4" />} title="Herramientas">
              <p>
                Son las mismas acciones que usa el asistente de WhatsApp de Catálogo Hoy, con las mismas reglas del panel. Los
                argumentos exactos de cada una están en <C>GET /v1/tools</C> o en <C>tools/list</C>.
              </p>
              {TOOLS.map((g) => (
                <div key={g.group} className="rounded-xl border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                    <h3 className="font-semibold text-foreground">{g.group}</h3>
                    <span className="font-mono text-xs text-muted-foreground">
                      {g.scope}:read{g.scope === "customers" ? "" : ` · ${g.scope}:write`}
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {g.items.map(([n, d]) => (
                      <li key={n} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:gap-4">
                        <span className="shrink-0 font-mono text-[13px] font-medium text-foreground sm:w-52">{n}</span>
                        <span className="text-sm text-muted-foreground">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Section>

            <Section id="archivos" icon={<Image className="h-4 w-4" />} title="Fotos y archivos">
              <p>
                Las imágenes y archivos se mandan como URLs públicas <C>https</C> en <C>photo_urls</C>, <C>logo_url</C>,{" "}
                <C>banner_url</C> o <C>attachment_urls</C>. Catálogo Hoy los descarga y los guarda en su propio CDN.
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Formatos: JPG, PNG o WEBP (y PDF en gastos).</li>
                <li>Máximo 10 MB por archivo y 20 archivos por llamada.</li>
              </ul>
            </Section>

            <Section id="limites" icon={<Gauge className="h-4 w-4" />} title="Límites y registro">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Hasta <strong>120 llamadas por minuto</strong> por token. Si te pasas, responde <C>429</C> con el header{" "}
                  <C>Retry-After</C>.
                </li>
                <li>Aplican los límites del plan de la tienda (productos, variantes, órdenes), igual que en el panel.</li>
                <li>Cada llamada queda registrada y el dueño la ve en Perfil → API → Actividad reciente.</li>
              </ul>
            </Section>

            <Section id="errores" icon={<AlertTriangle className="h-4 w-4" />} title="Errores">
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">HTTP</th>
                      <th className="px-4 py-2.5 font-semibold">code</th>
                      <th className="px-4 py-2.5 font-semibold">Significado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ERRORS.map(([h, c, d]) => (
                      <tr key={h} className="border-t border-border align-top">
                        <td className="px-4 py-2.5 font-mono text-[13px]">{h}</td>
                        <td className="px-4 py-2.5 font-mono text-[13px]">{c}</td>
                        <td className="px-4 py-2.5">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CodeBlock label="Ejemplo de error" code={RESPONSE_ERR} />
            </Section>

            <Section id="seguridad" icon={<Shield className="h-4 w-4" />} title="Seguridad">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Catálogo Hoy nunca guarda el token, solo una huella cifrada (hash). Si se pierde, se revoca y se crea otro.</li>
                <li>Un token solo puede ver y cambiar su propia tienda. Nunca accede a otras tiendas.</li>
                <li>Cada tienda decide los permisos y puede cortar el acceso al instante.</li>
                <li>Pide confirmación a la persona antes de borrar productos, órdenes o gastos.</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                ¿Dudas o quieres una integración especial? Escríbenos a{" "}
                <a className="font-semibold text-primary hover:underline" href="https://wa.me/584220240947" target="_blank" rel="noopener noreferrer">
                  soporte por WhatsApp
                </a>
                .
              </p>
            </Section>
          </div>
        </article>
      </div>
    </div>
  </Layout>
);

export default ApiDocs;
