import { useEffect } from "react";

const BASE_URL = "https://catalogohoy.com";
const JSON_LD_ID = "page-jsonld";

interface PageMeta {
  title: string;
  description: string;
  /** Ruta canónica de la página, ej. "/precios". */
  path: string;
  /** Ruta de la og:image propia de la página (en /public), ej. "/blog/og/x.jpg". */
  image?: string;
  /**
   * Datos estructurados de la página. Definirlo a nivel de módulo (no inline
   * en el render) para que la referencia sea estable entre renders.
   */
  jsonLd?: object | object[];
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * SEO por página en una SPA: título, description, canonical, Open Graph y
 * JSON-LD. El index.html solo trae los defaults de la home; cada página los
 * pisa al montarse (Google renderiza JS, así que estos tags son los que
 * termina indexando). Sin canonical dinámico, todas las rutas se atribuirían
 * a la home.
 */
export function usePageMeta({ title, description, path, image, jsonLd }: PageMeta) {
  useEffect(() => {
    const url = BASE_URL + (path === "/" ? "/" : path);

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    if (image) {
      upsertMeta("property", "og:image", BASE_URL + image);
      upsertMeta("name", "twitter:image", BASE_URL + image);
    }

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);

    document.getElementById(JSON_LD_ID)?.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = JSON_LD_ID;
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById(JSON_LD_ID)?.remove();
    };
  }, [title, description, path, image, jsonLd]);

  // Al navegar entre páginas la SPA conserva el scroll (ej. venir desde el
  // footer dejaría la página nueva scrolleada al fondo). Con hash no se toca:
  // el navegador está saltando a un ancla.
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, []);
}
