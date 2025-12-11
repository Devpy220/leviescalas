import { useState, useRef } from 'react';
import { Camera, Loader2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DepartmentAvatarProps {
  departmentId: string;
  avatarUrl: string | null;
  departmentName: string;
  isLeader: boolean;
  onAvatarChange?: (newUrl: string) => void;
}

export default function DepartmentAvatar({
  departmentId,
  avatarUrl,
  departmentName,
  isLeader,
  onAvatarChange
}: DepartmentAvatarProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleClick = () => {
    if (isLeader && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 2MB.',
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${departmentId}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('department-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('department-avatars')
        .getPublicUrl(fileName);

      // Add timestamp to bust cache
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      // Update department record using raw update to bypass type checking
      // since types haven't been regenerated yet
      const { error: updateError } = await supabase
        .from('departments')
        .update({ avatar_url: urlWithTimestamp } as any)
        .eq('id', departmentId);

      if (updateError) throw updateError;

      onAvatarChange?.(urlWithTimestamp);

      toast({
        title: 'Avatar atualizado!',
        description: 'A imagem do departamento foi alterada.',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar imagem',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={!isLeader || uploading}
        className={`
          w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center
          ${avatarUrl ? '' : 'gradient-vibrant'}
          ${isLeader ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
          shadow-glow-sm
        `}
        title={isLeader ? 'Clique para alterar o avatar' : departmentName}
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        ) : avatarUrl ? (
          <img
            src={avatarUrl}
            alt={departmentName}
            className="w-full h-full object-cover"
          />
        ) : (
          <Calendar className="w-5 h-5 text-white" />
        )}
      </button>

      {isLeader && (
        <>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <Camera className="w-3 h-3 text-primary-foreground" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </>
      )}
    </div>
  );
}
