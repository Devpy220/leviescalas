## Mural de Avisos como Popup Temporario

### O que muda

O mural de avisos deixa de ser uma aba fixa e passa a funcionar como uma janela popup que aparece automaticamente no centro da tela por 15 segundos quando o membro acessa a pagina do departamento. Cada aviso fica ativo por 3 horas desde a primeira vez que aparece para aquele usuario -- depois disso, nao aparece mais como popup (mas continua acessivel na aba de avisos).

### Comportamento

1. Membro entra na pagina do departamento
2. Sistema verifica se ha avisos criados nas ultimas 3 horas que o usuario ainda nao viu como popup
3. Se houver, exibe um dialog/modal centralizado com o aviso (titulo, conteudo, autor, horario)
4. O popup fecha automaticamente apos 15 segundos, ou o usuario pode fechar manualmente
5. Se houver mais de um aviso pendente, exibe um por vez (ou lista todos no popup)
6. Apos exibido, registra no localStorage a hora da primeira exibicao -- nao mostra novamente apos 3 horas
7. colocar blur uma borda que pisca

### O que permanece igual

- A aba "Avisos" no departamento continua existindo com a lista completa
- Lideres continuam criando/editando/excluindo avisos normalmente
- O sistema de "lido/nao lido" no banco continua funcionando

### Secao Tecnica

**Novo componente: `AnnouncementPopup.tsx**`

- Recebe `departmentId` e `currentUserId`
- Ao montar, busca avisos do departamento criados nas ultimas 3 horas
- Filtra avisos ja exibidos usando localStorage (chave: `announcement_popup_{announcementId}_{userId}` com timestamp)
- Se criado ha mais de 3 horas, ignora
- Exibe em um Dialog centralizado com animacao de entrada
- Timer de 15 segundos com barra de progresso visual
- Ao fechar (manual ou auto), salva no localStorage o timestamp da exibicao

**Armazenamento local (localStorage)**

- Chave: `levi_popup_seen_{announcementId}`
- Valor: timestamp ISO da primeira exibicao
- Na verificacao: se `now() - timestamp > 3h`, nao exibe mais

**Integracao na pagina Department.tsx**

- Renderizar `AnnouncementPopup` dentro da pagina do departamento (fora das tabs)
- Props: `departmentId`, `currentUserId`

**Arquivos alterados:**

- Novo: `src/components/department/AnnouncementPopup.tsx`
- Editado: `src/pages/Department.tsx` (adicionar o componente popup)

Nenhuma alteracao no banco de dados e necessaria -- toda a logica de "3 horas ativo" e controlada pelo `created_at` do aviso + localStorage.