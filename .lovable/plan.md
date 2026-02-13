

# Melhorar Desbloqueio de Notificacoes Push e Contato Oculto

## Problema

1. **Notificacoes Push bloqueadas**: Quando o usuario bloqueia as notificacoes no navegador, a pagina mostra apenas uma mensagem de aviso sem nenhum botao de acao para ajudar a desbloquear.
2. **Contato oculto**: O Switch funciona nos dois sentidos, mas falta clareza visual -- nao ha um botao ou instrucao destacada para tornar o contato visivel novamente.

## Solucao

### 1. Notificacoes Push - Estado "bloqueado"

Quando a permissao esta como "denied":
- Adicionar um botao "Como desbloquear" que expande instrucoes passo a passo com imagens/texto de como alterar nas configuracoes do navegador
- Adicionar um botao "Tentar novamente" que tenta solicitar permissao novamente (alguns navegadores permitem re-solicitar)
- Manter a mensagem de alerta atual mas com acoes visiveis

### 2. Privacidade de Contato - Melhorar visibilidade do toggle

- Adicionar um botao explicito abaixo do Switch quando o contato esta oculto: "Tornar visivel"
- Quando o contato esta visivel, mostrar botao "Ocultar contato"
- Isso complementa o Switch, tornando a acao mais obvia para usuarios menos tecnicos

## Detalhes Tecnicos

### Arquivo modificado: `src/pages/Security.tsx`

**Push Notifications (linhas 277-288)**:
- No estado `denied`, adicionar dois botoes:
  - "Tentar novamente" -- chama `subscribePush()` que internamente faz `Notification.requestPermission()`
  - Instrucoes expandiveis com passo a passo de como desbloquear no Chrome, Firefox e Safari
- Atualizar o hook `usePushNotifications` para re-verificar o estado da permissao apos tentativa

### Arquivo modificado: `src/hooks/usePushNotifications.tsx`

- Adicionar funcao `recheckPermission` que atualiza o estado `permission` ao chamar `Notification.permission`
- Chamar `recheckPermission` quando o usuario volta a aba (evento `visibilitychange`), para detectar se ele mudou a permissao nas configuracoes do navegador

**Privacidade de Contato (linhas 222-238)**:
- Adicionar um botao de acao abaixo do toggle com texto dinamico:
  - Contato oculto: botao "Compartilhar meu contato" (estilo primario)
  - Contato visivel: botao "Ocultar meu contato" (estilo outline)
- O botao chama a mesma funcao `handlePrivacyToggle` que o Switch

