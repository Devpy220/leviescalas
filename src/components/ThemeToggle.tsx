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
      <button className="relative inline-flex h-9 w-16 items-center rounded-full bg-muted p-1">
        <span className="h-7 w-7 rounded-full bg-card" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`
        relative inline-flex h-9 w-16 items-center rounded-full p-1
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
          inline-flex h-7 w-7 items-center justify-center rounded-full
          shadow-md transition-all duration-300 ease-in-out
          ${isDark 
            ? 'translate-x-7 bg-primary text-primary-foreground rotate-0' 
            : 'translate-x-0 bg-secondary text-secondary-foreground rotate-0'
          }
        `}
      >
        {isDark ? (
          <Moon className="h-4 w-4 transition-transform duration-300 rotate-0" />
        ) : (
          <Sun className="h-4 w-4 transition-transform duration-300 rotate-90" />
        )}
      </span>
    </button>
  );
}
