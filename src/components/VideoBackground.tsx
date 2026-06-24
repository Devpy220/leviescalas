import videoAsset from "@/assets/levi-bg.mp4.asset.json";

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
 */
export const VideoBackground = ({
  opacityClass = "opacity-80",
  blurClass = "blur-md",
  overlayClass = "bg-background/30",
}: VideoBackgroundProps) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <video
        className={`absolute inset-0 h-full w-full object-cover scale-110 ${opacityClass} ${blurClass}`}
        src={videoAsset.url}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className={`absolute inset-0 ${overlayClass}`} />
    </div>
  );
};

export default VideoBackground;
