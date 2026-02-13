
# Tooltips em Todos os Icones + Acesso a Seguranca em Todas as Paginas

## Resumo

Duas mudancas principais:
1. Adicionar **tooltips** (dica ao passar o mouse) em todos os botoes com icone do sistema, para que o usuario saiba o que cada icone faz
2. Adicionar os **botoes de acesso rapido a Seguranca** (2FA, Privacidade, Notificacoes Push, Telegram) em todas as paginas onde o usuario esta logado

---

## 1. Tooltips em todos os icones

Envolver cada botao de icone com o componente `Tooltip` do Radix (ja existe em `src/components/ui/tooltip.tsx`). O texto aparece ao passar o mouse ou ao segurar no mobile.

### Paginas afetadas:

| Pagina | Botoes que recebem tooltip |
|--------|---------------------------|
| Dashboard | ThemeToggle, NotificationBell, Admin, Instalar App, Minhas Escalas, Seguranca, Sair, Avatar |
| MySchedules | Voltar, ThemeToggle, NotificationBell |
| Department | Voltar, ThemeToggle, Configuracoes |
| Churches | Voltar |
| ChurchDetail | Voltar |
| CreateDepartment | Voltar |
| Security | Voltar |

Exemplo de como cada icone ficara:
```
[Icone de engrenagem] --> ao passar o mouse: "Configuracoes"
[Icone de sino] --> ao passar o mouse: "Notificacoes"
[Icone de calendario] --> ao passar o mouse: "Minhas Escalas"
```

---

## 2. Botao de Configuracoes (engrenagem) em todas as paginas autenticadas

Criar um componente reutilizavel `SettingsButton` que:
- Exibe o icone de **engrenagem** (`Settings` do lucide-react)
- Ja vem com **tooltip** "Configuracoes"
- Ao clicar, navega para `/security`

Este componente sera adicionado no header de todas as paginas autenticadas:
- Dashboard (substituindo o icone de escudo atual)
- MySchedules
- Department
- Churches
- ChurchDetail
- CreateDepartment

---

## 3. Renomear pagina Security

Mudar o titulo da pagina de "Seguranca" para "Configuracoes" ja que ela contem configuracoes de privacidade, notificacoes e Telegram alem de seguranca.

---

## Detalhes Tecnicos

### Arquivo novo: `src/components/SettingsButton.tsx`
- Componente que renderiza um `Button` com icone `Settings` dentro de um `Tooltip`
- Navega para `/security` ao clicar

### Arquivos modificados:

1. **`src/pages/Dashboard.tsx`**
   - Envolver todos os botoes de icone do header com `Tooltip`
   - Substituir botao Shield pelo `SettingsButton`
   - Adicionar `TooltipProvider` ao redor do header

2. **`src/pages/MySchedules.tsx`**
   - Adicionar `SettingsButton` no header
   - Adicionar tooltips nos botoes existentes

3. **`src/pages/Department.tsx`**
   - Adicionar `SettingsButton` no header
   - Adicionar tooltips nos botoes existentes

4. **`src/pages/Churches.tsx`**
   - Adicionar `SettingsButton` no header

5. **`src/pages/ChurchDetail.tsx`**
   - Adicionar `SettingsButton` no header

6. **`src/pages/CreateDepartment.tsx`**
   - Adicionar `SettingsButton` no header

7. **`src/pages/Security.tsx`**
   - Renomear titulo de "Seguranca" para "Configuracoes"
