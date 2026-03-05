

## Plano: Corrigir Notificacao HTML + Usar Z-API send-link

### Problema
A edge function `view-notification` existe no codigo mas **nao esta registrada no `supabase/config.toml`**, por isso nunca foi deployada. Quando o link e aberto, o servidor retorna erro ou texto bruto em vez da pagina HTML renderizada.

### Melhoria Adicional
A Z-API tem um endpoint `send-link` que envia mensagens com preview rico (titulo, descricao e imagem do link) no WhatsApp, em vez de apenas texto com URL. Isso da uma aparencia muito mais profissional.

---

### 1. Registrar `view-notification` no config.toml

Adicionar a entrada que esta faltando:
```toml
[functions.view-notification]
verify_jwt = false
```

Isso fara a funcao ser deployada e acessivel publicamente (sem JWT, pois qualquer pessoa com o link precisa ver o card).

---

### 2. Atualizar `send-whatsapp-notification` para usar `send-link`

Aceitar parametros opcionais `linkUrl`, `title`, `linkDescription` alem de `message`. Quando presentes, usar o endpoint Z-API `/send-link` em vez de `/send-text`, gerando um preview rico no WhatsApp com titulo, descricao e miniatura automatica.

---

### 3. Atualizar `send-schedule-notification` para enviar link rico

Em vez de enviar texto puro com URL, chamar `send-whatsapp-notification` com os parametros de link:
- `linkUrl`: URL do card HTML
- `title`: "Nova Escala - {departamento}" ou "Escala Alterada"
- `linkDescription`: resumo curto (data, horario)
- `message`: texto curto + URL no final (requisito da Z-API)

---

### 4. Atualizar as demais edge functions

Aplicar o mesmo padrao de link rico em:
- `send-scheduled-reminders`
- `send-announcement-notification`  
- `send-admin-broadcast`

---

### Arquivos modificados

1. `supabase/config.toml` — adicionar `[functions.view-notification]`
2. `supabase/functions/send-whatsapp-notification/index.ts` — suportar `send-link` com preview
3. `supabase/functions/send-schedule-notification/index.ts` — enviar link rico
4. `supabase/functions/send-scheduled-reminders/index.ts` — enviar link rico
5. `supabase/functions/send-announcement-notification/index.ts` — enviar link rico
6. `supabase/functions/send-admin-broadcast/index.ts` — enviar link rico

