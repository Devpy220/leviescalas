
Objetivos (o que você pediu)
1) “Ver demonstração” para ensinar a usar o LEVI.
2) No final, mostrar o email de suporte para cadastrar a igreja.
3) Corrigir o “Entrar” que ainda está indo direto para “minha página” (login automático), sem deixar digitar os dados.

O que encontrei no código (situação atual)
A) Demonstração
- A Landing (página “/”) já tem o botão “Ver demonstração” e abre um modal guiado (src/components/DemoTour.tsx).
- Então essa parte já existe e está funcional na página inicial.

B) Email de suporte no final
- Existe um Footer global (src/components/Footer.tsx) que aparece em várias páginas internas (Dashboard, Minhas Escalas, etc).
- A Landing tem um footer próprio (dentro de src/pages/Landing.tsx) e já mostra o email.
- O texto do Footer global hoje é genérico (“Dúvidas ou sugestões?”). Você quer explícito “para cadastrar sua igreja”.

C) Login automático (problema principal)
- A correção de “forceLogin=true” já existe no Auth.tsx (ele faz logout silencioso e evita o redirect automático).
- Porém, ainda existem botões/rotas públicas que mandam para “/auth” SEM o parâmetro forceLogin. Quando isso acontece, se a pessoa já estava logada, o Auth.tsx redireciona para /dashboard (parece “entra automático”).
- Locais críticos encontrados:
  1) Landing (src/pages/Landing.tsx): botão “Entrar” vai para “/auth” (sem forceLogin).
  2) Rotas antigas em App.tsx: “/login” e “/entrar” redirecionam para “/auth” (sem forceLogin). Se o usuário cai nessas rotas (por hábito/atalho/link salvo), dá exatamente o comportamento que você descreveu.
  3) JoinChurch (src/pages/JoinChurch.tsx): link “Já tem uma conta? Entrar” vai para “/auth?tab=login” (sem forceLogin).
- ChurchPublic (src/pages/ChurchPublic.tsx) já usa forceLogin no botão “Entrar”, mas quando existe sessão ele troca o botão por “Meu Painel”, então não dá chance de “trocar de conta” a partir dali.

Solução proposta (o que vou implementar)
1) Garantir forceLogin em TODOS os pontos públicos de “Entrar”
- Landing.tsx: trocar Link de “/auth” para “/auth?forceLogin=true”.
- JoinChurch.tsx: trocar “/auth?tab=login” para “/auth?tab=login&forceLogin=true”.
- App.tsx:
  - Alterar o redirect de “/login” para “/auth?forceLogin=true”
  - Alterar o redirect de “/entrar” para “/auth?forceLogin=true”
  - (Opcional, mas recomendado) “/admin-login” também pode redirecionar para “/auth?forceLogin=true” para evitar auto-redirect e permitir troca de conta quando alguém cai nessa rota.

2) Permitir “Trocar conta” na página pública da igreja mesmo quando já está logado
- ChurchPublic.tsx:
  - Quando existir session e estiver mostrando “Meu Painel”, adicionar um segundo botão/link “Trocar conta” que leve para:
    - `/auth?church=${slug}&forceLogin=true`
  - Assim a pessoa consegue sair e logar com outra conta sem precisar “caçar” onde deslogar.

3) Melhorar o texto do Footer para ficar claro sobre “cadastrar sua igreja”
- src/components/Footer.tsx:
  - Trocar o texto para algo do tipo:
    - “Para cadastrar sua igreja, entre em contato: suport@leviescalas.com.br”
  - Mantendo o mailto e o estilo atual.

4) Checagem rápida para confirmar que o Auth.tsx está correto (sem mudar arquitetura)
- Manter a lógica atual, mas validar que:
  - O redirect automático só ocorre quando NÃO há recovery, NÃO está carregando e NÃO está com forceLogin.
  - O logout silencioso em forceLogin acontece antes do usuário tentar digitar (hoje já acontece; com os links corrigidos, deve resolver seu caso real).

Arquivos que serão alterados
- src/pages/Landing.tsx
- src/pages/JoinChurch.tsx
- src/App.tsx
- src/pages/ChurchPublic.tsx
- src/components/Footer.tsx

Como você vai testar (passo a passo, do jeito que o problema acontece)
1) Estando logado com uma conta:
   - Ir em “/” e clicar “Entrar”:
     - Esperado: abrir a tela de login limpa (sem ir direto para dashboard), permitindo digitar email/senha de outra conta.
2) Acessar “/entrar” (ou “/login”):
   - Esperado: cair no /auth com forceLogin e ver login limpo, sem pular para “minha página”.
3) Ir para uma igreja pública “/igreja/algum-slug” estando logado:
   - Esperado: aparecer “Meu Painel” e também “Trocar conta”.
4) Conferir o rodapé nas páginas internas (Dashboard, Minhas Escalas, etc):
   - Esperado: texto explícito “Para cadastrar sua igreja…” com o email clicável.

Riscos/observações
- Se algum link externo (WhatsApp, PDF, sites) ainda apontar para “/auth” sem parâmetros, o comportamento antigo pode continuar nesses casos específicos. Depois da correção, se você me mandar um exemplo de link que ainda está “entrando automático”, eu procuro e padronizo também.
