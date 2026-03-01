

## Fundo menos branco no tema claro + Datas mais visíveis nos cards de escalas

### Resumo
Ajustar o fundo do tema claro para um tom levemente lilás/lavanda (menos branco puro) e tornar as datas nos cards de escalas mais destacadas com cores e tamanhos maiores.

---

### 1. Fundo e cards menos brancos (`src/index.css`)

Alterar as variáveis CSS do tema claro:
- `--background`: de `270 50% 98%` para `270 50% 96%` (tom lavanda mais perceptível)
- `--card`: de `0 0% 100%` para `270 30% 99%` (leve toque lilás nos cards, não branco puro)
- `--popover`: idem ao card

### 2. Datas mais aparentes nos cards de escala

**`src/components/department/UnifiedScheduleView.tsx` (SlotCard, linhas 503-504):**
- Trocar `text-xs text-muted-foreground` da data para `text-sm font-semibold text-foreground` — data maior e com cor forte
- Trocar `text-xs text-muted-foreground` do horário para `text-xs font-medium text-foreground/70`

**`src/pages/MySchedules.tsx` — Cards pessoais (linhas 495-496):**
- O `dayOfWeek` já está `font-bold text-lg text-primary` (bom)
- O `dayMonth` está `text-foreground font-medium` — trocar para `text-primary font-bold text-lg` para igualar destaque

**`src/pages/MySchedules.tsx` — Cards de equipe (linhas 605-611):**
- Data: trocar `text-xs text-muted-foreground` para `text-sm font-semibold text-foreground`
- Horário: trocar `text-xs text-muted-foreground` para `text-xs font-medium text-foreground/70`

---

### Arquivos a editar

1. `src/index.css` — variáveis `--background`, `--card`, `--popover` no tema claro
2. `src/components/department/UnifiedScheduleView.tsx` — classes da data e horário no SlotCard
3. `src/pages/MySchedules.tsx` — classes da data e horário nos cards pessoais e de equipe

### Detalhes técnicos

**Cores de fundo (antes/depois):**
```text
--background: 270 50% 98%  -->  270 50% 96%
--card:       0 0% 100%    -->  270 30% 99%
--popover:    0 0% 100%    -->  270 30% 99%
```

**Data nos cards (antes/depois):**
```text
Antes:  <p className="text-xs text-muted-foreground">13 de março</p>
Depois: <p className="text-sm font-semibold text-foreground">13 de março</p>
```

