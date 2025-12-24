const Footer = () => {
  return (
    <footer className="border-t border-border/50 py-6 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Dúvidas ou sugestões? Entre em contato:{' '}
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
