
# Exclusividade Domingo Manha / Domingo Noite

## Resumo

Implementar bloqueio mutuo entre os turnos de Domingo de Manha (08:00-12:00) e Domingo de Noite (18:00-22:00) em tres camadas:

1. **Disponibilidade** -- ao marcar um turno de domingo, o outro e automaticamente desmarcado
2. **Escala manual** -- ao criar escala para um turno de domingo, membros ja escalados no outro turno ficam bloqueados
3. **Escala automatica (IA)** -- regra adicionada ao prompt para nunca escalar a mesma pessoa nos dois turnos do mesmo domingo

---

## Detalhes Tecnicos

### 1. SlotAvailability.tsx -- Exclusividade na marcacao de disponibilidade

Na funcao `toggleSlotAvailability`, apos marcar um turno de domingo como disponivel, automaticamente remover o turno oposto (se existir):

- Se marcou "Domingo de Manha" (dayOfWeek=0, 08:00), deletar registro de "Domingo de Noite" (dayOfWeek=0, 18:00) do mesmo periodo
- Se marcou "Domingo de Noite", deletar "Domingo de Manha"
- Exibir um aviso visual informando que os turnos de domingo sao exclusivos

### 2. AddScheduleDialog.tsx -- Bloqueio na escala manual

No `useEffect` que busca conflitos cross-departamento (linha 172-197), adicionar uma consulta extra para verificar se algum membro ja esta escalado no turno oposto de domingo na mesma data:

- Se a data selecionada e domingo e o slot e "Domingo de Manha", buscar membros ja escalados em "Domingo de Noite" naquela data (mesmo departamento)
- Marcar esses membros como bloqueados com badge "Escalado Noite" (ou "Escalado Manha")
- Adicionar ao estado `sundayConflicts` similar ao `crossDeptConflicts`

### 3. generate-smart-schedule/index.ts -- Regra no prompt da IA

Adicionar uma regra explicita na secao "REGRAS IMPORTANTES" do prompt:

```
10. EXCLUSIVIDADE DOMINGO: Um membro NAO pode ser escalado nos dois turnos de domingo 
    (Manha e Noite) no MESMO dia. Se escalou de manha, NAO escalar a noite e vice-versa.
```

### 4. Trigger no banco de dados (seguranca extra)

Criar um trigger na tabela `schedules` que rejeita insercoes quando o mesmo usuario ja tem uma escala no turno oposto de domingo na mesma data e departamento. Isso garante a regra mesmo se o frontend falhar.

```sql
CREATE OR REPLACE FUNCTION check_sunday_slot_exclusivity()
RETURNS TRIGGER AS $$
BEGIN
  -- Somente para domingos (day_of_week = 0)
  IF EXTRACT(DOW FROM NEW.date) = 0 THEN
    -- Se escalando de manha (antes de 13:00), verificar se ja tem noite
    -- Se escalando de noite (13:00+), verificar se ja tem manha
    IF NEW.time_start < '13:00:00' THEN
      IF EXISTS (
        SELECT 1 FROM schedules 
        WHERE user_id = NEW.user_id 
        AND date = NEW.date 
        AND department_id = NEW.department_id
        AND time_start >= '13:00:00'
        AND id IS DISTINCT FROM NEW.id
      ) THEN
        RAISE EXCEPTION 'Membro ja escalado no turno da noite neste domingo';
      END IF;
    ELSE
      IF EXISTS (
        SELECT 1 FROM schedules 
        WHERE user_id = NEW.user_id 
        AND date = NEW.date 
        AND department_id = NEW.department_id
        AND time_start < '13:00:00'
        AND id IS DISTINCT FROM NEW.id
      ) THEN
        RAISE EXCEPTION 'Membro ja escalado no turno da manha neste domingo';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_sunday_exclusivity
BEFORE INSERT OR UPDATE ON schedules
FOR EACH ROW EXECUTE FUNCTION check_sunday_slot_exclusivity();
```

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/department/SlotAvailability.tsx` | Auto-remover turno oposto ao marcar domingo |
| `src/components/department/AddScheduleDialog.tsx` | Consultar e bloquear membros com conflito domingo |
| `supabase/functions/generate-smart-schedule/index.ts` | Regra 10 no prompt |
| Nova migracao SQL | Trigger de exclusividade |
