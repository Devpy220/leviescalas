
# Renomear Slots de Domingo

## Mudanças

Alterar o arquivo `src/lib/fixedSlots.ts`:

| De | Para |
|----|------|
| `Domingo Manhã (8h)` | `Domingo de Manhã` |
| `Domingo Noite (18h)` | `Domingo de Noite` |

## Impacto

Como os labels são centralizados neste arquivo, a mudança se propagará automaticamente para todos os locais que usam esses slots:
- Disponibilidade semanal (SlotAvailability)
- Diálogo de adicionar escala (AddScheduleDialog)
- Escala inteligente (SmartScheduleDialog)
- Visualização unificada de escalas (UnifiedScheduleView)
- Página Minhas Escalas (MySchedules)

## Observação sobre os Segundos

Os horários já estão salvos no formato `HH:mm` (ex: `08:00`, `18:00`) sem segundos. A exibição com segundos (`08:00:00`) só acontece quando os dados vêm do banco de dados - nesses casos, o código já usa `slice(0, 5)` para remover os segundos na exibição.
