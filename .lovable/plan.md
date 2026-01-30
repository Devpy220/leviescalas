
# Plano: Layout de Escalas em Colunas Horizontais

## Resumo
Transformar a visualização de escalas de uma lista vertical (um dia abaixo do outro) para um **grid horizontal de 3 colunas**, onde cada coluna representa um dia de escala com o nome do dia/data no topo e os membros escalados listados abaixo.

## Novo Design Visual

```text
┌─────────────────────────────────────────────────────────────────────┐
│  📅 Escalas de Fevereiro 2026                                       │
│  5 dias com escalas • 15 pessoas escaladas                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ DOMINGO MANHÃ    │  │ DOMINGO NOITE    │  │ QUARTA           │
│ 02 de fevereiro  │  │ 02 de fevereiro  │  │ 05 de fevereiro  │
│ 08:00 - 12:00    │  │ 18:00 - 22:00    │  │ 19:00 - 22:00    │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ 👤 João Silva    │  │ 👤 Maria Santos  │  │ 👤 Pedro Costa   │
│    Estacionamento│  │    Recepção      │  │    Som           │
│ 👤 Ana Costa     │  │ 👤 Lucas Ferreira│  │ 👤 Paulo Lima    │
│    Som           │  │    Mídia         │  │    Mídia         │
│ 👤 Carlos Lima   │  │                  │  │                  │
│    Mídia         │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐
│ SEXTA            │  │ DOMINGO MANHÃ    │
│ 07 de fevereiro  │  │ 09 de fevereiro  │
│ 19:00 - 22:00    │  │ 08:00 - 12:00    │
├──────────────────┤  ├──────────────────┤
│ 👤 Marcos Souza  │  │ 👤 Felipe Dias   │
│    Estacionamento│  │    Recepção      │
└──────────────────┘  └──────────────────┘
```

## Mudanças Principais

### 1. Estrutura de Dados
- Agrupar escalas por **slot de horário** (Domingo Manhã, Domingo Noite, Quarta, etc.) em vez de apenas por data
- Cada "coluna" representa um slot específico em uma data específica

### 2. Layout CSS
- Usar `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` para responsividade
- No mobile: 1 coluna
- Em tablets: 2 colunas
- Em desktop: 3 colunas

### 3. Card de Cada Slot
Cada card terá:
- **Cabeçalho colorido**: Nome do slot (ex: "DOMINGO MANHÃ") com cor do slot definida em `fixedSlots.ts`
- **Data**: Formato "02 de fevereiro"
- **Horário**: Ex: "08:00 - 12:00"
- **Lista de membros**: Avatar compacto + Nome + Setor + Ícone de função (Plantão/Participante)

### 4. Separação de Domingo
- Domingo Manhã e Domingo Noite serão tratados como **slots separados** no grid
- Cada um terá sua própria coluna/card

---

## Detalhes Técnicos

### Arquivo a ser modificado
`src/components/department/UnifiedScheduleView.tsx`

### Nova estrutura de agrupamento
```typescript
// Agrupar por slot (dayOfWeek + timeStart) + data
interface SlotGroup {
  date: Date;
  slotInfo: FixedSlot;
  schedules: Schedule[];
}
```

### Componente de Card do Slot
```typescript
function SlotCard({ date, slotInfo, schedules, isLeader, ... }) {
  return (
    <Card className={cn("overflow-hidden", slotInfo.bgColor)}>
      <CardHeader className="p-3 pb-2">
        <p className={cn("font-bold text-sm uppercase", slotInfo.textColor)}>
          {slotInfo.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(date, "d 'de' MMMM")} • {slotInfo.timeStart} - {slotInfo.timeEnd}
        </p>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {/* Lista compacta de membros */}
      </CardContent>
    </Card>
  );
}
```

### Grid Responsivo
```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {slotGroups.map(group => (
    <SlotCard key={`${group.date}-${group.slotInfo.id}`} {...group} />
  ))}
</div>
```

### Lista de Membros Compacta
- Avatares menores (h-8 w-8)
- Nome e setor na mesma linha
- Ícone de função (🚗 Plantão / ✅ Participante) ao lado do nome
- Status de confirmação como badge pequeno

---

## Benefícios
1. **Visualização rápida**: Ver 3 dias de uma vez facilita o planejamento
2. **Comparação**: Fácil comparar quem está escalado em diferentes dias
3. **Otimização de espaço**: Uso melhor do espaço horizontal em telas grandes
4. **Responsividade**: Adapta-se automaticamente a diferentes tamanhos de tela

---

## Arquivos Impactados
| Arquivo | Mudança |
|---------|---------|
| `src/components/department/UnifiedScheduleView.tsx` | Refatorar layout de lista vertical para grid horizontal |
