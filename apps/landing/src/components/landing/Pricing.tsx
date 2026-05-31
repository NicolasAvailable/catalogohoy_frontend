import { Check, X, PlusCircle } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { isVenezuela, useVisitorCountry } from "@/hooks/use-visitor-country";

/* ═══════════════════════════════════════
   TYPES & CONFIG
   ═══════════════════════════════════════ */
const WHATSAPP_NUMBER = "584220240947";

type BillingPeriod = "monthly" | "quarterly" | "annual";

const BILLING_CONFIG: Record<BillingPeriod, { months: number; discount: number }> = {
  monthly:   { months: 1,  discount: 0 },
  quarterly: { months: 3,  discount: 0.10 },
  annual:    { months: 12, discount: 0.15 },
};

const PLAN_BASE_PRICES: Record<string, number> = {
  basico: 9.99,
  avanzado: 19.99,
};

const CATALOG_ADDON_PRICE = 5.99;

const billingOptions: { key: BillingPeriod; label: string; savingsLabel?: string }[] = [
  { key: "monthly",   label: "Mensual" },
  { key: "quarterly", label: "Trimestral", savingsLabel: "10% off" },
  { key: "annual",    label: "Anual",      savingsLabel: "15% off" },
];

/* ═══════════════════════════════════════
   PLAN DATA
   ═══════════════════════════════════════ */
type Feature = { label: string; negative?: boolean };

type PlanData = {
  id: string;
  name: string;
  isFree: boolean;
  description: string;
  maxProducts: number;
  productsLabel?: string;
  maxTeamMembers: number;
  features: Feature[];
  buttonLabel: string;
  isPopular: boolean;
  color: string;
};

const plans: PlanData[] = [
  {
    id: "gratis",
    name: "Gratis",
    isFree: true,
    description: "Para empezar a probar tu catálogo.",
    maxProducts: 10,
    maxTeamMembers: 0,
    features: [
      { label: "1 catálogo" },
      { label: "Edición limitada del catálogo" },
      { label: "1 reporte por mes" },
      { label: "Sin analíticas del catálogo", negative: true },
    ],
    buttonLabel: "Empezar gratis",
    isPopular: false,
    color: "#64748b",
  },
  {
    id: "basico",
    name: "Básico",
    isFree: false,
    description: "Para tiendas que quieren crecer.",
    maxProducts: 100,
    maxTeamMembers: 1,
    features: [
      { label: "1 catálogo" },
      { label: "Todos los módulos disponibles" },
      { label: "Analíticas del catálogo" },
      { label: "Hasta 10 reportes por mes" },
      { label: "Diseño personalizable" },
      { label: "Soporte prioritario" },
    ],
    buttonLabel: "Comenzar ahora",
    isPopular: true,
    color: "#6366f1",
  },
  {
    id: "avanzado",
    name: "Avanzado",
    isFree: false,
    description: "Para negocios con muchos productos.",
    maxProducts: 0,
    productsLabel: "Productos ilimitados",
    maxTeamMembers: 10,
    features: [
      { label: "Hasta 2 catálogos" },
      { label: "Todo del plan Básico" },
      { label: "Analíticas del catálogo" },
      { label: "Hasta 30 reportes por mes" },
      { label: "Vinculación de dominio personalizado (dominio aparte)" },
      { label: "Soporte dedicado" },
    ],
    buttonLabel: "Comenzar ahora",
    isPopular: false,
    color: "#7c3aed",
  },
];

/* ═══════════════════════════════════════
   PRICE HELPERS
   ═══════════════════════════════════════ */
function getBasePrice(plan: PlanData): number {
  if (plan.isFree) return 0;
  return PLAN_BASE_PRICES[plan.id] ?? 0;
}

function getPeriodPrice(plan: PlanData, period: BillingPeriod): number {
  if (plan.isFree) return 0;
  const { months, discount } = BILLING_CONFIG[period];
  return Math.round(getBasePrice(plan) * months * (1 - discount) * 100) / 100;
}

