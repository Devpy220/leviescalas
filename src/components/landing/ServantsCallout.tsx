import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ServantsCalloutProps {
  onStart: () => void;
}

/** Home highlight: "Menos voluntários. Mais servos." with Isaiah 6:8. Fades in when scrolled into view. */
export function ServantsCallout({ onStart }: ServantsCalloutProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby="servants-title"
      className={`relative z-[1] py-12 sm:py-16 transition-all duration-700 ease-out motion-reduce:transition-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <h2
            id="servants-title"
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight"
          >
            {t('landing.servants.title')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            {t('landing.servants.subtitle')}
          </p>

          <figure className="relative mx-auto max-w-xl rounded-3xl border border-primary/20 bg-card/80 backdrop-blur-md px-6 sm:px-10 py-8 shadow-lg shadow-primary/10">
            <Quote
              aria-hidden="true"
              className="absolute -top-4 left-6 h-9 w-9 rounded-full bg-primary p-2 text-primary-foreground shadow-md"
            />
            <Quote
              aria-hidden="true"
              className="absolute -bottom-4 right-6 h-9 w-9 rotate-180 rounded-full bg-primary p-2 text-primary-foreground shadow-md"
            />
            <blockquote className="font-display text-xl sm:text-2xl italic text-foreground leading-snug">
              “{t('landing.servants.verse')}”
            </blockquote>
            <figcaption className="mt-3 text-sm font-semibold tracking-wide text-[hsl(var(--levi-typewriter-amber))]">
              {t('landing.servants.verseRef')}
            </figcaption>
          </figure>

          <p className="mx-auto max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed pt-2">
            {t('landing.servants.support')}
          </p>

          <Button
            type="button"
            onClick={onStart}
            className="h-11 rounded-xl px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold btn-glow"
          >
            {t('landing.servants.cta')}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}
