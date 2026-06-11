import { Seo } from "@/lib/seo";

const NotFound = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted">
      <Seo title="Página no encontrada" path="/404" noindex />
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-extrabold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página no encontrada</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Volver al inicio
        </a>
      </div>
    </main>
  );
};

export default NotFound;
