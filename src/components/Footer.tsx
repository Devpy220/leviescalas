import elsdigitalLogo from '@/assets/elsdigital-logo.jpeg';

const Footer = () => {
  return (
    <footer className="border-t border-border/30 py-5 mt-auto">
      <div className="container mx-auto px-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-destructive font-bold text-sm">LEVI</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-xs text-muted-foreground/40">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-2">
          <img
            src={elsdigitalLogo}
            alt="ELSDIGITAL"
            className="w-6 h-6 rounded-full object-cover"
          />
          <span className="text-xs text-muted-foreground/50 font-medium">Desenvolvendo Soluções</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
