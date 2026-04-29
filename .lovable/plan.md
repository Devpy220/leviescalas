## Duas perguntas, duas respostas

---

### 1) Melhorar a mensagem de coleta de bloqueios no WhatsApp

Hoje a mensagem só pede datas para bloquear. Você quer que ela mostre cada data com **dia da semana e turno** (ex: "domingo de manhã"), e que o voluntário possa responder de duas formas:

- **Bloquear** datas específicas (ex: "bloquear 5/5")
- **Servir apenas em** datas específicas (ex: "servir 12/5, 19/5") — implícito que o resto fica bloqueado
- **Não responder** ou responder **"nenhum"** = está liberado em todos os dias

#### O que vou alterar

**a) Texto enviado em `send-blackout-collection-prompt**`

Em vez de listar datas genéricas, a mensagem vai:

- Listar os **domingos e datas-chave** do mês com o dia da semana e turno (baseado nos slots fixos do departamento — manhã/noite no domingo, terça à noite, etc.)
- Mostrar exemplo claro com as duas opções:

```
📅 LEVI — Disponibilidade de maio

Olá, João! Em 2 dias começa maio.

Estes são os dias em que você pode ser escalado:
• Dom 04/05 — manhã e/ou noite
• Dom 11/05 — manhã e/ou noite
• Dom 18/05 — manhã e/ou noite
• Dom 25/05 — manhã e/ou noite
• Ter 06/05 — noite
• (...)

Responda de uma destas formas:

🔴 Para BLOQUEAR dias:
   "bloquear 5/5, 12/5"

🟢 Para SERVIR APENAS nos dias indicados (bloqueia o resto):
   "servir 18/5, 25/5"

✅ Para liberar TODOS os dias:
   "nenhum" (ou simplesmente não responda)

Você tem até dia 31 para responder.
```

**b) Parser em `zapi-webhook-receive` (`parseBlackoutDates`)**

Adicionar detecção de palavra-chave no início da resposta:

- `bloquear`, `bloqueio`, `não posso`, `nao posso` → modo **blackout** (atual)
- `servir`, `posso`, `só`, `apenas`, `disponível em` → modo **servir-apenas**: gera blackouts para todas as datas-chave **exceto** as informadas
- Sem palavra-chave → mantém comportamento atual (assume bloqueio, como hoje)

A confirmação no WhatsApp também vai diferenciar:

- Modo bloquear: "Bloqueei: 5/5, 12/5"
- Modo servir-apenas: "Você servirá em: 18/5, 25/5. Demais dias bloqueados."

#### Arquivos afetados

- `supabase/functions/send-blackout-collection-prompt/index.ts` — usar `FIXED_SLOTS` + `member_availability` do voluntário para listar os dias reais com dia da semana e turno
- `supabase/functions/zapi-webhook-receive/index.ts` — estender `parseBlackoutDates` com modo (`block` | `serve_only`) e ajustar lógica que grava em `member_preferences.blackout_dates`
- `supabase/functions/_shared/` — possível helper compartilhado para gerar a lista de datas-chave do mês a partir dos slots de um voluntário

#### Observação importante

A mensagem ficará **mais longa**. Para departamentos com muitos slots semanais isso pode passar de 20 linhas. Posso limitar a:

- Apenas os próximos 4–5 domingos + dias da semana relevantes, OU
- Mostrar só os turnos que o voluntário tem disponibilidade ativa (não listar dias que ele já bloqueou na disponibilidade semanal)

Vou usar a **segunda opção** (mais limpa e personalizada) — só lista os dias em que ele realmente é candidato a ser escalado.

---

### 2) LEVI integrado ao site de outras igrejas — sim, já é possível

O LEVI já tem uma **página pública por igreja** funcionando hoje:

```
https://leviescalas.com.br/igreja/{slug-da-igreja}
```

Essa página mostra:

- Logo, nome e descrição da igreja
- Lista de departamentos
- Calendário unificado de escalas (sem precisar login)

**Como qualquer igreja pode integrar isso no site dela:**

**Opção A — Link direto** (já funciona, sem desenvolvimento)
A igreja coloca um botão "Ver Escalas" no site dela apontando para `https://leviescalas.com.br/igreja/{slug}`.

**Opção B — Embed via iframe** (precisa de pequeno ajuste)
Posso ajustar `ChurchPublic.tsx` para aceitar `?embed=1` (esconde header/footer/sidebar), permitindo que a igreja incorpore as escalas diretamente dentro do site dela:

```html
<iframe 
  src="https://leviescalas.com.br/igreja/minha-igreja?embed=1"
  width="100%" height="800" frameborder="0">
</iframe>
```

**Opção C — Widget JS** (maior esforço)
Um script `<script src="https://leviescalas.com.br/widget.js">` que renderiza as escalas próximas em qualquer site. Mais trabalho, mas mais flexível.

**Minha recomendação:** começar pela **Opção B** (iframe + `?embed=1`). É rápido, atende a maioria dos casos e não exige que a igreja entenda nada de programação — basta colar o iframe.

---

### O que faço agora

Vou implementar:

1. **Mensagem de bloqueio melhorada** com dia da semana + turno + modo "servir/bloquear"
2. **Modo embed** (`?embed=1`) na página pública da igreja, para integração em sites externos

Confirma os dois? Se quiser só um deles primeiro, me diga.

obs : veriicar se cada departamento tem qt e dias de bloueio respeitar isso se passar da cota de dias enviar uma msg 'falar com seu lider, dias não bloqueador " (apenas no caso de bloqueio) e não bloquear nehum  pois no departamento vc pode bloquear x dias o x representa o numero de dias que o voluntário pode bloquear