

## Plano de Implementação

### 1. Limite de datas de bloqueio por departamento (para líderes)

**Problema:** Atualmente os voluntários podem bloquear quantas datas quiserem sem limite. O líder precisa controlar isso.

**Solução:**

**1.1 - Migração de banco de dados**
- Adicionar coluna `max_blackout_dates` (integer, default 5) na tabela `departments`
- Essa coluna define o limite maximo de datas de bloqueio que membros podem adicionar
- O líder pode editar esse valor nas configurações do departamento (minimo: 1)

**1.2 - Configurações do departamento (DepartmentSettingsDialog)**
- Adicionar campo "Limite de datas de bloqueio" no dialog de configurações
- Input numérico editável pelo líder com valor mínimo de 1
- Salvar junto com nome/descrição na tabela `departments`

**1.3 - Preferências do membro (MemberPreferences)**
- Buscar o `max_blackout_dates` do departamento ao carregar
- Impedir o voluntário de adicionar mais datas que o limite definido pelo líder
- Mostrar contador "X de Y datas usadas"
- Toast de aviso quando tentar ultrapassar o limite

---

### 2. Adicionar "Configurações" no sidebar global

**Problema:** O link para /security (Configurações) só aparece em alguns lugares. Precisa estar sempre visível no sidebar e no menu hamburger.

**Solução:**

**2.1 - DashboardSidebar**
- Adicionar item "Configurações" (icone Settings) na lista `menuItems` do sidebar, apontando para `/security`
- Vai aparecer automaticamente tanto no sidebar desktop quanto no menu hamburger (mobile), já que ambos usam o mesmo componente `SidebarContent`

---

### Detalhes Técnicos

**Migração SQL:**
```sql
ALTER TABLE departments 
ADD COLUMN max_blackout_dates integer NOT NULL DEFAULT 5;
```

**Arquivos modificados:**
1. `src/components/DashboardSidebar.tsx` - Adicionar item "Configurações" com icone Settings
2. `src/components/department/DepartmentSettingsDialog.tsx` - Adicionar campo de limite de bloqueio
3. `src/components/department/MemberPreferences.tsx` - Buscar e aplicar o limite de blackout dates do departamento

