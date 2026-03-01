import leviIcon from '@/assets/levi-icon-emerald.png';

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
      src={leviIcon} 
      alt="LEVI" 
      className={`${sizeClasses[size]} ${className}`}
    />
  );
}
