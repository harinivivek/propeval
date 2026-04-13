import { BrandPanel } from "./_components/brand-panel";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      <BrandPanel />
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8">
        {/* Mobile-only logo — hidden when brand panel is visible */}
        <div className="lg:hidden mb-8 text-center">
          <div className="w-8 h-1 bg-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">PropEval</h1>
          <p className="text-sm text-muted-foreground mt-1">Property Valuation &amp; Legal Reports Marketplace</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
