import { useState, useEffect } from 'react';
import { Heart, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const SUPPORT_PRICE_ID = 'price_1SfMwvK0EKnRdptQbNDmg4CU';
const STORAGE_KEY = 'levi_support_notification_last_shown';

// Show notification only on Wednesdays (day 3)
const NOTIFICATION_DAY = 3;

export function SupportNotification() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Only show on the designated day
    if (dayOfWeek !== NOTIFICATION_DAY) {
      return;
    }

    // Check if already shown today
    const lastShown = localStorage.getItem(STORAGE_KEY);
    if (lastShown) {
      const lastDate = new Date(lastShown);
      const isSameDay = 
        lastDate.getDate() === today.getDate() &&
        lastDate.getMonth() === today.getMonth() &&
        lastDate.getFullYear() === today.getFullYear();
      
      if (isSameDay) {
        return;
      }
    }

    // Show notification after a short delay
    const timer = setTimeout(() => {
      setVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
  };

  const handleSupport = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-support-checkout', {
        body: { priceId: SUPPORT_PRICE_ID }
      });

      if (error) throw error;

      if (data?.url) {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
        window.open(data.url, '_blank');
        setVisible(false);
      }
    } catch (error) {
      console.error('Error creating support checkout:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <Card className="relative w-full max-w-md p-6 gradient-vibrant text-white shadow-glow">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-white/70 hover:text-white hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <Heart className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <h3 className="font-display text-2xl font-bold mb-2">Apoie o LEVI ❤️</h3>
            <p className="text-white/90">
              Contribua com <span className="font-bold">R$10/mês</span> ou mais para manter a plataforma funcionando e ajudar no desenvolvimento contínuo.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
            <Button
              onClick={handleSupport}
              disabled={loading}
              className="flex-1 bg-white text-primary hover:bg-white/90 font-semibold"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Heart className="w-4 h-4 mr-2" />
              )}
              Apoiar Agora
            </Button>
            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="flex-1 text-white border-white/30 hover:bg-white/20"
            >
              Depois
            </Button>
          </div>

          <p className="text-xs text-white/60 mt-2">
            * Esta contribuição é opcional e pode ser cancelada a qualquer momento.
          </p>
        </div>
      </Card>
    </div>
  );
}
