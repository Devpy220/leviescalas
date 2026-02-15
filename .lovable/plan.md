

## Corrigir Notificações Push - Configurar VAPID Keys

### Problema
As notificações push estão falhando com erro `403: invalid JWT` porque as chaves VAPID (necessárias para assinar as mensagens push) não estão configuradas no projeto.

### O que será feito

1. **Adicionar secrets VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY** no backend com as chaves recém-geradas (formato JWK)

2. **Atualizar o frontend** (`src/hooks/usePushNotifications.tsx`) com a nova chave pública no formato Base64URL:
   - Chave atual (inválida): `BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U`
   - Nova chave: `BELXRy8lGRPQ3-jKQPoskxMgfNmFXyTFGSuNKQUIw76PdnxMwK7jYQOwHp4haHhjZj54nreM_R64SUGkEwNFQ9s`

3. **Corrigir o RLS da tabela push_subscriptions** - atualmente falta permissão de UPDATE, o que impede o `upsert` usado no frontend. Será adicionada uma policy de UPDATE para o próprio usuário.

4. **Remover a função temporária** `generate-vapid-keys` (não é mais necessária)

### Importante
- Usuários que já ativaram push precisarão **re-ativar** (desativar e ativar novamente) porque a chave pública mudou
- Novas ativações funcionarão automaticamente

### Detalhes Técnicos

**Arquivos modificados:**
- `src/hooks/usePushNotifications.tsx` - Atualizar `VAPID_PUBLIC_KEY` 
- `supabase/functions/generate-vapid-keys/` - Remover (função temporária)

**Secrets adicionados:**
- `VAPID_PUBLIC_KEY` - Chave pública JWK para verificação
- `VAPID_PRIVATE_KEY` - Chave privada JWK para assinatura ES256

**Migração SQL:**
- Adicionar policy UPDATE na tabela `push_subscriptions` para permitir upsert

