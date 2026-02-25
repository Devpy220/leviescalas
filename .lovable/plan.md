

## Adicionar foto de avatar para voluntarios

### Resumo
Atualmente, o avatar dos voluntarios mostra apenas a primeira letra do email. Vamos adicionar a funcionalidade de upload de foto de perfil para todos os usuarios, permitindo que cada voluntario selecione e recorte uma foto pessoal.

### Onde o usuario vai alterar a foto
- **Pagina de Configuracoes** (`/security`): Adicionar uma secao no topo com o avatar clicavel para upload de foto
- **Dashboard**: O avatar no header passara a mostrar a foto do usuario (se tiver)
- **Lista de membros**: Os avatares dos membros ja exibirao as fotos quando disponoveis

### Mudancas necessarias

#### 1. Criar bucket de storage para avatares de usuarios
- Criar bucket `user-avatars` (publico) via migracao SQL
- Criar politicas RLS para que cada usuario so possa fazer upload/deletar seus proprios arquivos

#### 2. Criar componente `ProfileAvatarUpload`
- Novo componente em `src/components/ProfileAvatarUpload.tsx`
- Avatar clicavel que abre seletor de arquivo
- Reutiliza o `ImageCropDialog` existente para recorte circular
- Faz upload para o bucket `user-avatars` com path `{user_id}/avatar.jpg`
- Atualiza campo `avatar_url` na tabela `profiles`
- Mostra icone de camera e indicador de carregamento

#### 3. Atualizar pagina de Configuracoes (`Security.tsx`)
- Adicionar secao "Meu Perfil" no topo com o componente `ProfileAvatarUpload`
- Mostrar nome e email do usuario ao lado do avatar

#### 4. Atualizar Dashboard (`Dashboard.tsx`)
- Buscar `avatar_url` do perfil junto com o nome
- Exibir foto no avatar do header (usando `AvatarImage` do Radix) em vez de apenas a inicial

#### 5. Atualizar lista de membros (`MemberList.tsx`)
- Ja recebe `avatar_url` no perfil do membro -- garantir que exibe a imagem quando disponivel

### Detalhes tecnicos

**Migracao SQL:**
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('user-avatars', 'user-avatars', true);

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'user-avatars');
```

**Fluxo do upload:**
1. Usuario clica no avatar
2. Seleciona imagem (validacao: tipo imagem, max 10MB)
3. Abre dialogo de recorte (reuso do `ImageCropDialog`)
4. Imagem recortada e enviada ao bucket
5. URL publica salva em `profiles.avatar_url`
6. Avatar atualizado em tempo real na tela
