import type { Category } from "../types";

export const productos: Category = {
  slug: "productos",
  title: "Productos",
  description: "Agrega productos, fotos, precios, stock, tallas y promociones.",
  icon: "Package",
  articles: [
    {
      slug: "crear-producto",
      title: "Crear un producto",
      description: "Sube tu primer producto con foto, precio y descripción.",
      blocks: [
        {
          type: "paragraph",
          text: "Los productos son el corazón de tu catálogo. Cada producto puede tener fotos o video, precio, descripción, stock, tallas y más.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En el menú lateral entra a **Productos → Listado de productos** y toca **Crear producto**.",
              image: "/screenshots/productos/crear-1.png",
            },
            {
              text: "Sube una o varias **fotos** (o un video). La primera imagen es la que se muestra en el catálogo.",
              image: "/screenshots/productos/crear-2.png",
            },
            {
              text: "Escribe el **nombre**, el **precio** y una **descripción**. Puedes dar formato al texto con la barra de edición.",
              image: "/screenshots/productos/crear-3.png",
            },
            {
              text: "Asigna el producto a una o más **categorías** para que sea fácil de encontrar.",
            },
            {
              text: "Toca **Guardar**. El producto aparece al instante en tu catálogo.",
            },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "Usa fotos verticales y con buena luz: son las que mejor se ven en el catálogo y en móvil.",
        },
      ],
      related: ["fotos-y-video", "precio-y-promocion", "categorias-organizar"],
    },
    {
      slug: "fotos-y-video",
      title: "Fotos y video del producto",
      description: "Sube varias imágenes, reordénalas y agrega video.",
      blocks: [
        {
          type: "paragraph",
          text: "Puedes subir varias fotos por producto y también un video. El cliente las verá en un carrusel dentro del detalle del producto.",
        },
        {
          type: "steps",
          items: [
            {
              text: "Al crear o editar un producto, toca el área de **fotos** para subir desde tu dispositivo. Puedes seleccionar varias a la vez.",
              image: "/screenshots/productos/fotos-1.png",
            },
            {
              text: "**Arrastra** las imágenes para cambiar el orden. La primera es la portada.",
              image: "/screenshots/productos/fotos-2.png",
            },
          ],
        },
        {
          type: "note",
          variant: "info",
          text: "Según tu plan puede haber un límite de imágenes por producto. Revisa tu plan en Cuenta y planes.",
        },
      ],
      related: ["crear-producto"],
    },
    {
      slug: "precio-y-promocion",
      title: "Precio y precio promocional",
      description: "Define el precio y un precio de oferta tachado.",
      blocks: [
        {
          type: "paragraph",
          text: "Cada producto tiene un precio. Si quieres mostrar una oferta, agrega un precio promocional: el precio normal aparece tachado y el promocional resaltado.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En el producto, escribe el **precio** normal.",
              image: "/screenshots/productos/precio-1.png",
            },
            {
              text: "Activa **precio promocional** y escribe el valor de oferta (debe ser menor al normal).",
              image: "/screenshots/productos/precio-2.png",
            },
          ],
        },
      ],
      related: ["crear-producto"],
    },
    {
      slug: "stock-y-tallas",
      title: "Stock y tallas",
      description: "Controla el inventario y vende productos por talla.",
      blocks: [
        {
          type: "paragraph",
          text: "Puedes llevar el control de stock de tus productos. Si vendes ropa o calzado, activa las tallas para manejar inventario por cada una.",
        },
        {
          type: "heading",
          text: "Stock simple",
        },
        {
          type: "steps",
          items: [
            {
              text: "En el producto, escribe la cantidad disponible en **Stock**. Déjalo vacío si manejas stock ilimitado.",
              image: "/screenshots/productos/stock-1.png",
            },
          ],
        },
        {
          type: "heading",
          text: "Tallas",
        },
        {
          type: "steps",
          items: [
            {
              text: "Activa **Producto con tallas** y agrega cada talla con su stock (por ejemplo S, M, L).",
              image: "/screenshots/productos/tallas-1.png",
            },
            {
              text: "El cliente deberá elegir una talla disponible antes de agregar al carrito.",
            },
          ],
        },
        {
          type: "note",
          variant: "warning",
          text: "Un producto no puede tener tallas y precios por mayoreo al mismo tiempo.",
        },
      ],
      related: ["crear-producto"],
    },
    {
      slug: "ocultar-agotado-duplicar",
      title: "Ocultar, marcar agotado y duplicar",
      description: "Acciones rápidas para gestionar tus productos.",
      blocks: [
        {
          type: "paragraph",
          text: "Desde el listado de productos tienes acciones rápidas para mantener tu catálogo al día.",
        },
        {
          type: "list",
          items: [
            "Ocultar: el producto deja de mostrarse en el catálogo, pero no se elimina.",
            "Agotado: el producto se ve, pero marcado como sin stock y no se puede pedir.",
            "Duplicar: crea una copia del producto para editarla (útil para variantes parecidas).",
          ],
        },
        {
          type: "image",
          src: "/screenshots/productos/acciones.png",
          alt: "Acciones rápidas en el listado de productos",
        },
      ],
      related: ["crear-producto"],
    },
  ],
};
