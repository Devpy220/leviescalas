

## Permitir selecionar ambos os turnos de domingo na disponibilidade

### Situacao atual
Quando um membro marca "Domingo de Manha" como disponivel, o sistema automaticamente desmarca "Domingo de Noite" (e vice-versa). Isso impede que o membro sinalize que esta disponivel nos dois turnos.

### O que vai mudar
- **Disponibilidade**: O membro podera marcar ambos os turnos de domingo (manha e noite) livremente, sem bloqueio mutuo.
- **Escalas (manual e automatica)**: A regra de exclusividade continua valendo -- se o membro for escalado de manha, nao podera ser escalado a noite no mesmo domingo, e vice-versa.

### Mudanca necessaria

**Arquivo**: `src/components/department/SlotAvailability.tsx`

Remover o bloco de codigo (linhas 129-152) que faz a exclusividade mutua na marcacao de disponibilidade. Esse bloco detecta quando um slot de domingo e ativado e automaticamente deleta o turno oposto do banco de dados. Ao remover esse trecho, o toggle de cada turno de domingo funcionara de forma independente.

A mensagem de toast tambem sera simplificada, removendo a referencia ao turno oposto desmarcado.

### O que ja esta funcionando e nao precisa mudar
- **Escala manual** (`AddScheduleDialog.tsx`): Ja verifica conflitos de domingo e bloqueia membros escalados no turno oposto (linhas 200-243).
- **Escala automatica** (`generate-smart-schedule/index.ts`): Ja filtra sugestoes duplicadas de domingo no pos-processamento do servidor.
- **Trigger do banco** (`check_sunday_slot_exclusivity`): Impede insercao de escalas conflitantes no nivel do banco de dados.

