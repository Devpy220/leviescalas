## Plano: WhatsApp no Formulário de Contato + Lembretes Escalonados por Departamento

### Parte 1: Formulário "Fale Conosco" via WhatsApp

Substituir o envio de email (Resend) por uma mensagem WhatsApp para **18 996344885** via Z-API.

**Alterações:**

1. `**supabase/functions/send-contact-email/index.ts**` — Reescrever para chamar `send-whatsapp-notification` internamente, enviando os dados do formulário (nome, email, telefone, mensagem) formatados como texto para o número fixo `5518996344885`
2. `**src/pages/Landing.tsx**` — Nenhuma alteração necessária (já chama `send-contact-email`, só muda o backend)
3. **Deletar dependência do Resend** — A edge function não usará mais `RESEND_API_KEY`

**Formato da mensagem WhatsApp:**

```
📩 *Novo contato — LEVI*

*Nome:* João Silva
*Email:* joao@email.com
*Telefone:* (18) 99634-4885

*Mensagem:*
Texto da mensagem aqui

_Enviado via formulário de contato_
```

---

### Parte 2: Lembretes Escalonados por Departamento

Atualmente: todos os departamentos recebem lembretes nos mesmos horários (48h, 12h, 3h).

**Nova lógica:** Escalonar os horários por departamento para evitar envios simultâneos.

Cada departamento recebe um "índice" baseado na ordem de criação. Os horários são distribuídos ciclicamente em 3 faixas:


| Faixa (índice % 3) | 1º Lembrete | 2º Lembrete |
| ------------------ | ----------- | ----------- |
| 0                  | 48h         | 16h         |
| 1                  | 36h         | 10h         |
| 2                  | 24h         | 6h          |


Se houver mais de 3 departamentos, o ciclo se repete (dept 4 = faixa 0, dept 5 = faixa 1, etc.).

**Alteração:** `supabase/functions/send-scheduled-reminders/index.ts`

- Buscar todos os departamentos ordenados por `created_at` e atribuir índice
- Gerar janelas de lembrete dinâmicas por departamento
- Ao buscar escalas, filtrar pelo departamento correspondente à janela
- Manter a tabela `schedule_reminders_sent` para evitar duplicidade (com `reminder_type` atualizado para os novos intervalos)

---

### Parte 3: Limpeza

- Remover qualquer referência ao Resend na edge function `send-contact-email`
- O secret `RESEND_API_KEY` permanece no projeto (não causa problemas) mas não será mais usado

### Arquivos Modificados

- `supabase/functions/send-contact-email/index.ts` — reescrever para WhatsApp
- `supabase/functions/send-scheduled-reminders/index.ts` — lembretes escalonados