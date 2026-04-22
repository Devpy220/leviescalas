import elsdigitalLogo from '@/assets/elsdigital-logo.jpeg';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const Footer = () => {
  return (
    <footer className="relative z-[1] py-6 border-t border-border mt-auto">
      <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">LEVI</span>
          <span>·</span>
          <span className="text-xs">© {new Date().getFullYear()} Escalas</span>
          <span className="text-[10px] opacity-50 ml-1" title="Versão do app">v{APP_VERSION}</span>
        </div>
        <div className="flex items-center gap-3">
          <img src={elsdigitalLogo} alt="ELSDIGITAL" className="w-5 h-5 rounded-full object-cover" />
          <span className="text-xs text-muted-foreground">Desenvolvendo Soluções</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
