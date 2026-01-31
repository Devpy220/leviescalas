

# Plano: Sistema de Troca de Escalas

## Resumo
Substituir os botões de "Confirmar/Não poderei" por um sistema de **solicitação de troca de escalas**, onde membros podem pedir para trocar seus dias com outros membros do departamento. A troca só é concluída quando ambas as partes aceitam.

## Novo Fluxo de Trabalho

```text
┌─────────────────────────────────────────────────────────────────────┐
│  MEMBRO A: Vê sua escala de Domingo e quer trocar                   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 📅 Domingo, 02 de Fevereiro - 18:00 às 22:00                   │ │
│  │ Setor: Estacionamento                                          │ │
│  │                                                                │ │
│  │ [ 🔄 Pedir Troca ]                                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO: Escolher dia para trocar                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ "Qual dia você quer trocar?"                                   │ │
│  │                                                                │ │
│  │ ┌───────────────────────────────────────────────────────────┐  │ │
│  │ │ ○ Quarta, 05/02 - Maria Santos (Som)                      │  │ │
│  │ │ ○ Domingo, 09/02 - Pedro Costa (Mídia)                    │  │ │
│  │ │ ○ Sexta, 07/02 - Ana Lima (Recepção)                      │  │ │
│  │ └───────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │ Motivo (opcional): [___________________________]               │ │
│  │                                                                │ │
│  │             [Cancelar]  [Solicitar Troca]                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  TODOS OS MEMBROS: Vêem a solicitação pendente                      │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 🔄 TROCA PENDENTE                                              │ │
│  │                                                                │ │
│  │ João quer trocar:                                              │ │
│  │ ➡️ Domingo 02/02 (18h) por Quarta 05/02 (19h)                  │ │
│  │                                                                │ │
│  │ Aguardando: Maria Santos aceitar                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  MEMBRO B (Maria): Recebe notificação e pode aceitar ou recusar     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 🔔 João Silva quer trocar de escala com você!                  │ │
│  │                                                                │ │
│  │ Troca proposta:                                                │ │
│  │ • João: Domingo 02/02 → ficará com Quarta 05/02                │ │
│  │ • Você: Quarta 05/02 → ficará com Domingo 02/02                │ │
│  │                                                                │ │
│  │     [ ❌ Recusar ]  [ ✅ Aceitar Troca ]                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Mudanças Principais

### 1. Nova Tabela no Banco de Dados

Criar tabela `schedule_swaps` para rastrear solicitações de troca:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Identificador único |
| department_id | uuid | Departamento da troca |
| requester_schedule_id | uuid | Escala do solicitante |
| target_schedule_id | uuid | Escala que quer trocar |
| requester_user_id | uuid | ID do solicitante |
| target_user_id | uuid | ID do membro alvo |
| status | enum | pending / accepted / rejected / cancelled |
| reason | text | Motivo da solicitação |
| created_at | timestamp | Data de criação |
| resolved_at | timestamp | Data de resolução |

### 2. Remover Botões de Confirmar/Não Poderei

Na página "Minhas Escalas" (`MySchedules.tsx`), substituir os botões atuais por um único botão "Pedir Troca".

### 3. Criar Componente de Diálogo de Troca

Novo componente `SwapRequestDialog.tsx`:
- Lista todas as outras escalas do departamento (de outros membros)
- Permite selecionar qual escala deseja em troca
- Campo opcional para motivo

### 4. Exibir Trocas Pendentes

Mostrar em todas as visualizações (Minhas Escalas e UnifiedScheduleView) quando há uma troca pendente para aquela escala.

### 5. Notificações

Criar notificações para:
- Quando alguém solicita trocar com você
- Quando sua troca foi aceita
- Quando sua troca foi recusada
- Quando uma troca é cancelada

---

## Detalhes Técnicos

### Migração SQL

```sql
-- Criar enum para status da troca
CREATE TYPE swap_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- Criar tabela de trocas
CREATE TABLE schedule_swaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  requester_schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  target_schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  status swap_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Habilitar RLS
ALTER TABLE schedule_swaps ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Membros do departamento podem ver trocas
CREATE POLICY "Members can view department swaps"
ON schedule_swaps FOR SELECT
USING (is_department_member(auth.uid(), department_id));

