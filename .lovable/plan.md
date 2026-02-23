

## Redesign Premium dos E-mails e Paginas HTML do LEVI

Aplicar o design dark/premium que voce compartilhou em todos os templates HTML do sistema: e-mails de notificacao de escala, e-mails de broadcast, e a pagina de confirmacao de escala.

### Arquivos a Modificar

**1. `supabase/functions/send-schedule-notification/index.ts`**
- Redesign do template de **nova escala** (linhas 304-372): card dark com header gradiente indigo-violeta-rosa, secao de avatar com nome do membro, grid 2x2 com dia/dia da semana/mes/ano, linhas de departamento/setor/funcao com icones coloridos, botoes de confirmacao estilizados, footer dark
- Redesign do template de **escala alterada** (linhas 378-419): mesmo estilo dark com header em gradiente amber/laranja, mostrando data antiga vs nova no grid

**2. `supabase/functions/send-admin-broadcast/index.ts`**
- Redesign do template de e-mail de broadcast (linhas 150-163): card dark com header gradiente, badge "Comunicado Oficial", titulo e mensagem estilizados, footer LEVI

**3. `supabase/functions/confirm-schedule/index.ts`**
- Redesign da funcao `generateHtmlResponse` (linhas 173-266): pagina de resposta dark com o mesmo estilo de card, header gradiente dinamico por tipo (success/declined/error/warning/info), layout premium

### Detalhes do Design

O design segue o modelo compartilhado, adaptado para compatibilidade com clientes de e-mail:
- **Background**: escuro (#0f0f13 para body, #16161e para card)
- **Header**: gradiente 135deg de #4f46e5 (indigo) para #7c3aed (violeta) para #db2777 (rosa) -- variando por contexto
- **Badge**: pill com fundo translucido, texto uppercase com dot animado (apenas na pagina HTML, sem animacao no e-mail)
- **Avatar**: circulo gradiente com inicial do nome do usuario
- **Info Grid**: 2 colunas com icones, labels uppercase cinza (#5a5a7a), valores claros (#c8c8e0), destaques em roxo (#a78bfa)
- **Info Rows**: icone em caixa colorida (roxo/rosa/azul) + label + valor
- **Footer**: fundo mais escuro (#12121a), texto cinza, branding LEVI
- **Botoes**: gradiente indigo-violeta, border-radius 10px
- **Fontes**: system fonts (Apple, Segoe UI, Roboto) -- Google Fonts nao e confiavel em e-mail

### Adaptacoes para E-mail

Como clientes de e-mail (Gmail, Outlook) nao suportam CSS moderno:
- Todo CSS sera **inline** (atributos style)
- Layout com **tabelas** em vez de flexbox/grid
- Sem `animation`, `backdrop-filter`, `box-shadow` complexo
- Cores solidas em vez de gradientes onde necessario (fallback)
- `background-color` como fallback para `background: linear-gradient`

### Para a Pagina HTML (confirm-schedule)

Como e uma pagina web completa (nao e-mail), o design completo sera aplicado:
- Animacao slideIn do card
- Badge com dot pulsante
- Hover effects nas celulas de info
- Box-shadow completo
- Google Fonts (DM Sans, Playfair Display)

### Contextos de Cor por Tipo

| Contexto | Header Gradiente | Uso |
|---|---|---|
| Nova escala | indigo -> violeta -> rosa | E-mail de nova escala |
| Escala alterada | amber -> laranja | E-mail de alteracao |
| Broadcast | indigo -> violeta -> rosa | E-mail de comunicado |
| Confirmado | emerald -> teal | Pagina de confirmacao |
| Recusado | amber -> laranja | Pagina de recusa |
| Erro | red -> rose | Pagina de erro |
| Aviso | amber -> yellow | Pagina de aviso |
| Info | blue -> indigo | Pagina de info |

