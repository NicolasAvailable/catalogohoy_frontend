import type { Category } from "../types";

export const categorias: Category = {
  slug: "categorias",
  title: "Categorías",
  description: "Crea, organiza y ordena categorías para que tus clientes naveguen tu catálogo con facilidad.",
  icon: "LayoutGrid",
  articles: [
    {
      slug: "crear-categoria",
      title: "Crear una categoría",
      description: "Agrupa tus productos en categorías que aparecen como filtros en tu catálogo.",
      related: ["asignar-productos-a-categorias", "ordenar-categorias"],
      blocks: [
        {
          type: "paragraph",
          text: "Las categorías agrupan tus productos para que tu catálogo sea fácil de recorrer. Tus clientes las ven como filtros en la tienda, así pueden ir directo a lo que buscan (por ejemplo **Novedades**, **Ofertas** o tipos de producto).",
        },
        { type: "heading", text: "Crear una categoría" },
        {
          type: "steps",
          items: [
            {
              text: "En el panel de administración, abre **Productos → Categorías**.",
              image: "/screenshots/categorias/menu-categorias.png",
              imageAlt: "Menú Productos con la opción Categorías",
            },
            {
              text: "Haz clic en **Crear categoría**, arriba a la derecha.",
              image: "/screenshots/categorias/crear-categoria.png",
              imageAlt: "Botón Crear categoría en la lista",
            },
            {
              text: "Escribe el **Nombre de la categoría** en la fila que aparece y confirma con el botón de check (o presiona Enter).",
              image: "/screenshots/categorias/nombre-categoria.png",
              imageAlt: "Fila para escribir el nombre de la nueva categoría",
            },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "También puedes crear una categoría sobre la marcha desde la ficha de un producto, sin salir de la pantalla de edición. Lo vemos en el artículo de asignar productos.",
        },
        {
          type: "paragraph",
          text: "Si quieres agregar una descripción o controlar dónde aparece, edita la categoría después de crearla. Lo explicamos en los siguientes artículos.",
        },
      ],
    },
    {
      slug: "asignar-productos-a-categorias",
      title: "Asignar productos a categorías",
      description: "Conecta cada producto con una o varias categorías desde su ficha.",
      related: ["crear-categoria", "ocultar-categoria"],
      blocks: [
        {
          type: "paragraph",
          text: "Un producto puede pertenecer a varias categorías a la vez. La asignación se hace desde la ficha del producto, no desde la pantalla de categorías.",
        },
        {
          type: "steps",
          items: [
            {
              text: "Abre **Productos → Listado de productos** y entra a editar el producto que quieras (o créalo nuevo).",
              image: "/screenshots/categorias/editar-producto.png",
              imageAlt: "Listado de productos en el panel",
            },
            {
              text: "Baja hasta la sección **Categorías** y abre el selector **Seleccionar categorías**.",
              image: "/screenshots/categorias/seleccionar-categorias.png",
              imageAlt: "Selector de categorías en la ficha del producto",
            },
            {
              text: "Marca todas las categorías que correspondan. Puedes elegir más de una.",
              image: "/screenshots/categorias/marcar-categorias.png",
              imageAlt: "Varias categorías seleccionadas para un producto",
            },
            {
              text: "Guarda el producto para aplicar los cambios.",
              image: "/screenshots/categorias/guardar-producto.png",
              imageAlt: "Botón para guardar el producto",
            },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "¿Te falta una categoría? Dentro del mismo selector tienes un campo **Crear nueva categoría...**: escribe el nombre, créala y quedará lista para marcarla sin salir de la ficha.",
        },
        {
          type: "paragraph",
          text: "Si aún no tienes ninguna categoría, el selector te lo indicará e igual podrás crear la primera desde ese campo.",
        },
      ],
    },
    {
      slug: "ordenar-categorias",
      title: "Ordenar y reordenar categorías",
      description: "Define el orden en que aparecen las categorías en tu catálogo.",
      related: ["crear-categoria", "ocultar-categoria"],
      blocks: [
        {
          type: "paragraph",
          text: "El orden de la lista de categorías es el mismo orden en que tus clientes las ven como filtros en el catálogo. Tú decides cuál va primero.",
        },
        { type: "heading", text: "Reordenar arrastrando" },
        {
          type: "steps",
          items: [
            {
              text: "Entra en **Productos → Categorías**.",
              image: "/screenshots/categorias/lista-categorias.png",
              imageAlt: "Lista de categorías ordenable",
            },
            {
              text: "Toma una categoría desde el ícono de agarre (las líneas a la izquierda) y arrástrala hacia arriba o hacia abajo hasta la posición que quieras.",
              image: "/screenshots/categorias/arrastrar-categoria.png",
              imageAlt: "Arrastrando una categoría para reordenarla",
            },
            {
              text: "Suelta. El nuevo orden se guarda automáticamente.",
            },
          ],
        },
        { type: "heading", text: "Elegir la posición desde la edición" },
        {
          type: "paragraph",
          text: "Si tienes más de una categoría, también puedes fijar su lugar exacto al editarla: en la sección **Posición en el catálogo** elige el número de posición y guarda con **Guardar cambios**.",
        },
        {
          type: "note",
          variant: "info",
          text: "El número que ves a la izquierda de cada categoría es su posición actual en la lista.",
        },
      ],
    },
    {
      slug: "ocultar-categoria",
      title: "Ocultar una categoría del catálogo",
      description: "Desactiva temporalmente una categoría sin borrarla ni perder sus productos.",
      related: ["ordenar-categorias", "eliminar-categoria"],
      blocks: [
        {
          type: "paragraph",
          text: "Ocultar una categoría la quita de los filtros de tu catálogo público, pero la mantiene intacta junto con sus productos. Es ideal para algo de temporada o que todavía estás preparando.",
        },
        { type: "heading", text: "Desde la lista (rápido)" },
        {
          type: "steps",
          items: [
            {
              text: "En **Productos → Categorías**, ubica la categoría en la lista.",
            },
            {
              text: "Haz clic en el ícono de ojo. Cuando aparece tachado, la categoría queda **oculta del catálogo**; vuelve a hacer clic para **mostrarla** de nuevo.",
              image: "/screenshots/categorias/toggle-visibilidad.png",
              imageAlt: "Botón de ojo para ocultar o mostrar una categoría",
            },
          ],
        },
        { type: "heading", text: "Desde la edición" },
        {
          type: "paragraph",
          text: "Al editar la categoría, en la sección **Visibilidad** desmarca **Mostrar esta categoría en la tienda** y guarda los cambios. El efecto es el mismo.",
        },
        {
          type: "note",
          variant: "info",
          text: "Ocultar una categoría no elimina sus productos: siguen disponibles en tu catálogo según las demás categorías que tengan.",
        },
      ],
    },
    {
      slug: "eliminar-categoria",
      title: "Eliminar una categoría",
      description: "Borra de forma definitiva una categoría que ya no necesitas.",
      related: ["ocultar-categoria"],
      blocks: [
        {
          type: "paragraph",
          text: "Si una categoría ya no te sirve, puedes eliminarla. Tus productos no se borran: solo dejan de estar asociados a esa categoría.",
        },
        {
          type: "steps",
          items: [
            {
              text: "Entra en **Productos → Categorías**.",
            },
            {
              text: "En la fila de la categoría, haz clic en el ícono de papelera.",
              image: "/screenshots/categorias/eliminar-categoria.png",
              imageAlt: "Botón de papelera para eliminar una categoría",
            },
            {
              text: "Confirma en el cuadro **Eliminar categoría** haciendo clic en **Eliminar**.",
              image: "/screenshots/categorias/confirmar-eliminar.png",
              imageAlt: "Diálogo de confirmación para eliminar la categoría",
            },
          ],
        },
        {
          type: "note",
          variant: "warning",
          text: "Eliminar una categoría es una acción irreversible. Si solo quieres dejarla de mostrar por un tiempo, mejor ocúltala en lugar de borrarla.",
        },
      ],
    },
    {
      slug: "categoria-ver-todos",
      title: "La categoría especial Ver todos",
      description: "Qué es la categoría que aparece fija en tu catálogo y por qué no se edita.",
      related: ["ordenar-categorias", "ocultar-categoria"],
      blocks: [
        {
          type: "paragraph",
          text: "Junto a tus categorías encontrarás una categoría especial llamada **Ver todos**. Está creada por el sistema y aparece en tu catálogo como un filtro que muestra todos los productos a la vez.",
        },
        {
          type: "paragraph",
          text: "Cuando un cliente hace clic en **Ver todos** en tu tienda, se limpia cualquier filtro activo y vuelve a ver el catálogo completo.",
        },
        {
          type: "note",
          variant: "info",
          text: "Como es una categoría del sistema, no se puede editar, ocultar ni eliminar: por eso sus botones de editar y borrar aparecen deshabilitados en la lista. No necesitas asignarle productos.",
        },
      ],
    },
  ],
};
