import leviIcon from '@/assets/levi-icon-red.png';

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
    <div className={`${sizeClasses[size]} overflow-hidden rounded-xl ${className}`}>
      <img 
        src={leviIcon} 
        alt="LEVI" 
        className="w-full h-full object-cover scale-150"
      />
    </div>
  );
}
