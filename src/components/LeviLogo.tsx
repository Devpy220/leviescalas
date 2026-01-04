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
    <img 
      src="/favicon.png" 
      alt="LEVI" 
      className={`${sizeClasses[size]} rounded-xl shadow-glow-sm ${className}`}
    />
  );
}
