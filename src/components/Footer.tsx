import elsdigitalLogo from '@/assets/elsdigital-logo.jpeg';

const Footer = () => {
  return (
    <footer className="border-t border-border/50 py-4 mt-auto">
      <div className="container mx-auto px-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <img
            src={elsdigitalLogo}
            alt="ELSDIGITAL"
            className="w-7 h-7 rounded-full object-cover"
          />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ELSDIGITAL — Desenvolvendo Soluções
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Dúvidas ou sugestões:{' '}
          <a
            href="mailto:suport@leviescalas.com.br"
            className="text-primary hover:underline"
          >
            suport@leviescalas.com.br
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