function getMonthlyEquivalent(plan: PlanData, period: BillingPeriod): number {
  if (plan.isFree) return 0;
  const { discount } = BILLING_CONFIG[period];
  return Math.round(getBasePrice(plan) * (1 - discount) * 100) / 100;
}

function getPeriodLabel(period: BillingPeriod, isFree: boolean): string {
  if (isFree) return "por siempre";
  if (period === "monthly") return "/mes";
  if (period === "quarterly") return "/trimestre";
  return "/año";
}

function getTeamLabel(members: number): string {
  if (members === 0) return "Sin equipo de trabajo";
  if (members === 1) return "1 miembro de equipo";
  return `Hasta ${members} miembros de equipo`;
}

function handleSelectPlan(plan: PlanData, period: BillingPeriod): void {
  if (plan.isFree) {
    window.open("https://auth.catalogohoy.com/signup", "_blank");
    return;
  }
  const price = getPeriodPrice(plan, period);
  const periodLabel = getPeriodLabel(period, false);
  const message = encodeURIComponent(
    `Hola, me interesa adquirir el plan *${plan.name}* ($${price}${periodLabel} USD) de Catálogo Hoy. ¿Me pueden dar más información?`
  );
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
}

/* ═══════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════ */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } },
};

/* ═══════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════ */
const Pricing = () => {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  // Mostramos "a tasa BCV" solo cuando el visitante (por geo-IP) está en
  // Venezuela. Si está en otro país — directo o vía VPN — no aplica.
  const { country } = useVisitorCountry();
  const showBcv = isVenezuela(country);

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="py-24 md:py-32 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%)",
      }}
    >
      {/* Decorative blurred orbs */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto px-6 max-w-[1200px] relative z-10">

        {/* ═══ HEADER ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <span className="inline-block text-[0.8rem] font-semibold text-white/90 uppercase tracking-[0.05em] mb-2">
            Planes
          </span>
          <h2 id="pricing-heading" className="text-[2rem] font-extrabold text-white leading-tight">
            El plan perfecto para tu negocio
          </h2>
          <p className="text-white/80 mt-2 text-[0.95rem] max-w-[480px] mx-auto">
            Elige el plan que mejor se adapte y escala cuando lo necesites.
          </p>

          {/* Billing period toggle */}
          <div className="flex items-center justify-center mt-6">
            <div className="inline-flex items-center gap-0.5 bg-[#f1f5f9] rounded-full p-[0.25rem]">
              {billingOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setBillingPeriod(opt.key)}
                  className={`inline-flex items-center gap-1 sm:gap-2 px-2.5 sm:px-[1.1rem] py-1.5 sm:py-[0.45rem] rounded-full text-xs sm:text-sm font-medium border-none cursor-pointer transition-all duration-200 whitespace-nowrap ${
                    billingPeriod === opt.key
                      ? "bg-white text-[#1e293b] font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                      : "bg-transparent text-[#64748b]"
                  }`}
                >
                  {opt.label}
                  {opt.savingsLabel && (
                    <span className="bg-[#dcfce7] text-[#16a34a] text-[0.6rem] sm:text-[0.68rem] font-semibold px-1.5 sm:px-2 py-[0.1rem] rounded-full">
                      {opt.savingsLabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </motion.header>

        {/* ═══ GRID ═══ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[420px] lg:max-w-none mx-auto items-stretch"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              variants={cardVariants}
              className={`relative bg-white rounded-[1.25rem] flex flex-col transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.1)] ${
                plan.isPopular
                  ? "border-2 border-[#6366f1] shadow-[0_8px_30px_-6px_rgba(99,102,241,0.25)]"
                  : "border border-[#e2e8f0]"
              }`}
            >
              <div className="p-7 flex flex-col gap-4 flex-1">

                {/* ── Header ── */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-[1.2rem] font-bold ${plan.isPopular ? "text-[#6366f1]" : "text-[#1e293b]"}`}>
                      {plan.name}
                    </h3>
                    {plan.isPopular && (
                      <span className="inline-flex items-center px-3 py-[0.2rem] rounded-full text-[0.72rem] font-semibold whitespace-nowrap bg-[#eef2ff] text-[#6366f1] border border-[#c7d2fe]">
                        Más popular
                      </span>
                    )}
                  </div>
                  <p className="text-[#64748b] text-[0.85rem] leading-relaxed">{plan.description}</p>
                </div>

                {/* ── Price ── */}
                <div>
                  <div className="flex items-baseline gap-[0.25rem]">
                    {plan.isFree ? (
                      <>
                        <span className="text-[2.75rem] font-extrabold text-[#0f172a] leading-none">$0</span>
                        <span className="text-[0.9rem] text-[#94a3b8] ml-1">por siempre</span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-[0.1rem]">
                          <span className="text-[1.5rem] font-bold text-[#0f172a]">$</span>
                          <span className="text-[2.75rem] font-extrabold text-[#0f172a] leading-none">
                            {getPeriodPrice(plan, billingPeriod)}
                          </span>
                        </div>
                        <span className="text-[0.9rem] text-[#94a3b8] ml-1">
                          {getPeriodLabel(billingPeriod, false)} · USD
                        </span>
                      </>
                    )}
                  </div>
                  {!plan.isFree && billingPeriod !== "monthly" && (
                    <p className="text-[0.78rem] text-[#94a3b8] mt-1">
                      ${getMonthlyEquivalent(plan, billingPeriod)}/mes
                    </p>
                  )}
                  {!plan.isFree && showBcv && (
                    <p className="text-sm font-medium text-[#1e293b] mt-0.5">a tasa BCV</p>
                  )}
                </div>

                {/* ── CTA Button ── */}
                <button
                  onClick={() => handleSelectPlan(plan, billingPeriod)}
                  className={`flex items-center justify-center gap-1.5 w-full py-[0.65rem] px-4 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 ${
                    plan.isPopular
                      ? "bg-[#6366f1] text-white border-none hover:bg-[#4f46e5]"
                      : "bg-[#f8fafc] text-[#1e293b] border border-[#e2e8f0] hover:bg-[#f1f5f9] hover:border-[#cbd5e1]"
                  }`}
                >
                  {plan.buttonLabel}
                </button>

                {/* ── Divider ── */}
                <hr className="border-0 h-px bg-[#f1f5f9] m-0" />

                {/* ── Features ── */}
                <ul className="flex flex-col gap-[0.55rem] flex-1 list-none p-0 m-0">
                  <li className="flex items-center gap-[0.6rem] text-sm text-[#334155]">
                    <Check className="h-4 w-4 shrink-0 text-green-500" />
                    <span>{plan.productsLabel ?? `Hasta ${plan.maxProducts} productos`}</span>
                  </li>
                  <li className="flex items-center gap-[0.6rem] text-sm text-[#334155]">
                    {plan.maxTeamMembers > 0 ? (
                      <Check className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 text-gray-300" />
                    )}
                    <span>{getTeamLabel(plan.maxTeamMembers)}</span>
                  </li>
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-[0.6rem] text-sm text-[#334155]">
                      {feature.negative ? (
                        <X className="h-4 w-4 shrink-0 text-gray-300" />
                      ) : (
                        <Check className="h-4 w-4 shrink-0 text-green-500" />
                      )}
                      <span>{feature.label}</span>
                    </li>
                  ))}
                </ul>

                {/* ── Footer ── */}
                {!plan.isFree && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-[0.7rem] py-1 rounded-full text-xs font-medium border bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]">
                        Tarjeta internacional
                      </span>
                      <span className="inline-flex items-center px-[0.7rem] py-1 rounded-full text-xs font-medium border bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]">
                        Pago móvil
                      </span>
                    </div>
                    <p className="flex items-center gap-[0.35rem] text-xs text-[#94a3b8]">
                      <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                      Catálogo adicional ${CATALOG_ADDON_PRICE}/mes
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
