## Plano: Sidebar Unificada e Colapsável - ✅ IMPLEMENTADO

### O que foi feito:

1. **Hook `useUserDepartments`** - Criado para compartilhar dados de departamentos/perfil entre sidebar e páginas
2. **DashboardSidebar refatorado** - Agora colapsável (w-14 com ícones + tooltips, expande para w-64 no hover), com nova estrutura de menu completa
3. **Novo menu**: Meu Perfil, Minhas Escalas, Escalas Equipe, Configurações, Disponibilidade, Mural de Avisos, Criar Escalas (líder), Apoie o LEVI, Sair
4. **Dashboard reformulado** como "Meu Perfil" com foto, nome e email no topo
5. **Security e Payment** agora usam o sidebar global
6. **Persistência** do estado colapsado/expandido via localStorage
7. **Mobile** mantém hamburger menu inalterado
