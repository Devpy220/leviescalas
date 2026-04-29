import { useState } from 'react';
import { Code2, Copy, Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface EmbedCodeDialogProps {
  slug: string;
  churchName: string;
  trigger?: React.ReactNode;
}

export function EmbedCodeDialog({ slug, churchName, trigger }: EmbedCodeDialogProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const baseUrl = `https://leviescalas.com.br/igreja/${slug}?embed=1`;
  const directUrl = `https://leviescalas.com.br/igreja/${slug}`;

  const iframeSnippet = `<iframe
  src="${baseUrl}"
  width="100%"
  height="800"
  frameborder="0"
  style="border:0;border-radius:16px;max-width:100%"
  title="Escala de ${churchName}"
  loading="lazy">
</iframe>`;

  const responsiveSnippet = `<div style="position:relative;width:100%;max-width:900px;margin:0 auto">
  <iframe
    src="${baseUrl}"
    style="width:100%;min-height:800px;border:0;border-radius:16px;background:#fff"
    title="Escala de ${churchName}"
    loading="lazy">
  </iframe>
</div>`;

  const wordpressSnippet = `[iframe src="${baseUrl}" width="100%" height="800"]`;

  const linkSnippet = `<a href="${directUrl}" target="_blank" rel="noopener">
  Ver escala da ${churchName}
</a>`;

  const handleCopy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast({ title: 'Copiado!', description: 'Cole no editor do seu site.' });
    setTimeout(() => setCopied(null), 2000);
  };

  const CodeBlock = ({ id, code }: { id: string; code: string }) => (
    <div className="relative">
      <pre className="rounded-xl bg-muted/50 border border-border p-4 text-[11px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <Button
        size="sm"
        variant="secondary"
        className="absolute top-2 right-2"
        onClick={() => handleCopy(id, code)}
      >
        {copied === id ? (
          <>
            <Check className="w-3.5 h-3.5 mr-1" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copiar
          </>
        )}
      </Button>
    </div>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Code2 className="w-4 h-4 mr-2" />
            Integrar no site
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Integrar LEVI no site da igreja
          </DialogTitle>
          <DialogDescription>
            Mostre as escalas da <strong>{churchName}</strong> dentro do seu próprio site.
            Copie um dos trechos abaixo e cole no editor.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="iframe" className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="iframe">HTML</TabsTrigger>
            <TabsTrigger value="responsive">Responsivo</TabsTrigger>
            <TabsTrigger value="wp">WordPress</TabsTrigger>
            <TabsTrigger value="link">Link direto</TabsTrigger>
          </TabsList>

          <TabsContent value="iframe" className="space-y-2 mt-4">
            <p className="text-sm text-muted-foreground">
              Cole esse trecho em qualquer página HTML (Wix, Webflow, site próprio…).
            </p>
            <CodeBlock id="iframe" code={iframeSnippet} />
          </TabsContent>

          <TabsContent value="responsive" className="space-y-2 mt-4">
            <p className="text-sm text-muted-foreground">
              Versão com largura fluida e altura mínima — ideal para mobile.
            </p>
            <CodeBlock id="resp" code={responsiveSnippet} />
          </TabsContent>

          <TabsContent value="wp" className="space-y-2 mt-4">
            <p className="text-sm text-muted-foreground">
              Para WordPress (com plugin <em>iframe</em>) ou shortcodes simples.
            </p>
            <CodeBlock id="wp" code={wordpressSnippet} />
            <p className="text-xs text-muted-foreground">
              Em blocos modernos do WordPress, use o bloco "HTML personalizado" e cole o código da
              aba <strong>HTML</strong>.
            </p>
          </TabsContent>

          <TabsContent value="link" className="space-y-2 mt-4">
            <p className="text-sm text-muted-foreground">
              Prefere apenas linkar? Use a URL pública da página da igreja.
            </p>
            <CodeBlock id="link" code={linkSnippet} />
            <p className="text-xs text-muted-foreground break-all">
              URL direta: <span className="font-mono">{directUrl}</span>
            </p>
          </TabsContent>
        </Tabs>

        <div className="mt-4 rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">Como funciona o modo embed?</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>O parâmetro <code className="font-mono">?embed=1</code> esconde o cabeçalho e rodapé do LEVI.</li>
            <li>Mostra os departamentos e o calendário público de escalas da igreja.</li>
            <li>Atualiza automaticamente — sempre que a escala mudar no LEVI, o site reflete.</li>
            <li>Funciona em qualquer plataforma que aceite iframe (Wix, WordPress, Webflow, HTML puro).</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
