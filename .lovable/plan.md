

## Plano: Internacionalização (i18n) — Português, Inglês e Espanhol

### Resumo

Adicionar suporte multilíngue ao LEVI usando a biblioteca `react-i18next`. O idioma padrão será Português (BR), com opções de Inglês e Espanhol. O usuário poderá trocar o idioma via um seletor no header/sidebar.

### Escopo do trabalho

O LEVI tem **~25 arquivos** com textos hardcoded em português e referências ao locale `ptBR` do date-fns. A implementação será feita em etapas:

**1. Instalar e configurar `react-i18next`**
- Instalar `i18next`, `react-i18next`, `i18next-browser-languagedetector`
- Criar `src/i18n/index.ts` com configuração base
- Criar arquivos de tradução: `src/i18n/locales/pt.json`, `en.json`, `es.json`
- Inicializar no `main.tsx`

**2. Criar arquivos de tradução**
- Extrair todas as strings visíveis ao usuário (~300+ strings) organizadas por seção:
  - `common` (botões, labels genéricos)
  - `auth` (login, registro, recuperação)
  - `dashboard`, `departments`, `schedules`, `church`, `landing`, `notifications`, `settings`
- Traduzir para inglês e espanhol

**3. Criar componente seletor de idioma**
- Dropdown com bandeiras (🇧🇷 🇺🇸 🇪🇸) no header/navbar
- Salvar preferência no `localStorage`
- Detectar idioma do navegador automaticamente na primeira visita

**4. Migrar componentes para usar `useTranslation()`**
- Substituir strings hardcoded por `t('chave')` nos ~25 arquivos principais
- Adaptar formatação de datas (`date-fns/locale`) para trocar dinamicamente entre `ptBR`, `enUS`, `es`
- Adaptar o `LeviTypewriter` para usar texto traduzido

**5. Adaptar Edge Functions (emails/notificações)**
- Os emails enviados (escalas, anúncios, código da igreja) continuarão em português por padrão
- Opcionalmente, salvar a preferência de idioma no perfil para personalizar emails futuramente

### Arquivos principais afetados
- **Novos**: `src/i18n/index.ts`, `src/i18n/locales/pt.json`, `en.json`, `es.json`, `src/components/LanguageSelector.tsx`
- **Editados**: `src/main.tsx`, `src/App.tsx`, `src/pages/Landing.tsx`, `src/pages/Auth.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Department.tsx`, `src/pages/ChurchSetup.tsx`, `src/components/DashboardSidebar.tsx`, `src/components/LeviTypewriter.tsx`, e todos os componentes com texto visível (~20+ arquivos)

### Observações
- Nenhuma migration de banco necessária neste momento
- O idioma dos emails pode ser adaptado futuramente salvando a preferência no perfil do usuário
- A implementação será incremental — primeiro a infraestrutura, depois a migração arquivo por arquivo

