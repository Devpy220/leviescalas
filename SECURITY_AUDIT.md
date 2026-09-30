# Auditoria de Segurança — LEVI Escalas + LeviKids
Data: 30/09/2026

## Implementado / verificado
| Item | Status |
|---|---|
| RLS em 100% das tabelas públicas | OK — todas as tabelas têm RLS ativo e ao menos uma policy (consulta ao catálogo) |
| Fotos de crianças | OK — bucket `kids-photos` privado, acesso só por link assinado de 5 min |
| Dados de crianças | OK — `kids_*` restritos a líderes/professores escalados/responsáveis |
| Secrets no frontend | OK — nenhuma chave UAZAPI/IA/pagamento no código do site; só a chave pública do backend |
| HTTPS | OK — domínio e backend servidos apenas por HTTPS; dados em repouso criptografados pela infraestrutura |
| Rate limiting | OK — `check_rate_limit` / `check_rate_limit_public` + proteção nativa de login do backend; senhas checadas contra vazamentos (HIBP) |
| Sessão | OK — isolamento por aba, tokens de 1h com renovação automática |
| Log de auditoria | NOVO — tabela `security_audit_log` grava mudanças de admin, função/bloqueio de membros, criação/exclusão de igrejas e departamentos, cadastro/edição/exclusão de crianças e líderes/professores Kids (sem PIN). Só admin lê; ninguém edita |
| Dependências | `react-router-dom` atualizado. Restantes são dependências internas de ferramentas de build (`vite-plugin-pwa`, `exceljs`, `mcp-js`) sem correção disponível do fornecedor |
| Scanner de segurança | 0 críticos, 0 altos; 4 informativos (buckets de logos/avatares públicos por design) |

## Precisa de decisão manual
1. **Pentest externo** — contratar empresa especializada; a IA não substitui.
2. **CORS restrito** — 27 funções usam `*`. Todas exigem autenticação/segredo, então o risco é baixo; restringir a leviescalas.com.br quebra o preview e webhooks. Recomendo decidir se aplica só nas funções chamadas pelo site.
3. **Alertas de login falho / exportação em volume** — o backend não expõe falhas de login para o app; exige monitoramento externo (ex.: SIEM) ou mover o login para uma função própria.
4. **Backup com teste de restauração** — backups diários são feitos pela infraestrutura; teste de restauração periódico precisa ser agendado manualmente (plano superior permite restauração pontual).
5. **Criptografia de campos específicos** (CPF, telefone) — possível, mas impede buscas; avaliar custo/benefício com jurídico.
6. **120 avisos de funções públicas** — revisados antes: necessários para convites, check-in Kids e página pública.
7. Validação jurídica de LGPD/RGPD/Ley 81.
