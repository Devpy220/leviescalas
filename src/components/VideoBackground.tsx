import { useEffect, useState } from "react";
import videoAsset from "@/assets/levi-bg.mp4.asset.json";
import { useIsMobile } from "@/hooks/use-mobile";

interface VideoBackgroundProps {
  /** Tailwind opacity utility for the video layer, e.g. "opacity-20" */
  opacityClass?: string;
  /** Tailwind blur utility, e.g. "blur-2xl" */
  blurClass?: string;
  /** Overlay color class for readability, e.g. "bg-background/70" */
  overlayClass?: string;
}

/**
 * Fixed full-viewport video wallpaper with blur + overlay.
 * Sits behind app content (z-[-1]) and is purely decorative.
 *
 * Performance:
 * - Skipped entirely on mobile (saves ~2MB and improves LCP).
 * - Deferred until after first paint (idle callback) on desktop.
 */
export const VideoBackground = ({
  opacityClass = "opacity-80",
  blurClass = "blur-md",
  overlayClass = "bg-background/30",
}: VideoBackgroundProps) => {
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isMobile) return;
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    };
    const schedule = w.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 800));
    const id = schedule(() => setReady(true), { timeout: 2000 });
    return () => {
      const cancel = (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback;
      if (cancel) cancel(id as number);
      else window.clearTimeout(id as number);
    };
  }, [isMobile]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {!isMobile && ready && (
        <video
          className={`absolute inset-0 h-full w-full object-cover scale-110 ${opacityClass} ${blurClass}`}
          src={videoAsset.url}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
        />
      )}
      <div className={`absolute inset-0 ${overlayClass}`} />
    </div>
  );
};

export default VideoBackground;
