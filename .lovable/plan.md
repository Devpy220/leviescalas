
# Contagem de Escalas por Membro

## Resumo
Adicionar uma nova funcionalidade no menu de 3 riscos (Action Menu) que permite ao líder visualizar quantas vezes cada membro da equipe está escalado, ajudando a identificar sobrecarga e distribuir melhor as escalas.

## O que será criado

### Nova tela "Resumo da Equipe"
Uma janela (Dialog/Sheet) acessível pelo menu de ações que mostra:
- Lista de todos os membros com contagem de escalas
- Indicador visual de sobrecarga (cores: verde/amarelo/vermelho)
- Ordenação por quantidade de escalas (mais escalado primeiro)
- Média de escalas por pessoa como referência

### Visual da contagem

```text
┌─────────────────────────────────────────┐
│  📊 Resumo da Equipe                    │
├─────────────────────────────────────────┤
│  Média: 4 escalas por membro            │
├─────────────────────────────────────────┤
│  👤 João Silva          ████████ 8      │  🔴
│  👤 Maria Santos        ██████   6      │  🟡
│  👤 Pedro Costa         ████     4      │  🟢
│  👤 Ana Oliveira        ████     4      │  🟢
│  👤 Lucas Pereira       ██       2      │  🟢
│  👤 Carla Souza         █        1      │  ⚪
└─────────────────────────────────────────┘
```

### Indicadores de status
- 🔴 **Vermelho**: Mais de 50% acima da média (possível sobrecarga)
- 🟡 **Amarelo**: Entre 25% e 50% acima da média (atenção)
- 🟢 **Verde**: Normal (dentro ou abaixo da média)
- ⚪ **Cinza**: Muito abaixo da média (pode receber mais escalas)

---

## Implementação Técnica

### Arquivos a criar
1. **`src/components/department/ScheduleCountDialog.tsx`**
   - Componente principal da janela de contagem
   - Recebe `schedules` e `members` como props
   - Calcula contagens e renderiza a lista

### Arquivos a modificar

2. **`src/components/department/ActionMenuContent.tsx`**
   - Adicionar novo botão "Resumo da Equipe" com ícone `BarChart2`
   - Adicionar novo action item na lista de ações

3. **`src/components/department/ActionMenuPopover.tsx`**
   - Passar nova prop `onOpenScheduleCount` para o ActionMenuContent
   - Propagar callback para abrir o dialog

4. **`src/pages/Department.tsx`**
   - Adicionar estado `showScheduleCount` para controlar visibilidade do dialog
   - Passar `schedules` e `members` para o novo componente
   - Renderizar `ScheduleCountDialog`

### Estrutura do componente ScheduleCountDialog

```text
Props:
  - open: boolean
  - onOpenChange: (open: boolean) => void
  - schedules: Schedule[]
  - members: Member[]

Lógica interna:
  1. Calcular contagem por user_id a partir de schedules
  2. Calcular média
  3. Determinar status de cada membro (sobrecarga/normal/baixo)
  4. Ordenar por contagem decrescente
  5. Renderizar lista com barras de progresso visuais
```

### Design do componente

- **Desktop**: Dialog centralizado com largura média
- **Mobile**: Sheet que sobe de baixo (Drawer)
- Barra de progresso visual usando componente `Progress` existente
- Avatar do membro ao lado do nome
- Badge colorido indicando status

---

## Fluxo do usuário

1. Líder abre o menu de 3 riscos
2. Clica no novo botão "Resumo da Equipe" (ícone de gráfico)
3. Abre a janela com a lista de membros ordenada
4. Visualiza rapidamente quem está mais/menos escalado
5. Fecha a janela e pode ajustar escalas conforme necessário

---

## Benefícios

- **Visibilidade**: Líder vê de forma clara a distribuição de escalas
- **Prevenção**: Identificar sobrecarga antes que cause problemas
- **Equidade**: Ajudar a distribuir melhor as escalas entre a equipe
- **Simplicidade**: Acesso rápido pelo menu existente
