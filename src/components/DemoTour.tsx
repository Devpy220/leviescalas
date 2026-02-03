import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LeviLogo } from '@/components/LeviLogo';
import { tourSteps } from './demo-tour/tourSteps';
import { StepContent } from './demo-tour/StepContent';

interface DemoTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoTour({ open, onOpenChange }: DemoTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = tourSteps[currentStep];
  const Icon = step.icon;

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false);
      setCurrentStep(0);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setCurrentStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="gradient-vibrant p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LeviLogo size="sm" className="bg-white/20 rounded-xl p-1" />
              <span className="font-display text-xl font-bold">LEVI</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Progress */}
          <div className="flex gap-1">
            {tourSteps.map((_, index) => (
              <div 
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl gradient-vibrant flex items-center justify-center shrink-0">
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground">
                {step.description}
              </p>
            </div>
          </div>

          {/* Demo Visual based on step */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border min-h-[200px]">
            <StepContent stepId={step.id} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
          
          <span className="text-sm text-muted-foreground">
            {currentStep + 1} de {tourSteps.length}
          </span>
          
          <Button onClick={nextStep} className="gradient-vibrant text-white">
            {currentStep === tourSteps.length - 1 ? (
              'Começar'
            ) : (
              <>
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
