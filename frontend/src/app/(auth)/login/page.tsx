import { BrandPanel } from "./_components/brand-panel";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      <BrandPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <LoginForm />
      </div>
    </main>
  );
}
