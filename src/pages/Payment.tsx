import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, QrCode, CreditCard, Upload, Loader2, FileCheck, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import pixQrCode from '@/assets/pix-qrcode.jpg';

export default function Payment() {
  const [copiedPix, setCopiedPix] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existingReceipt, setExistingReceipt] = useState<{
    id: string;
    receipt_url: string;
    status: string;
    uploaded_at: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // PIX key - Eduardo Lino da Silva
  const pixKey = "elinosilva47@gmail.com";

  useEffect(() => {
    if (user) {
      fetchExistingReceipt();
    }
  }, [user]);

  const fetchExistingReceipt = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('payment_receipts')
      .select('id, receipt_url, status, uploaded_at')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setExistingReceipt(data);
    }
  };

  const copyPixKey = async () => {
    await navigator.clipboard.writeText(pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
    
    toast({
      title: 'Chave PIX copiada!',
      description: 'Cole no seu app de pagamento.',
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Arquivo inválido',
        description: 'Por favor, envie uma imagem do comprovante.',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O arquivo deve ter no máximo 5MB.',
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL (signed URL since bucket is private)
      const { data: urlData } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      if (!urlData?.signedUrl) throw new Error('Failed to get URL');

      // Get user's first department (for now, we associate with any department they lead or belong to)
      const { data: memberData } = await supabase
        .from('members')
        .select('department_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!memberData) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Você precisa estar em um departamento para enviar o comprovante.',
        });
        return;
      }

      // Save receipt record
      const { error: insertError } = await supabase
        .from('payment_receipts')
        .insert({
          user_id: user.id,
          department_id: memberData.department_id,
          receipt_url: urlData.signedUrl,
          status: 'pending'
        });

      if (insertError) throw insertError;

      toast({
        title: 'Comprovante enviado!',
        description: 'Seu comprovante foi enviado e está aguardando confirmação.',
      });

      // Refresh receipt status
      fetchExistingReceipt();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o comprovante. Tente novamente.',
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <FileCheck className="w-4 h-4" />
            <span>Aprovado</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-2 text-destructive">
            <X className="w-4 h-4" />
            <span>Rejeitado</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Clock className="w-4 h-4" />
            <span>Aguardando confirmação</span>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-foreground">
                  Pagamento
                </h1>
                <p className="text-xs text-muted-foreground">
                  Apoie o LEVI
                </p>
              </div>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* PIX Payment Card */}
          <Card className="border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl gradient-vibrant flex items-center justify-center shadow-glow mb-4">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Pagamento via PIX</CardTitle>
              <CardDescription>
                Escaneie o QR Code ou copie a chave PIX para fazer o pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* QR Code PIX */}
              <div className="flex justify-center">
                <div className="w-64 h-64 bg-white rounded-2xl p-3 shadow-lg">
                  <img 
                    src={pixQrCode} 
                    alt="QR Code PIX" 
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
              </div>

              {/* Beneficiary Info */}
              <div className="text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">EDUARDO LINO DA SILVA</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <div className="w-5 h-5 rounded-full bg-[#FF7A00] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                  <span>Banco Inter</span>
                </div>
              </div>

              {/* PIX Key */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Ou copie a chave PIX:
                </p>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <code className="flex-1 text-sm font-mono truncate text-center">
                    {pixKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyPixKey}
                    className="shrink-0"
                  >
                    {copiedPix ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-3 pt-4 border-t border-border">
                <p className="text-sm font-medium text-foreground">Como pagar:</p>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Abra o app do seu banco</li>
                  <li>Escolha a opção PIX</li>
                  <li>Escaneie o QR Code ou cole a chave PIX</li>
                  <li>Confirme o pagamento</li>
                  <li>Envie o comprovante abaixo</li>
                </ol>
              </div>

              {/* Upload Receipt Section */}
              <div className="space-y-3 pt-4 border-t border-border">
                <p className="text-sm font-medium text-foreground">Enviar comprovante:</p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {existingReceipt ? (
                  <div className="p-4 rounded-lg bg-muted space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Último comprovante:</span>
                      {getStatusBadge(existingReceipt.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {new Date(existingReceipt.uploaded_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {existingReceipt.status !== 'approved' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUploadClick}
                        disabled={uploading}
                        className="w-full"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Enviar novo comprovante
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleUploadClick}
                    disabled={uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Enviar comprovante de pagamento
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Benefits Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">O que você ganha</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Acesso completo ao sistema</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Membros ilimitados no departamento</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Notificações por email</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Exportação para PDF e Excel</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Suporte prioritário</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}