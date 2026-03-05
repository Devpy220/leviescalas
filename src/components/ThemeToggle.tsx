import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark';

  if (!mounted) {
    return (
      <button className="relative inline-flex h-7 w-10 items-center rounded-full bg-muted p-0.5">
        <span className="h-5 w-5 rounded-full bg-card" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`
        relative inline-flex h-7 w-10 items-center rounded-full p-0.5
        transition-colors duration-300 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        ${isDark 
          ? 'bg-primary/20 border border-primary/30' 
          : 'bg-secondary/30 border border-secondary/40'
        }
      `}
      aria-label="Alternar tema"
    >
      <span
        className={`
          inline-flex h-5 w-5 items-center justify-center rounded-full
          shadow-md transition-all duration-300 ease-in-out
          ${isDark 
            ? 'translate-x-[14px] bg-primary text-primary-foreground' 
            : 'translate-x-0 bg-secondary text-secondary-foreground'
          }
        `}
      >
        {isDark ? (
          <Moon className="h-3 w-3 transition-transform duration-300" />
        ) : (
          <Sun className="h-3 w-3 transition-transform duration-300" />
        )}
      </span>
    </button>
  );
}
