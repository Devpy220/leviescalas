import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const PRIVACY_VERSION = "2026-09-05";

export default function Privacidade() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Política de Privacidade | LEVI Escalas"
        description="Como o LEVI Escalas trata dados pessoais: finalidades, bases legais, prazos de conservação e direitos dos titulares ao abrigo do RGPD e da Lei 58/2019."
        canonical="https://leviescalas.com.br/privacidade"
      />

      <main className="flex-1 container mx-auto max-w-3xl px-4 py-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">
            Versão {PRIVACY_VERSION} · Elaborada ao abrigo do Regulamento (UE) 2016/679 (RGPD) e da Lei n.º 58/2019, de 8 de agosto.
          </p>
        </header>

        <section className="space-y-2 text-sm text-foreground leading-relaxed">
          <h2 className="text-xl font-semibold">1. Responsável pelo tratamento</h2>
          <p>
            O <strong>responsável pelo tratamento</strong> dos dados pessoais é a <strong>igreja</strong> (entidade
            religiosa) que criou o espaço no LEVI e que decide as finalidades e os meios do tratamento. Os contactos do
            responsável constam da página pública da igreja e podem ser solicitados ao líder responsável.
          </p>
          <p>
            A <strong>ELSDigital.tech</strong>, que desenvolve e mantém o LEVI Escalas e o LeviKids, atua como
            <strong> subcontratante (operador)</strong>, tratando dados apenas segundo instruções documentadas do
            responsável. Contacto: <a className="underline" href="mailto:elsdigital@elsdigital.tech">elsdigital@elsdigital.tech</a>.
          </p>
          <p>
            <strong>Encarregado de proteção de dados (EPD/DPO):</strong> quando a igreja designe um EPD, o contacto é
            divulgado pela própria igreja. Enquanto não existir designação, os pedidos podem ser dirigidos ao líder
            responsável da igreja ou ao contacto acima.
          </p>
        </section>

        <section className="space-y-2 text-sm text-foreground leading-relaxed">
          <h2 className="text-xl font-semibold">2. Finalidades, bases legais e conservação</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 font-semibold">Finalidade</th>
                  <th className="p-2 font-semibold">Base legal</th>
                  <th className="p-2 font-semibold">Categorias de dados</th>
                  <th className="p-2 font-semibold">Conservação</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-border">
                <tr>
                  <td className="p-2">Registo de voluntário e gestão de escalas</td>
                  <td className="p-2">Execução de contrato / diligências pré-contratuais</td>
                  <td className="p-2">Nome, e-mail, telefone, disponibilidade, funções</td>
                  <td className="p-2">Enquanto a conta existir + 12 meses</td>
                </tr>
                <tr>
                  <td className="p-2">Envio de mensagens por WhatsApp (avisos e comunicados)</td>
                  <td className="p-2">Consentimento (revogável a qualquer momento)</td>
                  <td className="p-2">Número de telefone, conteúdo e data das mensagens</td>
                  <td className="p-2">Registo de consentimento: 5 anos; mensagens: 12 meses</td>
                </tr>
                <tr>
                  <td className="p-2">Registo de crianças no LeviKids (check-in/check-out)</td>
                  <td className="p-2">Consentimento do titular das responsabilidades parentais</td>
                  <td className="p-2">Nome, data de nascimento, fotografia, dados do responsável</td>
                  <td className="p-2">Enquanto durar a frequência + 12 meses</td>
                </tr>
                <tr>
                  <td className="p-2">Alergias, restrições e necessidades de inclusão</td>
                  <td className="p-2">Consentimento explícito (dados de saúde, art. 9.º RGPD)</td>
                  <td className="p-2">Dados de saúde da criança</td>
                  <td className="p-2">Eliminados com o registo da criança</td>
                </tr>
                <tr>
                  <td className="p-2">Segurança, registos de acesso e prevenção de abuso</td>
                  <td className="p-2">Interesse legítimo</td>
                  <td className="p-2">Data/hora de início de sessão, dispositivo</td>
                  <td className="p-2">12 meses</td>
                </tr>
                <tr>
                  <td className="p-2">Cumprimento de obrigações legais e prova de conformidade</td>
                  <td className="p-2">Obrigação legal</td>
                  <td className="p-2">Consentimentos, pedidos de titulares</td>
                  <td className="p-2">5 anos</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2 text-sm text-foreground leading-relaxed">
          <h2 className="text-xl font-semibold">3. Direitos do titular dos dados</h2>
          <p>
            Tem direito de <strong>acesso</strong>, <strong>retificação</strong>, <strong>apagamento</strong>,
            <strong> limitação</strong>, <strong>portabilidade</strong> e <strong>oposição</strong>, bem como o direito
            de retirar o consentimento a qualquer momento, sem comprometer a licitude do tratamento anterior. Os pedidos
            são respondidos no prazo máximo de <strong>30 dias</strong>.
          </p>
          <p>
            Pode exercer estes direitos diretamente na aplicação, exportando ou apagando os seus dados:
          </p>
          <Button asChild size="sm">
            <Link to="/privacidade/meus-dados">Os meus dados e direitos</Link>
          </Button>
        </section>

        <section className="space-y-2 text-sm text-foreground leading-relaxed">
          <h2 className="text-xl font-semibold">4. Menores</h2>
          <p>
            Em Portugal, o tratamento de dados de menores de <strong>13 anos</strong> com base no consentimento exige
            autorização do titular das responsabilidades parentais. No LEVI, a conta de um menor de 13 anos só é ativada
            após confirmação do responsável através de uma ligação única enviada para o contacto indicado.
          </p>
        </section>

        <section className="space-y-2 text-sm text-foreground leading-relaxed">
          <h2 className="text-xl font-semibold">5. Subcontratantes e transferências internacionais</h2>
          <p>
            Recorremos a prestadores de serviços para alojamento da base de dados e envio de mensagens. Quando o
            alojamento ocorre fora do Espaço Económico Europeu, a transferência é feita ao abrigo das
            <strong> Cláusulas Contratuais-Tipo</strong> aprovadas pela Comissão Europeia, com medidas técnicas
            complementares (encriptação em trânsito e em repouso, controlo de acessos por políticas de segurança ao nível
            da linha). Está em curso a avaliação da migração do alojamento para região da União Europeia.
          </p>
        </section>

        <section className="space-y-2 text-sm text-foreground leading-relaxed">
          <h2 className="text-xl font-semibold">6. Segurança</h2>
          <p>
            Aplicamos autenticação com palavra-passe forte (com verificação de fugas conhecidas), autenticação em dois
            passos opcional, controlo de acesso por perfil, isolamento de dados por igreja/departamento e registo de
            acessos a dados sensíveis.
          </p>
        </section>

        <section className="space-y-2 text-sm text-foreground leading-relaxed">
          <h2 className="text-xl font-semibold">7. Reclamações</h2>
          <p>
            Sem prejuízo de outra via, pode apresentar reclamação junto da autoridade de controlo portuguesa:
            <strong> Comissão Nacional de Proteção de Dados (CNPD)</strong>, Av. D. Carlos I, 134 – 1.º, 1200-651 Lisboa,
            <a className="underline ml-1" href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">www.cnpd.pt</a>.
            No Brasil, a autoridade competente é a ANPD (<a className="underline" href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">gov.br/anpd</a>).
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
