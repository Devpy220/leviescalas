

## Plano: Sidebar Unificada e Colapsavel em Todas as Paginas

### Objetivo
Criar um sidebar unico e persistente em todas as paginas autenticadas, com estado colapsado (barra fina colorida) e expandido, e com a nova estrutura de menu solicitada.

---

### 1. Sidebar Colapsavel (DashboardSidebar refatorado)

**Estado colapsado (desktop):**
- Barra fina (~14px) com o gradiente violeta do sidebar
- Ao passar o mouse ou clicar, expande para a largura completa (w-64)
- Icones dos menus visiveis no modo colapsado (w-14) com tooltips

**Mobile:** Manter o hamburger menu atual (Sheet lateral)

**Persistencia:** Salvar estado (colapsado/expandido) no localStorage

---

### 2. Nova Estrutura de Menu

```text
+---------------------------+
|  LEVI (logo)              |
+---------------------------+
|  Meu Perfil      (User)   |  -> /dashboard (reformulado)
|  Minhas Escalas  (Cal)    |  -> /my-schedules
|  Escalas Equipe  (Users)  |  -> /my-schedules?view=team
|  Configuracoes   (Gear)   |  -> /security
|  Disponibilidade (Clock)  |  -> Abre sheet de disponibilidade
|  Mural de Avisos (Mega)   |  -> Navega ao departamento aba avisos
|  ---- Lider apenas ----   |
|  Criar Escalas   (Plus)   |  -> Navega ao departamento
+---------------------------+
|  Apoie o LEVI    (Heart)  |  -> /payment
|  Sair            (LogOut) |
+---------------------------+
```

---

### 3. Pagina "Meu Perfil" (Reformular Dashboard)

Reformular a pagina `/dashboard` para ser o "Meu Perfil":

- **Cabecalho:** Foto grande, nome, email, WhatsApp (editaveis)
- **Secao "Meus Departamentos":** Cards dos departamentos do usuario (como ja existe hoje)
- **Secao "Minha Igreja":** Nome e logo da igreja vinculada
- Manter o botao de criar departamento para lideres

O conteudo atual do Dashboard (cards de departamentos) permanece, mas agora com as informacoes pessoais em destaque no topo.

---

### 4. Adicionar Sidebar em Paginas que Nao Tem

As seguintes paginas precisam receber o sidebar:

- **Security.tsx** - Atualmente sem sidebar, apenas botao "Voltar"
- **Payment.tsx** - Atualmente sem sidebar, apenas botao "Voltar"

Ambas passarao a usar o layout `<DashboardSidebar> + <div ml-64>` como as demais.

---

### 5. Itens Contextuais (Disponibilidade / Mural / Criar Escalas)

Como esses itens sao vinculados a departamentos:

- **Disponibilidade:** Se o usuario pertence a 1 departamento, abre o sheet de disponibilidade diretamente. Se mais de 1, navega para o departamento principal.
- **Mural de Avisos:** Navega para o departamento na aba "announcements". Se mais de 1, mostra dropdown para escolher.
- **Criar Escalas (lider):** Navega para o departamento do lider na aba de escalas com acao de criar. Se lider de multiplos, mostra dropdown.

---

### Detalhes Tecnicos

**Arquivos modificados:**
1. `src/components/DashboardSidebar.tsx` - Refatorar completamente: adicionar estado colapsado/expandido, nova lista de menus, carregar departamentos do usuario internamente
2. `src/pages/Dashboard.tsx` - Adicionar secao de perfil no topo (foto, nome, email, whatsapp, igreja)
3. `src/pages/Security.tsx` - Adicionar DashboardSidebar + layout ml-64
4. `src/pages/Payment.tsx` - Adicionar DashboardSidebar + layout ml-64

**Novo hook (opcional):**
- `src/hooks/useUserDepartments.tsx` - Hook compartilhado para carregar departamentos do usuario (evitar duplicacao entre sidebar e dashboard)

**Logica de colapso:**
```text
Desktop:
- Padrão: colapsado (barra fina w-14 com icones)
- Hover ou clique: expande para w-64 com labels
- Botao toggle para fixar expandido

Mobile:
- Sem mudanca: hamburger menu com Sheet
```

**CSS necessario:**
- Transicao suave de largura (transition-all duration-300)
- No modo colapsado: apenas icones com tooltip
- No modo expandido: icones + labels (como atual)
