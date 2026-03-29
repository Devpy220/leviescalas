interface LeviLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LeviLogo({ size = 'md', className = '' }: LeviLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };
  
  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Dark background */}
        <rect width="120" height="120" rx="28" fill="#0F0F1A" />
        {/* Row 1 */}
        <rect x="18" y="18" width="26" height="26" rx="7" fill="#7C3AED" />
        <rect x="50" y="18" width="26" height="26" rx="7" fill="#7C3AED" opacity="0.45" />
        <rect x="82" y="18" width="26" height="26" rx="7" fill="#7C3AED" opacity="0.18" />
        {/* Row 2 */}
        <rect x="18" y="50" width="26" height="26" rx="7" fill="#7C3AED" opacity="0.45" />
        <rect x="50" y="50" width="26" height="26" rx="7" fill="#F59E0B" />
        <rect x="82" y="50" width="26" height="26" rx="7" fill="#7C3AED" opacity="0.45" />
        {/* Row 3 */}
        <rect x="18" y="82" width="26" height="26" rx="7" fill="#7C3AED" opacity="0.18" />
        <rect x="50" y="82" width="26" height="26" rx="7" fill="#7C3AED" opacity="0.45" />
        <rect x="82" y="82" width="26" height="26" rx="7" fill="#7C3AED" />
      </svg>
    </div>
  );
}
