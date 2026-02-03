import { LeviLogo } from '@/components/LeviLogo';

export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8">
      <LeviLogo size="lg" className="mb-4 animate-float" />
      <p className="text-center text-muted-foreground">
        Gerencie escalas de forma simples e gratuita
      </p>
    </div>
  );
}
