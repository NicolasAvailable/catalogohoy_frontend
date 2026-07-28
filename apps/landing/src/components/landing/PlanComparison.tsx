import { Check, Minus, X } from "lucide-react";
import { motion } from "framer-motion";

/* ═══════════════════════════════════════
   DATA
   ═══════════════════════════════════════ */
type ComparisonValue = string | boolean | null; // string = texto, boolean = check/cruz, null = no aplica (–)

type ComparisonRow = {
  label: string;
  values: [ComparisonValue, ComparisonValue, ComparisonValue, ComparisonValue];
};

const planColumns = [
  { id: "gratis", name: "Gratis", price: "$0", isPopular: false },
  { id: "basico", name: "Básico", price: "$9.99/mes", isPopular: false },
  { id: "pro", name: "Pro", price: "$19.99/mes", isPopular: true },
  { id: "avanzado", name: "Avanzado", price: "$29.99/mes", isPopular: false },
] as const;

const rows: ComparisonRow[] = [
  { label: "Productos", values: ["10", "100", "500", "Ilimitados"] },
  { label: "Órdenes por mes", values: ["25", "Ilimitadas", "Ilimitadas", "Ilimitadas"] },
  { label: "Catálogos", values: ["1", "1", "1", "2 (ampliable con extras)"] },
  { label: "Miembros de equipo", values: ["0", "1", "2", "3"] },
  { label: "Variantes por producto", values: ["1", "3", "10", "15"] },
  { label: "Adicionales por producto", values: ["2", "5", "10", "15"] },
  { label: "Créditos de IA por mes", values: ["15", "200", "350", "500"] },
  { label: "Reportes por mes", values: ["1", "10", "20", "30"] },
  { label: "Analíticas del catálogo", values: [false, true, true, true] },
  { label: "Notificaciones WhatsApp de órdenes", values: [false, true, true, true] },
  { label: "CRM de chats (WhatsApp, Instagram, TikTok)", values: [false, false, false, true] },
  { label: "Diseño personalizable", values: [false, true, true, true] },
  { label: "Dominio propio", values: [false, false, false, true] },
  { label: "Soporte", values: [null, "Prioritario", "Prioritario", "Dedicado"] },
];

function renderValue(value: ComparisonValue) {
  if (value === null) {
    return <Minus role="img" aria-label="No incluido" className="h-4 w-4 mx-auto text-gray-300" />;
  }
  if (value === true) {
    return <Check role="img" aria-label="Incluido" className="h-4 w-4 mx-auto text-green-500" />;
  }
  if (value === false) {
    return <X role="img" aria-label="No incluido" className="h-4 w-4 mx-auto text-gray-300" />;
  }
  return <span>{value}</span>;
}

/* ═══════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════ */
const PlanComparison = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className="mt-16"
    >
      <header className="text-center mb-8">
        <h3 className="text-[1.5rem] font-extrabold text-white leading-tight">
          Compara los planes
        </h3>
        <p className="text-white/80 mt-2 text-[0.95rem] max-w-[480px] mx-auto">
          Todos los límites de cada plan, lado a lado.
        </p>
        <p className="sm:hidden mt-3 inline-flex items-center gap-1 text-[0.8rem] font-medium text-white/70">
          Deslizá para ver los 4 planes →
        </p>
      </header>

      <div className="bg-white rounded-[1.25rem] border border-[#e2e8f0] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.15)] overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <table className="w-full min-w-[32rem] sm:min-w-[44rem] border-separate border-spacing-0 text-sm text-[#334155]">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-white w-[9rem] sm:w-[14rem] px-3 sm:px-5 py-4 text-left text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[#94a3b8] border-b border-b-[#e2e8f0]"
              >
                Límites
              </th>
              {planColumns.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={`px-2.5 sm:px-4 py-4 text-center align-bottom ${
                    plan.isPopular
                      ? "bg-[#eef2ff] border-x border-t border-x-[#c7d2fe] border-t-[#c7d2fe] border-b border-b-[#c7d2fe] rounded-t-xl"
                      : "border-b border-b-[#e2e8f0]"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {plan.isPopular && (
                      <span className="inline-flex items-center px-2.5 py-[0.15rem] rounded-full text-[0.65rem] font-semibold bg-[#6366f1] text-white whitespace-nowrap">
                        Más popular
                      </span>
                    )}
                    <span
                      className={`text-[1rem] font-bold ${
                        plan.isPopular ? "text-[#6366f1]" : "text-[#1e293b]"
                      }`}
                    >
                      {plan.name}
                    </span>
                    <span className="text-[0.75rem] font-medium text-[#64748b] whitespace-nowrap">
                      {plan.price}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const isLast = rowIndex === rows.length - 1;
              return (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 bg-white px-3 sm:px-5 py-3 text-left text-[0.8rem] sm:text-sm font-medium text-[#334155] ${
                      isLast ? "" : "border-b border-b-[#f1f5f9]"
                    }`}
                  >
                    {row.label}
                  </th>
                  {row.values.map((value, colIndex) => {
                    const plan = planColumns[colIndex];
                    return (
                      <td
                        key={plan.id}
                        className={`px-2.5 sm:px-4 py-3 text-center ${
                          plan.isPopular
                            ? `bg-[#eef2ff] border-x border-x-[#c7d2fe] ${
                                isLast
                                  ? "border-b border-b-[#c7d2fe] rounded-b-xl"
                                  : "border-b border-b-[#e0e7ff]"
                              }`
                            : isLast
                              ? ""
                              : "border-b border-b-[#f1f5f9]"
                        }`}
                      >
                        {renderValue(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default PlanComparison;
