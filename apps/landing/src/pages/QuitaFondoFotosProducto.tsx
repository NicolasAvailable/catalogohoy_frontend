import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import BgRemoverTool from "@/components/tools/BgRemoverTool";
import { usePageMeta } from "@/hooks/use-page-meta";

const PATH = "/quita-fondo-de-fotos-de-producto";
const URL = "https://catalogohoy.com" + PATH;

const FAQS = [
  {
    q: "¿Cómo quito el fondo de la foto de un producto gratis?",
    a: "Sube la foto en esta página y nuestra IA quita el fondo en segundos, dejándolo transparente. Luego la descargas en PNG (fondo transparente) o con fondo blanco. Es gratis y no necesitas crear una cuenta para probarlo.",
  },
  {
    q: "¿La herramienta para quitar el fondo es realmente gratis?",
    a: "Sí. Puedes quitar el fondo de varias fotos por día sin pagar ni registrarte. Si necesitas hacerlo sin límite y además armar tu catálogo con esas fotos, creas una cuenta gratis en CatalogoHoy.",
  },
  {
    q: "¿Puedo poner fondo blanco a mi foto de producto?",
    a: "Sí. Después de quitar el fondo puedes descargar la imagen con fondo blanco con un clic. El fondo blanco es el que piden la mayoría de marketplaces (como Amazon o Mercado Libre) y hace que tu catálogo se vea prolijo y uniforme.",
  },
  {
    q: "¿Qué formatos de imagen puedo usar?",
    a: "Puedes subir fotos en JPG, PNG o WEBP de hasta 10 MB. El resultado se entrega en PNG con transparencia, o en JPG con fondo blanco si eliges esa opción.",
  },
  {
    q: "¿La calidad de la foto se pierde al quitar el fondo?",
    a: "No. La IA recorta el producto respetando la resolución original: no reduce ni comprime la imagen. Obtienes un recorte limpio en los bordes, listo para tu catálogo o tus redes.",
  },
  {
    q: "¿Para qué sirve quitar el fondo de las fotos de productos?",
    a: "Un fondo limpio hace que el producto resalte y que todo tu catálogo se vea profesional y uniforme. Sirve para vender en marketplaces, catálogos online, tiendas, publicaciones de Instagram y Facebook, y anuncios.",
  },
  {
    q: "¿Mis imágenes quedan guardadas o son privadas?",
    a: "Procesamos la imagen solo para devolverte el resultado. No publicamos tus fotos ni las usamos para otra cosa. Si creas tu catálogo, tus imágenes quedan en tu cuenta, bajo tu control.",
  },
];

// JSON-LD a nivel de módulo (referencia estable, como pide usePageMeta).
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Quita-fondo de fotos de producto — CatalogoHoy",
    url: URL,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript. Funciona en cualquier navegador.",
    description:
      "Herramienta gratuita para quitar el fondo de fotos de productos con IA y dejarlo transparente o blanco, lista para tu catálogo, marketplaces y redes.",
    inLanguage: "es",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Quitar el fondo de fotos de productos con IA",
      "Fondo transparente (PNG)",
      "Fondo blanco (JPG)",
      "Sin registro para probar",
    ],
    provider: {
      "@type": "Organization",
      name: "CatalogoHoy",
      url: "https://catalogohoy.com",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cómo quitar el fondo de la foto de un producto",
    description:
      "Quita el fondo de la foto de tu producto gratis con IA en 3 pasos: sube la imagen, la IA la recorta y descargas el resultado.",
    totalTime: "PT1M",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Sube tu foto",
        text: "Arrastra o selecciona la foto del producto (JPG, PNG o WEBP, hasta 10 MB). No necesitas crear una cuenta.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "La IA quita el fondo",
        text: "En segundos, la IA recorta el producto y deja el fondo transparente, respetando la resolución original.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Descarga el resultado",
        text: "Descarga la imagen en PNG con fondo transparente o en JPG con fondo blanco, lista para tu catálogo, marketplace o redes.",
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: "https://catalogohoy.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Quita-fondo de fotos de producto",
        item: URL,
      },
    ],
  },
];

const STEPS = [
  {
    n: "1",
    title: "Sube tu foto",
    text: "Arrastra o elige la foto de tu producto (JPG, PNG o WEBP). Sin crear cuenta.",
  },
  {
    n: "2",
    title: "La IA quita el fondo",
    text: "En segundos recorta el producto y deja el fondo transparente, sin perder calidad.",
  },
  {
    n: "3",
    title: "Descarga y usa",
    text: "Bájala en PNG transparente o con fondo blanco, lista para tu catálogo o tus redes.",
  },
];

