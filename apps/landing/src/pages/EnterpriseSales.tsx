import logo from "@/assets/logo.svg";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  buildCalendlyUrl,
  CATALOG_OPTIONS,
  EnterpriseCatalogs,
  EnterpriseFunnelAnswers,
  EnterpriseLeadResult,
  EnterpriseNeed,
  EnterpriseRange,
  EnterpriseTeamSize,
  NEED_OPTIONS,
  RANGE_OPTIONS,
  scoreEnterpriseLead,
  submitEnterpriseLead,
  TEAM_OPTIONS,
} from "@/lib/enterprise-lead";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESULT_STEP = 5;

/* Pill de opción (single o multi) reutilizado en los pasos 2–4 */
function OptionPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
        selected
          ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca] font-semibold"
          : "border-[#e2e8f0] bg-white text-[#334155] hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
      }`}
    >
      {label}
      {selected && <Check className="h-4 w-4 shrink-0 text-[#6366f1]" />}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-[#475569]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-[#e2e8f0] px-3.5 py-2.5 text-sm text-[#1e293b] outline-none transition-colors focus:border-[#6366f1]"
      />
    </label>
  );
}

const EnterpriseSales = () => {
  const [step, setStep] = useState(0);

  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [productsRange, setProductsRange] = useState<EnterpriseRange | null>(null);
  const [ordersRange, setOrdersRange] = useState<EnterpriseRange | null>(null);
  const [catalogsNeeded, setCatalogsNeeded] = useState<EnterpriseCatalogs | null>(null);
  const [teamSize, setTeamSize] = useState<EnterpriseTeamSize | null>(null);
  const [needs, setNeeds] = useState<EnterpriseNeed[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Honeypot: los humanos no ven este campo; si viene lleno la edge function ignora el lead.
  const [companyHp, setCompanyHp] = useState("");

  const [result, setResult] = useState<EnterpriseLeadResult | null>(null);
  const [sendFailed, setSendFailed] = useState(false);

  const canContinue = (() => {
    switch (step) {
      case 0:
        return businessName.trim().length > 0;
      case 1:
        return productsRange !== null && ordersRange !== null;
      case 2:
        return catalogsNeeded !== null && teamSize !== null;
      case 3:
        return needs.length > 0;
      case 4:
        return name.trim().length > 0 && EMAIL_RE.test(email.trim());
      default:
        return false;
    }
  })();

  const toggleNeed = (need: EnterpriseNeed) =>
    setNeeds((current) =>
      current.includes(need)
        ? current.filter((n) => n !== need)
        : [...current, need]
    );

  const collectAnswers = (): EnterpriseFunnelAnswers => ({
    businessName: businessName.trim(),
    country: country.trim(),
    website: website.trim(),
    productsRange: productsRange ?? "lt_100",
    ordersRange: ordersRange ?? "lt_100",
    catalogsNeeded: catalogsNeeded ?? "1",
    teamSize: teamSize ?? "solo",
    needs,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
  });

  const sendLead = async (answers: EnterpriseFunnelAnswers) => {
    setSendFailed(false);
    const ok = await submitEnterpriseLead(answers, companyHp);
    if (!ok) setSendFailed(true);
  };

  const next = () => {
    if (!canContinue) return;
    if (step === 4) {
      const answers = collectAnswers();
      // Resultado local inmediato; la edge function re-puntúa lo que persiste.
      setResult(scoreEnterpriseLead(answers));
      setStep(RESULT_STEP);
      void sendLead(answers);
      return;
    }
    setStep((s) => s + 1);
  };

  const calendlyUrl = buildCalendlyUrl(name.trim(), email.trim());

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header slim (los anchors del Navbar completo no aplican fuera del home) */}
      <header className="bg-white border-b border-[#e2e8f0]">
        <div className="container mx-auto flex items-center justify-between h-16 px-4 max-w-6xl">
          <a href="/" className="flex items-center" aria-label="CatalogoHoy — Inicio">
            <img src={logo} alt="" className="h-11 w-11" aria-hidden="true" />
            <span className="font-display font-bold text-xl text-foreground">
              CatalogoHoy
            </span>
          </a>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 md:py-16 max-w-xl">
        <div className="text-center mb-8">
          <span className="inline-block text-[0.8rem] font-semibold text-[#6366f1] uppercase tracking-[0.05em] mb-2">
            Plan Enterprise
          </span>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl text-foreground leading-tight">
            Cuéntanos de tu negocio
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Unas pocas preguntas para armar un plan a tu medida.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 md:p-8 flex flex-col gap-6">
          {step < RESULT_STEP && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                Paso {step + 1} de 5
              </span>
              <div className="h-1.5 rounded-full bg-[#f1f5f9] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#6366f1] transition-all duration-300"
                  style={{ width: `${((step + 1) / 5) * 100}%` }}
                />
              </div>
            </div>
          )}

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-[#1e293b]">Tu negocio</h2>
              <Field
                label="Nombre del negocio *"
                value={businessName}
                onChange={setBusinessName}
                placeholder="Mi empresa"
              />
              <Field
                label="País"
                value={country}
                onChange={setCountry}
                placeholder="Venezuela"
              />
              <Field
                label="Sitio web o Instagram (opcional)"
                value={website}
                onChange={setWebsite}
                placeholder="miempresa.com"
              />
              {/* Honeypot invisible para bots */}
              <input
                type="text"
                name="company_hp"
                value={companyHp}
                onChange={(e) => setCompanyHp(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-lg font-bold text-[#1e293b]">
                ¿Qué tamaño tiene tu operación?
              </h2>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#475569]">
                  ¿Cuántos productos manejas?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {RANGE_OPTIONS.map((o) => (
                    <OptionPill
                      key={o.value}
                      label={o.label}
                      selected={productsRange === o.value}
                      onClick={() => setProductsRange(o.value)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#475569]">
                  ¿Cuántos pedidos recibes al mes?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {RANGE_OPTIONS.map((o) => (
                    <OptionPill
                      key={o.value}
                      label={o.label}
                      selected={ordersRange === o.value}
                      onClick={() => setOrdersRange(o.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-lg font-bold text-[#1e293b]">
                ¿Qué estructura necesitas?
              </h2>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#475569]">
                  ¿Cuántos catálogos o tiendas necesitas?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {CATALOG_OPTIONS.map((o) => (
                    <OptionPill
                      key={o.value}
                      label={o.label}
                      selected={catalogsNeeded === o.value}
                      onClick={() => setCatalogsNeeded(o.value)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#475569]">
                  ¿Cuántas personas trabajan contigo?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {TEAM_OPTIONS.map((o) => (
                    <OptionPill
                      key={o.value}
                      label={o.label}
                      selected={teamSize === o.value}
                      onClick={() => setTeamSize(o.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#1e293b]">
                  ¿Qué buscas en CatalogoHoy?
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecciona todo lo que aplique.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NEED_OPTIONS.map((o) => (
                  <OptionPill
                    key={o.value}
                    label={o.label}
                    selected={needs.includes(o.value)}
                    onClick={() => toggleNeed(o.value)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-[#1e293b]">
                ¿Cómo te contactamos?
              </h2>
              <Field
                label="Tu nombre *"
                value={name}
                onChange={setName}
                placeholder="Nombre y apellido"
              />
              <Field
                label="Email *"
                value={email}
                onChange={setEmail}
                placeholder="tu@empresa.com"
                type="email"
              />
              <Field
                label="WhatsApp (opcional)"
                value={phone}
                onChange={setPhone}
                placeholder="+58 412 000 0000"
                type="tel"
              />
            </div>
          )}

          {step === RESULT_STEP && result && (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              {result.qualified ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-[#eef2ff] text-[#6366f1] flex items-center justify-center">
                    <CalendarCheck className="h-8 w-8" />
                  </div>
                  <h2 className="text-xl font-bold text-[#1e293b]">
                    ¡Perfecto! Hablemos
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Tu operación encaja con Enterprise. Agenda una reunión con
                    nuestro equipo y armamos un plan a la medida de tu negocio.
                  </p>
                  <a
                    href={calendlyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1e293b] transition-colors"
                  >
                    <CalendarCheck className="h-4 w-4" />
                    Agendar reunión
                  </a>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-[#f5f3ff] text-[#7c3aed] flex items-center justify-center">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h2 className="text-xl font-bold text-[#1e293b]">
                    El plan Avanzado te queda perfecto
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Por lo que nos contaste, el plan Avanzado cubre lo que
                    necesitas: productos ilimitados, hasta 2 catálogos
                    (ampliables), equipo de hasta 10 personas y 500 créditos de
                    IA al mes.
                  </p>
                  <a
                    href="/#pricing"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4f46e5] transition-colors"
                  >
                    Ver plan Avanzado
                  </a>
                  <a
                    href={calendlyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[#6366f1] underline underline-offset-4"
                  >
                    Igual quiero hablar con ventas
                  </a>
                </>
              )}
              {sendFailed && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  No pudimos registrar tus datos, pero puedes agendar igual.
                </div>
              )}
            </div>
          )}

          {/* Navegación */}
          {step < RESULT_STEP && (
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-semibold text-[#475569] hover:bg-[#f8fafc] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Atrás
                </button>
              )}
              <button
                type="button"
                onClick={next}
                disabled={!canContinue}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1e293b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === 4 ? "Ver resultado" : "Continuar"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          ¿Prefieres escribirnos directo?{" "}
          <a
            href="https://wa.me/584220240947"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#6366f1] underline underline-offset-2"
          >
            WhatsApp
          </a>
        </p>
      </main>
    </div>
  );
};

export default EnterpriseSales;
