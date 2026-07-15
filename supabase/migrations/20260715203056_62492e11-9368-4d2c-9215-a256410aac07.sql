-- Fix mutable search_path on kids_default_consent_text
CREATE OR REPLACE FUNCTION public.kids_default_consent_text()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
SELECT E'TERMO DE CONSENTIMENTO E RESPONSABILIDADE — LeviKids v1.0\n\n' ||
E'Este termo é elaborado em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD), especialmente o art. 14, e com o Estatuto da Criança e do Adolescente (Lei nº 8.069/1990 — ECA).\n\n' ||
E'1. IDENTIFICAÇÃO DO RESPONSÁVEL\nDeclaro ser maior de 18 anos e o(a) responsável legal pela(s) criança(s) que cadastrarei nesta plataforma.\n\n' ||
E'2. FINALIDADE DO TRATAMENTO DE DADOS\nAutorizo o tratamento dos dados pessoais da(s) criança(s) — nome, data de nascimento, foto, alergias, restrições e observações relevantes — exclusivamente para: (a) identificação segura no ministério infantil da igreja; (b) check-in e check-out controlados por código; (c) comunicação com o(a) responsável via WhatsApp durante o período em que a criança estiver sob os cuidados da igreja; (d) cuidado adequado quanto a alergias e restrições informadas.\n\n' ||
E'3. USO DE IMAGEM\nAs fotos cadastradas serão armazenadas em ambiente privado e criptografado, com acesso restrito ao(s) professor(es) da sala da criança durante o período de permanência e à liderança do ministério. As fotos NÃO serão publicadas em redes sociais, sites, materiais impressos ou compartilhadas com terceiros sem autorização adicional específica e por escrito.\n\n' ||
E'4. SEGURANÇA DO CHECK-OUT\nDeclaro estar ciente de que a retirada da criança somente será autorizada mediante apresentação do código pessoal de 4 dígitos gerado no ato do check-in. Comprometo-me a mantê-lo em sigilo e a não compartilhá-lo com terceiros não autorizados.\n\n' ||
E'5. MINIMIZAÇÃO DE DADOS\nNenhum dado sensível adicional (CPF, RG ou documento da criança) será coletado.\n\n' ||
E'6. DIREITOS DO TITULAR\nA qualquer momento, posso: acessar, corrigir, atualizar ou excluir os dados da(s) criança(s), inclusive as fotos, diretamente na área "Meus Dados" da plataforma. A exclusão será feita de forma definitiva e em cascata, incluindo o histórico de check-ins.\n\n' ||
E'7. COMPARTILHAMENTO\nOs dados NÃO serão compartilhados com terceiros externos à igreja. O aplicativo LEVI atua como operador dos dados conforme instrução da igreja controladora.\n\n' ||
E'8. RETENÇÃO\nOs dados serão mantidos enquanto o vínculo com o ministério infantil estiver ativo ou até que o(a) responsável solicite a exclusão.\n\n' ||
E'9. ACEITE\nAo marcar a opção de aceite, declaro ter lido, compreendido e concordado integralmente com este Termo, autorizando o tratamento dos dados nos termos aqui descritos.';
$function$;

-- Restrict kids_pages: remove anon read (public join flow uses kids_lookup_room_by_static_token)
DROP POLICY IF EXISTS "kids_pages read public" ON public.kids_pages;
REVOKE SELECT ON public.kids_pages FROM anon;