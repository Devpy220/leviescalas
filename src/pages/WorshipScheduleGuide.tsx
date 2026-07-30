import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '@/components/SEO';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

const monthlyTemplate = `ESCALA DO MINISTÉRIO DE LOUVOR — MÊS/ANO

Domingo 06 | Manhã (09h)
  Ministro:        ____________________
  Vocal 1:         ____________________
  Vocal 2:         ____________________
  Violão:          ____________________
  Teclado:         ____________________
  Baixo:           ____________________
  Bateria:         ____________________
  Som/Projeção:    ____________________

Domingo 06 | Noite (19h)
  ... (repetir blocos por culto)

OBSERVAÇÕES
  Ensaio: quinta-feira, 20h
  Confirmação até: quarta-feira
  Substituições: avisar o líder com 48h de antecedência`;

const steps = [
  {
    title: '1. Mapeie os cultos e as funções',
    text: 'Liste todos os cultos do mês e, para cada um, as funções que precisam ser preenchidas (ministro, vocais, instrumentos, som e projeção). Escala boa começa por saber exatamente quantas vagas existem.',
  },
  {
    title: '2. Colete a disponibilidade antes de escalar',
    text: 'Peça a disponibilidade semanal fixa de cada voluntário e as datas em que ele não pode servir. Montar a escala sem isso é a principal causa de troca de última hora.',
  },
  {
    title: '3. Equilibre a carga entre os voluntários',
    text: 'Defina um número máximo de escalas por pessoa no mês. Rodízio justo evita desgaste do time e mantém os novatos envolvidos ao lado dos mais experientes.',
  },
  {
    title: '4. Publique com antecedência',
    text: 'Divulgue a escala completa até o dia 25 do mês anterior. Isso dá tempo para ensaios, ajustes e trocas combinadas sem correria.',
  },
  {
    title: '5. Confirme e lembre',
    text: 'Um lembrete 48h e outro 6h antes do culto reduz drasticamente a ausência. Ideal que a confirmação seja registrada, não apenas combinada no grupo.',
  },
  {
    title: '6. Tenha um plano de troca',
    text: 'Estabeleça uma regra: quem não pode servir busca o substituto e avisa o líder. Trocas com aprovação mútua evitam sala vazia no domingo.',
  },
];

export default function WorshipScheduleGuide() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Modelos de escala de louvor: guia prático"
        description="Guia completo para montar a escala do ministério de louvor da sua igreja, com modelo mensal pronto para copiar e 6 passos para evitar trocas de última hora."
        path="/recursos/modelos-escala-louvor"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'Como montar uma escala de louvor eficiente',
            inLanguage: 'pt-BR',
            author: { '@type': 'Organization', name: 'LEVI' },
            publisher: { '@type': 'Organization', name: 'LEVI' },
            mainEntityOfPage: 'https://leviescalas.com.br/recursos/modelos-escala-louvor',
          })}
        </script>
      </Helmet>

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-10 max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </Link>

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Como montar uma escala de louvor eficiente
        </h1>
        <p className="text-lg text-muted-foreground mb-10">
          Um roteiro em 6 passos para organizar o ministério de louvor da sua igreja,
          com um modelo de escala mensal pronto para copiar e adaptar.
        </p>

        <section className="space-y-6 mb-12">
          {steps.map((s) => (
            <article key={s.title} className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold text-lg text-foreground mb-2 flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                {s.title}
              </h2>
              <p className="text-muted-foreground">{s.text}</p>
            </article>
          ))}
        </section>

        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold text-foreground mb-3">
            Modelo de escala mensal (copie e adapte)
          </h2>
          <p className="text-muted-foreground mb-4">
            Estrutura simples que funciona em qualquer planilha ou documento. Duplique o bloco
            de cada culto conforme a agenda da sua igreja.
          </p>
          <pre className="rounded-2xl border border-border bg-muted/50 p-5 text-xs sm:text-sm text-foreground overflow-x-auto whitespace-pre">
{monthlyTemplate}
          </pre>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">
            Faça isso sem planilha
          </h2>
          <p className="text-muted-foreground mb-5">
            O LEVI coleta a disponibilidade de cada voluntário, monta a escala do mês,
            envia lembretes automáticos por WhatsApp e organiza as trocas com aprovação mútua.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/church-setup">Cadastrar minha igreja</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/tutorial">Ver como funciona</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
