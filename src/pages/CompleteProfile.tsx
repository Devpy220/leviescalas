import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  whatsapp: z.string()
    .min(1, 'WhatsApp é obrigatório')
    .regex(/^\d{11}$/, 'WhatsApp deve ter 11 dígitos (DDD + número)')
    .transform(val => val.replace(/\D/g, '')),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const redirectParam = searchParams.get('redirect');

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', whatsapp: '' },
  });

  // Pre-fill name from existing profile if available
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, whatsapp')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        if (data.name && data.name.trim()) form.setValue('name', data.name);
        if (data.whatsapp && data.whatsapp.trim()) form.setValue('whatsapp', data.whatsapp);
      }
    };
    fetchProfile();
  }, [user]);

  const onSubmit = async (data: ProfileForm) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: data.name, whatsapp: data.whatsapp })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Perfil completo!', description: 'Suas informações foram salvas.' });
      
      // Redirect to pending invite link or dashboard
      const destination = redirectParam || '/dashboard';
      navigate(destination, { replace: true });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <User className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Complete seu perfil</CardTitle>
          <CardDescription>
            Precisamos de algumas informações para finalizar seu cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Seu nome completo"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="11999999999"
                maxLength={11}
                {...form.register('whatsapp')}
              />
              {form.formState.errors.whatsapp && (
                <p className="text-sm text-destructive">{form.formState.errors.whatsapp.message}</p>
              )}
              <p className="text-xs text-muted-foreground">DDD + número (11 dígitos)</p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar e continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
