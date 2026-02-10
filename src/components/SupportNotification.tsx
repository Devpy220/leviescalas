import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS } from '@/lib/constants';

const STORAGE_KEY = STORAGE_KEYS.SUPPORT_NOTIFICATION_LAST_SHOWN;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function SupportNotification() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const lastShown = localStorage.getItem(STORAGE_KEY);
    if (lastShown) {
      const elapsed = Date.now() - new Date(lastShown).getTime();
      if (elapsed < TWO_DAYS_MS) return;
    }

    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
  };

  const handleClick = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
    navigate('/apoio');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-primary-foreground overflow-hidden">
      <div className="relative flex items-center h-10">
        <button
          onClick={handleClick}
          className="flex-1 overflow-hidden cursor-pointer"
          aria-label="Apoie o Levi"
        >
          <div className="marquee-track whitespace-nowrap text-sm font-semibold">
            <span className="inline-block px-8">
              ❤️ Apoie o Levi com qualquer valor, clique aqui ❤️
            </span>
            <span className="inline-block px-8">
              ❤️ Apoie o Levi com qualquer valor, clique aqui ❤️
            </span>
          </div>
        </button>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-2 hover:bg-primary-foreground/20 rounded-full mr-1"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <style>{`
        .marquee-track {
          display: inline-flex;
          animation: marquee 12s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
