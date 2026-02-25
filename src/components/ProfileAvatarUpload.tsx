import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ImageCropDialog from '@/components/department/ImageCropDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileAvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  userName: string;
  size?: 'sm' | 'md' | 'lg';
  onAvatarUpdated?: (newUrl: string) => void;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-20 h-20',
  lg: 'w-28 h-28',
};

const iconSizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const badgeSizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

export default function ProfileAvatarUpload({
  userId,
  currentAvatarUrl,
  userName,
  size = 'lg',
  onAvatarUpdated,
}: ProfileAvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Arquivo inválido', description: 'Selecione uma imagem.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Máximo de 10MB.' });
      return;
    }

    setCropFile(file);
    setShowCrop(true);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleCropComplete = async (blob: Blob) => {
    setShowCrop(false);
    setCropFile(null);
    setUploading(true);

    try {
      const filePath = `${userId}/avatar.jpg`;

      // Upload (upsert)
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Save to profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      onAvatarUpdated?.(publicUrl);
      toast({ title: 'Foto atualizada!', description: 'Sua foto de perfil foi salva.' });
    } catch (err) {
      console.error('Avatar upload error:', err);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: 'Tente novamente.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="relative inline-block cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
        <Avatar className={`${sizeClasses[size]} border-2 border-primary/20 transition-opacity group-hover:opacity-80`}>
          <AvatarImage src={avatarUrl || undefined} alt={userName} />
          <AvatarFallback className="gradient-vibrant text-white font-bold text-lg">
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : initials}
          </AvatarFallback>
        </Avatar>
        <div className={`absolute bottom-0 right-0 ${badgeSizeClasses[size]} rounded-full bg-primary flex items-center justify-center border-2 border-background shadow-md`}>
          {uploading ? (
            <Loader2 className={`${iconSizeClasses[size]} text-primary-foreground animate-spin`} />
          ) : (
            <Camera className={`${iconSizeClasses[size]} text-primary-foreground`} />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />
      </div>

      <ImageCropDialog
        open={showCrop}
        onClose={() => { setShowCrop(false); setCropFile(null); }}
        imageFile={cropFile}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}