-- Usuários podem criar solicitações de troca para suas próprias escalas
CREATE POLICY "Users can create swap requests"
ON schedule_swaps FOR INSERT
WITH CHECK (requester_user_id = auth.uid());

-- Usuários podem atualizar trocas onde são o alvo (aceitar/recusar)
CREATE POLICY "Target users can respond to swaps"
ON schedule_swaps FOR UPDATE
USING (target_user_id = auth.uid() OR requester_user_id = auth.uid());

-- Solicitante pode cancelar sua própria solicitação
CREATE POLICY "Requesters can cancel own swaps"
ON schedule_swaps FOR DELETE
USING (requester_user_id = auth.uid() AND status = 'pending');
```

### Função para Executar a Troca

```sql
CREATE OR REPLACE FUNCTION execute_schedule_swap(swap_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  swap_record schedule_swaps%ROWTYPE;
  requester_schedule schedules%ROWTYPE;
  target_schedule schedules%ROWTYPE;
BEGIN
  SELECT * INTO swap_record FROM schedule_swaps WHERE id = swap_id;
  
  IF swap_record.status != 'accepted' THEN
    RAISE EXCEPTION 'Swap is not accepted';
  END IF;

  SELECT * INTO requester_schedule FROM schedules WHERE id = swap_record.requester_schedule_id;
  SELECT * INTO target_schedule FROM schedules WHERE id = swap_record.target_schedule_id;

  -- Trocar os user_ids das escalas
  UPDATE schedules SET user_id = swap_record.target_user_id 
  WHERE id = swap_record.requester_schedule_id;
  
  UPDATE schedules SET user_id = swap_record.requester_user_id 
  WHERE id = swap_record.target_schedule_id;
  
  -- Marcar troca como resolvida
  UPDATE schedule_swaps SET resolved_at = now() WHERE id = swap_id;
END;
$$;
```

### Componentes React

**Novo arquivo: `src/components/department/SwapRequestDialog.tsx`**
- Mostra lista de escalas disponíveis para troca
- Permite selecionar uma escala
- Campo de motivo
- Botão de solicitar

**Novo arquivo: `src/components/department/PendingSwapBadge.tsx`**
- Badge que aparece na escala quando há troca pendente
- Mostra quem está solicitando a troca

**Novo arquivo: `src/components/department/SwapResponseDialog.tsx`**
- Diálogo para aceitar/recusar uma troca
- Mostra detalhes da proposta

### Modificações em Arquivos Existentes

| Arquivo | Mudança |
|---------|---------|
| `src/pages/MySchedules.tsx` | Remover botões confirmar/recusar, adicionar botão "Pedir Troca" |
| `src/components/department/UnifiedScheduleView.tsx` | Mostrar indicador de trocas pendentes |
| `src/hooks/useNotifications.tsx` | Adicionar handlers para notificações de troca |

---

## Fluxo de Aceitação de Troca

1. **Membro A** solicita troca (cria registro em `schedule_swaps`)
2. **Notificação** é enviada para Membro B
3. **Membro B** vê a solicitação e pode:
   - Aceitar → executa `execute_schedule_swap()` que troca os `user_id` das escalas
   - Recusar → atualiza status para `rejected`
4. **Notificação** é enviada para Membro A com o resultado
5. **Todos** vêem as escalas atualizadas

---

## Interface Visual

### Botão de Troca (substitui confirmar/recusar)
- Ícone: 🔄 (ArrowLeftRight ou Repeat)
- Cor: Azul/Primária
- Texto: "Pedir Troca"

### Indicador de Troca Pendente
- Badge amarelo/âmbar
- Texto: "Troca pendente" ou "Aguardando resposta"

### Resposta à Troca
- Botão verde "Aceitar Troca" ✅
- Botão vermelho "Recusar" ❌

---

## Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Criar tabela `schedule_swaps` e função de troca |
| `src/pages/MySchedules.tsx` | Substituir botões por "Pedir Troca" e mostrar trocas pendentes |
| `src/components/department/SwapRequestDialog.tsx` | Novo componente para solicitar troca |
| `src/components/department/SwapResponseDialog.tsx` | Novo componente para aceitar/recusar troca |
| `src/components/department/UnifiedScheduleView.tsx` | Mostrar indicadores de troca pendente |
| `src/integrations/supabase/types.ts` | Auto-atualizado com nova tabela |

