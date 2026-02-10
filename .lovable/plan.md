

# Usar Screenshots Reais na Landing Page com Nomes Borrados

## Resumo

Substituir as imagens atuais do carrossel na landing page pelos 8 screenshots reais enviados, aplicando desfoque (blur) nos nomes de pessoas visiveis para proteger a privacidade dos membros.

## Screenshots Enviados

1. Landing page (hero) - sem nomes visiveis
2. Tela de login - sem nomes visiveis
3. Minhas Escalas (pessoal) - nome "MATEUS HENRICKY" visivel
4. Escala da Equipe - varios nomes visiveis (DOUGLAS DE ANDRADE, Sergio Ricardo, etc.)
5. Disponibilidade Semanal - sem nomes visiveis
6. Minhas Preferencias - sem nomes visiveis
7. Dashboard - nome "Eduardo Lino Da Silva" e "Maranata Church" visiveis
8. Apoio Voluntario - sem nomes visiveis

## Abordagem para Borrar Nomes

Usar a API de edicao de imagens com IA (Gemini) via uma Edge Function temporaria para processar os screenshots que contem nomes (imagens 3, 4 e 7). A IA recebera cada imagem com a instrucao de borrar/censurar todos os nomes de pessoas, mantendo o restante da interface intacto. As imagens processadas serao salvas no storage.

## Detalhes Tecnicos

### 1. Copiar todos os screenshots para src/assets

Copiar os 8 arquivos enviados para `src/assets/screenshots/`:
- `screenshot-landing.png`
- `screenshot-login.png`
- `screenshot-minhas-escalas.png`
- `screenshot-escala-equipe.png`
- `screenshot-disponibilidade.png`
- `screenshot-preferencias.png`
- `screenshot-dashboard.png`
- `screenshot-apoio.png`

### 2. Processar imagens com nomes (usando IA)

Para os screenshots 3, 4 e 7 que contem nomes visiveis, usar a API de edicao de imagens do Lovable AI para aplicar desfoque nos nomes. A instrucao sera: "Blur all personal names visible in this screenshot. Keep everything else unchanged."

As imagens processadas substituirao as originais na pasta de assets.

### 3. Atualizar o carrossel na Landing.tsx

Substituir o array `screenshots` atual (3 imagens placeholder) por um novo array com os 8 screenshots reais:

```
const screenshots = [
  { src: screenshotLanding, title: 'Pagina Inicial', description: 'Design moderno e intuitivo para sua igreja' },
  { src: screenshotLogin, title: 'Acesso Seguro', description: 'Login com email, Google ou Apple' },
  { src: screenshotMinhasEscalas, title: 'Minhas Escalas', description: 'Veja suas proximas escalas e peca trocas facilmente' },
  { src: screenshotEscalaEquipe, title: 'Escala da Equipe', description: 'Visualize todos os voluntarios escalados por turno' },
  { src: screenshotDisponibilidade, title: 'Disponibilidade Semanal', description: 'Marque os horarios em que voce pode servir' },
  { src: screenshotPreferencias, title: 'Preferencias', description: 'Configure limites de escalas e datas de bloqueio' },
  { src: screenshotDashboard, title: 'Dashboard', description: 'Gerencie departamentos e escalas em um so lugar' },
  { src: screenshotApoio, title: 'Apoio Voluntario', description: '100% gratuito com recursos ilimitados' },
];
```

### 4. Remover imagens antigas

Deletar os arquivos antigos que nao serao mais usados:
- `src/assets/screenshot-calendario.jpg`
- `src/assets/screenshot-membros.jpg`
- `src/assets/screenshot-notificacoes.jpg`

## Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `src/assets/screenshots/` | Copiar e processar 8 screenshots |
| `src/pages/Landing.tsx` | Atualizar imports e array do carrossel |
| Assets antigos | Remover 3 imagens placeholder |

