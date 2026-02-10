

## Bloquear Conflito de Horario entre Departamentos

Quando um membro participa de varios departamentos, ele nao pode ser escalado no mesmo dia e horario em departamentos diferentes. O primeiro departamento que escalou prevalece; nos demais, o membro aparece como bloqueado.

---

### Como funciona hoje

Atualmente, o sistema verifica apenas blackout dates (datas bloqueadas pelo membro) e disponibilidade semanal dentro do mesmo departamento. Nao existe nenhuma verificacao cruzada entre departamentos.

### O que sera feito

**1. Criar funcao de banco de dados para verificar conflitos**

Uma funcao PostgreSQL `check_cross_department_conflicts` que recebe uma lista de user_ids, uma data, time_start e time_end, e retorna quais usuarios ja possuem escala em qualquer outro departamento naquele mesmo horario (com sobreposicao de horarios).

**2. Criar trigger de validacao no INSERT da tabela schedules**

Um trigger `before insert` na tabela `schedules` que automaticamente rejeita a insercao se o usuario ja tiver escala em outro departamento no mesmo dia com horarios sobrepostos. Isso garante protecao a nivel de banco, independente de qual fluxo criou a escala.

**3. Atualizar AddScheduleDialog (escala manual)**

- Ao selecionar data e horario, buscar conflitos cross-department para todos os membros do departamento
- Membros com conflito aparecem com aviso visual (icone de alerta + nome do departamento onde ja estao escalados)
- Membros conflitantes ficam desabilitados para selecao
- O botao "Escalar Todos" pula automaticamente membros com conflito

**4. Atualizar SmartScheduleDialog (escala automatica)**

- Na preview das sugestoes, marcar visualmente escalas com conflito detectado
- Antes de confirmar o lote, verificar conflitos e alertar o lider
- O edge function `generate-smart-schedule` recebera uma regra adicional no prompt para nao escalar membros que ja possuem escala em outros departamentos no mesmo horario

**5. Atualizar edge function generate-smart-schedule**

- Buscar todas as escalas existentes (de qualquer departamento) dos membros no periodo solicitado
- Passar essa informacao ao prompt da IA como restricao obrigatoria
- Adicionar regra: "NAO escale um membro em data/horario onde ele ja esta escalado em outro departamento"

---

### Detalhes tecnicos

**Funcao PostgreSQL - verificacao de conflitos:**

```text
check_cross_department_conflicts(
  p_user_ids UUID[],
  p_date DATE,
  p_time_start TIME,
  p_time_end TIME,
  p_exclude_department_id UUID
) RETURNS TABLE(user_id UUID, conflict_department_name TEXT)
```

Busca na tabela `schedules` JOIN `departments` onde:
- user_id esta na lista fornecida
- date = p_date
- horarios se sobrepoem (time_start < p_time_end AND time_end > p_time_start)
- department_id != p_exclude_department_id

**Trigger de validacao:**

```text
prevent_cross_department_schedule_conflict()
  BEFORE INSERT ON schedules
  FOR EACH ROW
```

Rejeita o INSERT com mensagem de erro descritiva se detectar conflito.

**UI - Indicador visual no AddScheduleDialog:**

- Badge vermelha "Conflito: [Nome do Dept]" ao lado do membro
- Checkbox desabilitado com tooltip explicativo
- Contador do "Escalar Todos" ajustado para excluir conflitantes

**Fluxo de dados:**

```text
Lider seleciona data/horario
        |
        v
Frontend chama RPC check_cross_department_conflicts
        |
        v
Membros com conflito ficam bloqueados na UI
        |
        v
Lider confirma escala (somente membros livres)
        |
        v
Trigger no banco valida novamente (seguranca extra)
        |
        v
Escala criada com sucesso
```

