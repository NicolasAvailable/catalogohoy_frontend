import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import Index from "./pages/Index";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DataDeletion from "./pages/DataDeletion";
import OrderRedirect from "./pages/OrderRedirect";
import PlanRedirect from "./pages/PlanRedirect";
import AdminRedirect from "./pages/AdminRedirect";
import EnterpriseSales from "./pages/EnterpriseSales";
import Precios from "./pages/Precios";
import PreguntasFrecuentes from "./pages/PreguntasFrecuentes";
import Funciones from "./pages/Funciones";
import NotFound from "./pages/NotFound";
import { captureReferralFromUrl } from "@/lib/referral-cookie";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Analytics />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/o/:orderId" element={<OrderRedirect />} />
            <Route path="/r/plan/:slug" element={<PlanRedirect />} />
            <Route path="/r/productos/:slug" element={<AdminRedirect to="/admin/products/create" label="Abriendo tu catálogo…" />} />
            <Route path="/r/whatsapp/:slug" element={<AdminRedirect to="/admin/catalog/edit" label="Abriendo la configuración de tu catálogo…" />} />
            <Route path="/r/compartir/:slug" element={<AdminRedirect to="" label="Abriendo tu catálogo…" />} />
            <Route path="/ventas" element={<EnterpriseSales />} />
            <Route path="/pricing" element={<Precios />} />
            <Route path="/faq" element={<PreguntasFrecuentes />} />
            <Route path="/features" element={<Funciones />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
