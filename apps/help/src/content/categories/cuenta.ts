import type { Category } from "../types";

export const cuenta: Category = {
  slug: "cuenta",
  title: "Cuenta y planes",
  description:
    "Administra tu plan y sus límites, crea catálogos adicionales, vincula un dominio personalizado y gestiona tu perfil, notificaciones e historial de pagos.",
  icon: "UserCog",
  articles: [
    {
      slug: "planes-y-limites",
      title: "Planes y límites",
      description:
        "Conoce el plan gratuito y los planes de pago, y qué incluye cada límite de productos, catálogos y equipo.",
      related: ["mejorar-tu-plan", "crear-varios-catalogos", "dominio-personalizado"],
      blocks: [
        {
          type: "paragraph",
          text: "Catálogo Hoy tiene un plan **gratuito** y planes de pago que se adaptan a medida que tu negocio crece. Cada plan define cuántos productos y catálogos puedes tener, además de las funciones disponibles.",
        },
        {
          type: "heading",
          text: "Qué define tu plan",
        },
        {
          type: "list",
          items: [
            "**Productos:** la cantidad máxima de productos que puedes cargar en tu catálogo. Algunos planes de pago incluyen productos **ilimitados**.",
            "**Catálogos:** cuántos catálogos puedes administrar con tu cuenta. El plan gratuito incluye `1 catálogo`.",
            "**Equipo de trabajo:** según el plan, puedes invitar miembros para que te ayuden a gestionar el catálogo.",
            "**Reportes:** la cantidad de reportes que puedes generar por mes.",
            "**Funciones:** módulos disponibles, analíticas, diseño personalizable y el nivel de soporte (prioritario o dedicado).",
          ],
        },
        {
          type: "heading",
          text: "Los planes",
        },
        {
          type: "list",
          items: [
            "**Gratis:** `1 catálogo`, edición limitada y `1 reporte por mes`. Ideal para empezar.",
            "**Básico:** `1 catálogo` con todos los módulos disponibles, analíticas, diseño personalizable, más reportes por mes y soporte prioritario.",
            "**Avanzado:** hasta `2 catálogos`, productos ilimitados, más reportes, **dominio personalizado** y soporte dedicado.",
          ],
        },
        {
          type: "note",
          variant: "info",
          text: "Puedes ver el detalle de cada plan, sus precios y el período de facturación desde la pantalla de **Planes** en tu cuenta.",
        },
        {
          type: "image",
          src: "/screenshots/cuenta/planes.png",
          alt: "Pantalla de planes con sus límites y funciones",
        },
      ],
    },
    {
      slug: "mejorar-tu-plan",
      title: "Mejorar tu plan",
      description:
        "Sube a un plan de pago para tener más productos, catálogos y funciones, en cualquier momento.",
      related: ["planes-y-limites", "facturacion-e-historial", "crear-varios-catalogos"],
      blocks: [
        {
          type: "paragraph",
          text: "Cuando tu negocio crece o llegas al límite de tu plan, puedes **mejorar tu plan** en cualquier momento para desbloquear más productos, catálogos y funciones.",
        },
        {
          type: "steps",
          items: [
            { text: "Entra a la pantalla de **Planes** desde tu cuenta." },
            { text: "Elige el **período de facturación** (por ejemplo mensual o anual) para ver el precio correspondiente." },
            { text: "En el plan que quieras, presiona **Mejorar plan**." },
            { text: "Completa el pago para activar el nuevo plan." },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "Si ya tienes un plan de pago y subes a uno superior, solo pagas la **diferencia prorrateada** hasta el final de tu período actual. A partir de tu próxima renovación se aplica el precio completo del nuevo plan.",
        },
        {
          type: "paragraph",
          text: "Si intentas crear un producto o catálogo y alcanzaste el límite, verás un aviso que te invita a mejorar tu plan para continuar.",
        },
      ],
    },
    {
      slug: "crear-varios-catalogos",
      title: "Crear y administrar varios catálogos",
      description:
        "Maneja más de un catálogo desde la misma cuenta y suma catálogos adicionales cuando los necesites.",
      related: ["planes-y-limites", "mejorar-tu-plan"],
      blocks: [
        {
          type: "paragraph",
          text: "Cada cuenta puede administrar varios catálogos según su plan. Los planes **Gratis** y **Básico** incluyen `1 catálogo`, mientras que el plan **Avanzado** incluye `2 catálogos`.",
        },
        {
          type: "heading",
          text: "Catálogos adicionales",
        },
        {
          type: "paragraph",
          text: "Si necesitas más catálogos de los que incluye tu plan, puedes sumar **catálogos adicionales** como complemento. Estos cupos extra se asocian a tu cuenta, así que puedes usarlos sin importar en cuál catálogo estés trabajando.",
        },
        {
          type: "note",
          variant: "info",
          text: "Solo los catálogos que tú creas como **propietario** consumen los cupos de tu plan. Si te invitan como miembro al catálogo de otra persona, ese catálogo no descuenta de tu límite.",
        },
        {
          type: "image",
          src: "/screenshots/cuenta/varios-catalogos.png",
          alt: "Selector de catálogos de la cuenta",
        },
      ],
    },
    {
      slug: "dominio-personalizado",
      title: "Dominio personalizado",
      description:
        "Vincula tu propio dominio para que tu catálogo se vea con la dirección de tu marca.",
      related: ["planes-y-limites", "mejorar-tu-plan"],
      blocks: [
        {
          type: "paragraph",
          text: "Con el plan **Avanzado** puedes vincular un **dominio personalizado** para que tu catálogo se muestre con la dirección de tu propia marca en lugar de la dirección estándar de Catálogo Hoy.",
        },
        {
          type: "note",
          variant: "info",
          text: "El dominio se contrata aparte: necesitas tener (o comprar) tu propio dominio para vincularlo. La vinculación está disponible a partir del plan Avanzado.",
        },
        {
          type: "list",
          items: [
            "Refuerza la imagen profesional de tu negocio.",
            "Tus clientes ven y comparten una dirección con tu marca.",
            "Mantienes el mismo catálogo y datos: solo cambia la dirección con la que se accede.",
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "Si quieres usar un dominio personalizado y aún no tienes el plan Avanzado, primero mejora tu plan y luego escríbenos al soporte para coordinar la vinculación.",
        },
      ],
    },
    {
      slug: "mi-perfil",
      title: "Mi perfil",
      description:
        "Actualiza tu nombre, tu contraseña y las notificaciones de vencimiento de tu plan.",
      related: ["facturacion-e-historial", "mejorar-tu-plan"],
      blocks: [
        {
          type: "paragraph",
          text: "Desde **Mi perfil** gestionas los datos de tu cuenta. La pantalla está organizada en pestañas para que encuentres todo rápido.",
        },
        {
          type: "list",
          items: [
            "**General:** actualiza tu **nombre** y cambia tu **contraseña**.",
            "**Suscripción:** consulta tu plan actual y tu historial de pagos.",
            "**Notificaciones:** activa o desactiva los avisos de **vencimiento de plan**.",
            "**Zona de peligro:** acciones sensibles sobre tu cuenta.",
          ],
        },
        {
          type: "heading",
          text: "Cambiar tu contraseña",
        },
        {
          type: "steps",
          items: [
            { text: "Abre **Mi perfil** y ve a la pestaña **General**." },
            { text: "Escribe tu **nueva contraseña** y vuelve a escribirla para confirmarla." },
            { text: "Guarda los cambios. Las contraseñas deben coincidir para poder guardar." },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "Activa las **notificaciones de vencimiento de plan** para recibir un aviso antes de que termine tu período de facturación y evitar quedarte sin acceso a las funciones de tu plan.",
        },
        {
          type: "image",
          src: "/screenshots/cuenta/mi-perfil.png",
          alt: "Pantalla de Mi perfil con sus pestañas",
        },
      ],
    },
    {
      slug: "facturacion-e-historial",
      title: "Facturación e historial de pagos",
      description:
        "Revisa tus pagos, su estado y descarga las facturas desde tu cuenta.",
      related: ["mi-perfil", "mejorar-tu-plan"],
      blocks: [
        {
          type: "paragraph",
          text: "En **Mi perfil**, dentro de la pestaña **Suscripción**, encuentras tu **historial de pagos** con todos los movimientos de tu cuenta ordenados del más reciente al más antiguo.",
        },
        {
          type: "heading",
          text: "Qué ves en el historial",
        },
        {
          type: "list",
          items: [
            "La **fecha** y la **descripción** de cada pago.",
            "El **monto** y el **método** de pago utilizado.",
            "El **estado** del pago: pagado, pendiente, fallido, reembolsado, entre otros.",
            "Pagos hechos con **tarjeta** y pagos **manuales** (como pago móvil o transferencia), unificados en una sola lista.",
          ],
        },
        {
          type: "heading",
          text: "Descargar una factura",
        },
        {
          type: "paragraph",
          text: "En los pagos manuales puedes descargar la **factura en PDF** directamente desde la fila del pago.",
        },
        {
          type: "note",
          variant: "info",
          text: "Solo el **propietario** de la cuenta puede ver el historial de pagos. Si te invitaron como miembro de un catálogo, no tendrás acceso a esta información.",
        },
        {
          type: "image",
          src: "/screenshots/cuenta/historial-pagos.png",
          alt: "Tabla del historial de pagos en la pestaña Suscripción",
        },
      ],
    },
  ],
};
