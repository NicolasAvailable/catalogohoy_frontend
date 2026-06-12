import type { Category } from "../types";

export const equipo: Category = {
  slug: "equipo",
  title: "Equipo",
  description:
    "Invita a otras personas a administrar tu catálogo y controla qué puede hacer cada una con permisos por módulo.",
  icon: "Users",
  articles: [
    {
      slug: "invitar-miembro",
      title: "Invitar a un miembro",
      description:
        "Suma colaboradores a tu catálogo enviándoles una invitación por correo.",
      related: ["aceptar-invitacion", "permisos-por-modulo", "limite-segun-plan"],
      blocks: [
        {
          type: "paragraph",
          text: "Como administrador puedes invitar a otras personas para que gestionen tu catálogo junto a ti. La invitación se envía por correo electrónico y, al aceptarla, el miembro entra a tu equipo con los permisos que tú le asignes.",
        },
        {
          type: "steps",
          items: [
            {
              text: "Abre la sección **Equipo** desde tu panel de administración.",
              image: "/screenshots/equipo/equipo-vista.png",
              imageAlt: "Vista de Equipo con la pestaña Miembros",
            },
            {
              text: "Presiona **Invitar miembro** en la parte superior derecha.",
            },
            {
              text: "Escribe el **Correo electrónico** de la persona que quieres invitar.",
              image: "/screenshots/equipo/invitar-dialogo.png",
              imageAlt: "Diálogo Invitar miembro con campo de correo y permisos",
            },
            {
              text: "En **Permisos**, marca los módulos y acciones a los que tendrá acceso (puedes editarlos luego).",
            },
            {
              text: "Presiona **Enviar invitación**. Verás el mensaje `Se enviará un email de invitación`.",
            },
          ],
        },
        {
          type: "paragraph",
          text: "El nuevo miembro aparecerá en **Invitaciones pendientes** con el estado `Invitación enviada` hasta que acepte.",
        },
        {
          type: "note",
          variant: "info",
          text: "Si tu plan es gratuito, el botón **Invitar miembro** aparece desactivado. Necesitas mejorar tu plan para sumar colaboradores.",
        },
      ],
    },
    {
      slug: "aceptar-invitacion",
      title: "Aceptar una invitación",
      description:
        "Lo que verá la persona invitada para unirse a tu equipo.",
      related: ["invitar-miembro", "permisos-por-modulo"],
      blocks: [
        {
          type: "paragraph",
          text: "Cuando invitas a alguien, esa persona recibe un correo con un enlace para unirse. Al abrirlo verá la pantalla `¡Te invitaron a un equipo!` con el nombre de tu tienda y el correo al que llegó la invitación.",
        },
        {
          type: "steps",
          items: [
            {
              text: "La persona abre el enlace de invitación que llegó a su correo.",
              image: "/screenshots/equipo/aceptar-invitacion.png",
              imageAlt: "Pantalla de aceptar invitación a un equipo",
            },
            {
              text: "Presiona **Crear cuenta y aceptar** si aún no tiene cuenta, o **Iniciar sesión y aceptar** si ya está registrada.",
            },
            {
              text: "Tras iniciar sesión o registrarse, queda dentro de tu equipo y pasa de **Invitaciones pendientes** a **Miembros activos** con la etiqueta `Miembro activo`.",
            },
          ],
        },
        {
          type: "note",
          variant: "warning",
          text: "Las invitaciones expiran. Si el enlace muestra `Invitación inválida`, vuelve a la sección **Equipo**, cancela la invitación pendiente y envía una nueva.",
        },
      ],
    },
    {
      slug: "permisos-por-modulo",
      title: "Asignar y editar permisos por módulo",
      description:
        "Define exactamente qué puede ver y hacer cada miembro de tu equipo.",
      related: ["invitar-miembro", "quitar-miembro"],
      blocks: [
        {
          type: "paragraph",
          text: "Los permisos se organizan por módulo, y dentro de cada módulo eliges las acciones permitidas. Puedes asignarlos al invitar a alguien o editarlos en cualquier momento desde su tarjeta de miembro.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En **Equipo**, dentro de **Miembros activos**, haz clic en la tarjeta del miembro o en su contador de **Permisos** para desplegar el selector.",
              image: "/screenshots/equipo/permisos-selector.png",
              imageAlt: "Selector de permisos por módulo expandido",
            },
            {
              text: "Marca un módulo completo, o expándelo para elegir acciones específicas. Usa **Seleccionar todos** para darle acceso completo.",
            },
            {
              text: "Presiona **Guardar** para aplicar los cambios, o **Cancelar** para descartarlos.",
            },
          ],
        },
        {
          type: "heading",
          text: "Módulos disponibles",
        },
        {
          type: "list",
          items: [
            "**Catálogo** — `Editar`.",
            "**Productos** — `Ver`, `Crear`, `Editar`, `Eliminar`.",
            "**Órdenes** — `Ver`, `Crear`, `Editar`, `Eliminar`.",
            "**Clientes** — `Ver`.",
            "**Analíticas** — `Ver`.",
            "**Tasas del día** — `Editar`.",
            "**Reportes** — `Ver`, `Crear`, `Eliminar`.",
            "**Equipo** — `Ver`, `Invitar`, `Editar`, `Eliminar`.",
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "Cada tarjeta muestra un contador como `3/15` con la cantidad de permisos activos. No puedes editar tus propios permisos.",
        },
      ],
    },
    {
      slug: "quitar-miembro",
      title: "Quitar a un miembro o cancelar una invitación",
      description:
        "Revoca el acceso de un colaborador o anula una invitación pendiente.",
      related: ["invitar-miembro", "permisos-por-modulo"],
      blocks: [
        {
          type: "paragraph",
          text: "Puedes retirar a un miembro activo o cancelar una invitación que aún no se acepta. El acceso se revoca de inmediato.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En **Equipo**, ubica la tarjeta del miembro o de la invitación pendiente.",
            },
            {
              text: "Presiona el botón con el ícono de cerrar (**Eliminar miembro** o **Cancelar invitación**).",
              image: "/screenshots/equipo/quitar-miembro.png",
              imageAlt: "Botón para eliminar un miembro del equipo",
            },
            {
              text: "Confirma en el diálogo **Confirmar acción** presionando **Confirmar**.",
            },
          ],
        },
        {
          type: "note",
          variant: "info",
          text: "Si quitas a alguien, esa persona verá `No tienes acceso a este catálogo` la próxima vez que intente entrar.",
        },
      ],
    },
    {
      slug: "limite-segun-plan",
      title: "Límite de miembros según tu plan",
      description:
        "Cuántas personas puedes sumar a tu equipo y qué pasa al llenar el cupo.",
      related: ["invitar-miembro"],
      blocks: [
        {
          type: "paragraph",
          text: "Cada plan incluye un máximo de miembros en el equipo. En el encabezado de **Equipo** verás tu uso actual, por ejemplo `2 de 5 miembros activos`.",
        },
        {
          type: "paragraph",
          text: "Cuando llegas al límite, el botón **Invitar miembro** se reemplaza por **Mejorar plan**. Al presionarlo te llevamos a la pantalla de planes para ampliar tu cupo.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Cancelar una invitación pendiente o quitar a un miembro libera un lugar de inmediato, así puedes invitar a alguien más sin cambiar de plan.",
        },
      ],
    },
  ],
};