const USES = [
  {
    title: "Catálogos que se ven profesionales",
    text: "Todas tus fotos con el mismo fondo limpio: tu catálogo se ve prolijo y ordenado, no un collage de fotos dispares.",
  },
  {
    title: "Fondo blanco para marketplaces",
    text: "Amazon, Mercado Libre y la mayoría de tiendas piden fondo blanco. Descárgalo con un clic y cumple el requisito.",
  },
  {
    title: "Publicaciones que resaltan",
    text: "El producto recortado luce mejor en Instagram, Facebook y TikTok, y en tus anuncios: capta más la atención.",
  },
  {
    title: "Menos tiempo editando",
    text: "Lo que en Photoshop toma minutos, acá es automático. Procesas tus fotos y vuelves a vender.",
  },
];

const NICHES = [
  "tiendas de ropa",
  "zapaterías",
  "cosméticos y belleza",
  "accesorios y joyería",
  "tecnología y repuestos",
  "productos por catálogo",
];

const QuitaFondoFotosProducto = () => {
  usePageMeta({
    title:
      "Quitar el fondo de fotos de producto gratis con IA | CatalogoHoy",
    description:
      "Quita el fondo de las fotos de tus productos gratis y con IA. Deja el fondo transparente o blanco en segundos, sin registro, listo para tu catálogo, marketplaces y redes.",
    path: PATH,
    image: "/og/quita-fondo.jpg",
    jsonLd: JSON_LD,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Hero + herramienta */}
        <section className="pt-28 pb-10 md:pt-36">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-foreground leading-tight">
              Quita el fondo de tus fotos de producto gratis
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Sube una foto y la IA le quita el fondo en segundos: transparente
              o blanco, sin perder calidad. Gratis, sin registro, listo para tu
              catálogo, los marketplaces y tus redes.
            </p>
          </div>
          <div className="container mx-auto px-4 max-w-2xl mt-8">
            <BgRemoverTool />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              100% gratis para probar · tus fotos son privadas · sin marcas de agua
            </p>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Cómo quitar el fondo de una foto en 3 pasos
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="flex flex-col items-center text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <h3 className="mt-3 font-semibold text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {s.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Qué es / por qué importa */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Por qué quitarle el fondo a las fotos de tus productos
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              La foto es lo primero que decide si alguien se interesa por tu
              producto. Un fondo desordenado —la mesa de tu casa, otro producto
              atrás, sombras— distrae y le resta valor a lo que vendes. Con un{" "}
              <strong>fondo limpio</strong> el producto resalta, y cuando{" "}
              <strong>todas tus fotos comparten el mismo fondo</strong> tu
              catálogo se ve profesional y uniforme, como el de una tienda
              grande.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Antes esto requería Photoshop o pagar a un diseñador. Hoy la IA lo
              hace sola en segundos: recorta el producto, deja el fondo
              transparente y, si lo necesitas, lo pone en blanco —el formato que
              piden los marketplaces—. Es la forma más rápida de tener fotos
              listas para vender.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Cuando tengas tus fotos limpias, el siguiente paso es publicarlas:
              con un{" "}
              <Link to="/catalogo-digital" className="text-primary hover:underline">
                catálogo digital
              </Link>{" "}
              las muestras con precio y las compartes por un enlace, y con un{" "}
              <Link
                to="/catalogo-por-whatsapp"
                className="text-primary hover:underline"
              >
                catálogo por WhatsApp
              </Link>{" "}
              recibes los pedidos directo en tu chat.
            </p>
          </div>
        </section>

        {/* Usos */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Para qué te sirve
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {USES.map((u) => (
                <div
                  key={u.title}
                  className="rounded-xl border border-border bg-background p-6"
                >
                  <h3 className="font-semibold text-foreground">{u.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {u.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Nichos / internal linking */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Ideal para cualquier negocio con productos
            </h2>
            <p className="mt-4 text-muted-foreground">
              Si vendes productos con foto, un fondo limpio te hace ver más
              profesional. Algunos que lo usan a diario:
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-3">
              {NICHES.map((n) => (
                <li
                  key={n}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
                >
                  {n}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              ¿Listo para vender con esas fotos?{" "}
              <Link
                to="/crear-catalogo-online-gratis"
                className="text-primary hover:underline"
              >
                Crea tu catálogo online gratis
              </Link>
              .
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Preguntas frecuentes
            </h2>
            <div className="mt-8 space-y-6">
              {FAQS.map((f) => (
                <div
                  key={f.q}
                  className="rounded-xl border border-border bg-background p-6"
                >
                  <h3 className="font-semibold text-foreground">{f.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default QuitaFondoFotosProducto;
