# Idioma selecionado em todo o LEVI

## Resultado esperado
- Ao escolher Português, English ou Español, todas as telas e ações do LEVI Escalas e LeviKids passam a usar o idioma escolhido, sem precisar atualizar a página.
- A escolha continua salva quando a pessoa volta ao aplicativo. Nomes de igrejas, pessoas, departamentos e textos escritos por usuários permanecem como foram cadastrados.

## Implementação
1. Fazer o seletor de idioma aparecer também nos acessos públicos, cadastro, entrada, área Kids e áreas administrativas onde ainda falta.
2. Revisar as telas por fluxo: entrada/cadastro, igrejas, perfil, escalas/departamentos, administração, privacidade e LeviKids. Traduzir títulos, botões, formulários, mensagens de erro e confirmação, notificações da interface e textos de acessibilidade.
3. Completar os dicionários dos três idiomas com as mesmas chaves e adaptar datas, números e pluralização ao idioma selecionado.
4. Validar a troca de idioma em cada fluxo principal nos dois sentidos, inclusive após navegar e recarregar. Corrigir trechos que ficarem no idioma anterior.

## Detalhes técnicos
- Reutilizar o `react-i18next` existente e a preferência `levi-language`; não traduzir dados salvos por usuários nem alterar mensagens WhatsApp ou registros no banco nesta tarefa.
- Substituir textos fixos na interface por chaves dos dicionários `pt`, `en` e `es`, mantendo comportamento e permissões atuais.
- Evitar tradução automática na tela, para não expor dados e manter termos jurídicos e de segurança revisáveis.
