

## Plano: Sidebar Persistente no Mobile + Atalhos Centralizados + Redirect para Meu Perfil

### Resumo

Tornar o sidebar identico no mobile e desktop (sempre visivel como barra lateral, sem hamburger menu), mover acoes contextuais (Disponibilidade, Mural, etc.) para abrir como modais/sheets em vez de navegar para a pagina do departamento, e redirecionar o login sempre para `/dashboard` (Meu Perfil).

---

### 1. Sidebar Identico no Mobile

**`src/components/DashboardSidebar.tsx`**

Remover o bloco `if (isMobile)` que renderiza o header com hamburger + Sheet. No mobile, renderizar o mesmo `<aside>` fixo que o desktop, mas **sempre colapsado (w-14)** sem hover-expand (toque para expandir via overlay).

- Mobile: sidebar fixa `w-14` com icones, toque no icone de menu (ou swipe) expande para `w-64` com overlay escuro
- Desktop: manter comportamento atual (hover + pin)

**Todas as paginas:** Atualizar o margin-left para sempre ter `ml-14` (mobile e desktop), removendo a condicao `isMobile ? '' : 'ml-14'`.

---

### 2. Disponibilidade e Mural como Modais (sem navegar ao departamento)

**`src/components/DashboardSidebar.tsx`**

Alterar `handleContextualNav`:

- **Disponibilidade:** Em vez de `navigate('/departamento/slug?action=availability')`, abrir `MyAvailabilitySheet` diretamente no sidebar (importar e renderizar como Sheet/Dialog). Se multiplos departamentos, mostrar um submenu para escolher qual.
- **Mural de Avisos:** Abrir um Dialog transparente com `AnnouncementBoard` do departamento. Se multiplos, submenu para escolher.
- **Criar Escalas (lider):** Abrir `AddScheduleDialog` diretamente como modal. Se multiplos departamentos de lideranca, submenu.

Adicionar estado local no sidebar para controlar qual modal/sheet esta aberto e qual departamento foi selecionado.

---

### 3. Submenu de Departamentos

Quando o usuario pertence a mais de 1 departamento, ao clicar em Disponibilidade/Mural/Criar Escalas:

- Expandir um submenu inline no sidebar listando os departamentos
- Ao selecionar um, abre o modal/sheet correspondente
- Se apenas 1 departamento, abre direto sem submenu

---

### 4. Redirect Pos-Login para Meu Perfil

**`src/pages/Auth.tsx` e `src/pages/Landing.tsx`**

Alterar `getSmartRedirectDestination` para sempre retornar `/dashboard` em vez de `/my-schedules` quando o usuario tem 1 departamento. A logica fica:

```text
Qualquer quantidade de departamentos -> /dashboard (Meu Perfil)
```

---

### 5. Remover ActionMenuPopover da pagina Department

**`src/pages/Department.tsx`**

Como as acoes do lider agora vivem no sidebar, remover o `ActionMenuPopover` do header do departamento. Manter apenas o botao de Settings (engrenagem) que abre `DepartmentSettingsDialog` como modal.

As tabs de navegacao interna do departamento (Escalas, Disponibilidade, Membros, Mural) continuam na pagina — o sidebar apenas fornece atalhos rapidos que abrem modais.

---

### Arquivos Modificados

1. **`src/components/DashboardSidebar.tsx`** — Remover hamburger mobile, sidebar fixa w-14 no mobile, adicionar modais (MyAvailabilitySheet, AnnouncementBoard, AddScheduleDialog), submenu de departamentos
2. **`src/pages/Auth.tsx`** — `getSmartRedirectDestination` retorna sempre `/dashboard`
3. **`src/pages/Landing.tsx`** — Mesma alteracao no redirect
4. **`src/pages/Dashboard.tsx`** — Garantir `ml-14` sem condicao mobile
5. **`src/pages/Department.tsx`** — Garantir `ml-14`, remover ActionMenuPopover do header
6. **`src/pages/MySchedules.tsx`** — Garantir `ml-14`
7. **`src/pages/Security.tsx`** — Garantir `ml-14`
8. **`src/pages/Payment.tsx`** — Garantir `ml-14`
9. **`src/pages/Admin.tsx`** — Garantir `ml-14`

