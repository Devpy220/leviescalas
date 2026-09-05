/**
 * Detecção de país por telefone (E.164) + resumo das obrigações legais
 * de privacidade e de mensageria (WhatsApp) em cada país/região.
 *
 * Uso: painel administrativo, para avisar quando alguém se cadastra
 * fora do Brasil e quais ajustes são necessários para não ter a conta
 * bloqueada / não violar a lei local.
 */

export type ComplianceRisk = 'ok' | 'atencao' | 'critico';

export interface CountryCompliance {
  /** Código ISO (informativo) */
  iso: string;
  /** Prefixo internacional sem "+" */
  dial: string;
  name: string;
  flag: string;
  /** Lei principal de proteção de dados */
  law: string;
  risk: ComplianceRisk;
  /** O que precisamos garantir para operar nesse país */
  requirements: string[];
}

/**
 * Lista dos países mais prováveis de uso. A detecção usa o prefixo mais
 * longo que casar, então códigos de 1 a 4 dígitos convivem sem conflito.
 */
export const COUNTRY_COMPLIANCE: CountryCompliance[] = [
  {
    iso: 'BR', dial: '55', name: 'Brasil', flag: '🇧🇷',
    law: 'LGPD (Lei 13.709/2018)', risk: 'ok',
    requirements: [
      'Consentimento explícito para dados de crianças (art. 14) — já coletado no LeviKids.',
      'Permitir exclusão de conta e exportação de dados.',
      'WhatsApp: envio apenas para quem aceitou receber avisos de escala.',
    ],
  },
  {
    iso: 'PT', dial: '351', name: 'Portugal', flag: '🇵🇹',
    law: 'RGPD (GDPR) + Lei 58/2019', risk: 'critico',
    requirements: [
      'Base legal registrada para cada tratamento (consentimento ou execução de contrato).',
      'Aviso de privacidade em português europeu com identificação do responsável e contato.',
      'Direito de acesso, correção, portabilidade e apagamento em até 30 dias.',
      'Dados de menores: consentimento dos titulares das responsabilidades parentais (menores de 13 anos em PT).',
      'Transferência de dados para fora da UE precisa de cláusulas contratuais-tipo (nosso banco fica fora da UE).',
      'WhatsApp: mensagens só com opt-in comprovável e link/instrução de cancelamento.',
    ],
  },
  {
    iso: 'ES', dial: '34', name: 'Espanha', flag: '🇪🇸',
    law: 'RGPD + LOPDGDD', risk: 'critico',
    requirements: [
      'Mesmas obrigações do RGPD (base legal, aviso de privacidade, direitos do titular).',
      'Consentimento parental para menores de 14 anos.',
      'Registro das atividades de tratamento.',
    ],
  },
  {
    iso: 'IT', dial: '39', name: 'Itália', flag: '🇮🇹',
    law: 'RGPD + Codice Privacy', risk: 'critico',
    requirements: ['Obrigações do RGPD.', 'Consentimento parental para menores de 14 anos.'],
  },
  {
    iso: 'FR', dial: '33', name: 'França', flag: '🇫🇷',
    law: 'RGPD + Loi Informatique et Libertés', risk: 'critico',
    requirements: ['Obrigações do RGPD.', 'Consentimento parental para menores de 15 anos.'],
  },
  {
    iso: 'DE', dial: '49', name: 'Alemanha', flag: '🇩🇪',
    law: 'RGPD + BDSG', risk: 'critico',
    requirements: [
      'Obrigações do RGPD.',
      'Impressum (identificação legal do responsável) exigido no site.',
      'Consentimento parental para menores de 16 anos.',
    ],
  },
  {
    iso: 'GB', dial: '44', name: 'Reino Unido', flag: '🇬🇧',
    law: 'UK GDPR + Data Protection Act 2018', risk: 'critico',
    requirements: [
      'Obrigações equivalentes ao RGPD.',
      'Age Appropriate Design Code para serviços usados por crianças.',
      'Consentimento parental para menores de 13 anos.',
    ],
  },
  {
    iso: 'US', dial: '1', name: 'EUA / Canadá', flag: '🇺🇸',
    law: 'COPPA (crianças) / CCPA-CPRA (Califórnia) / PIPEDA (Canadá)', risk: 'critico',
    requirements: [
      'COPPA: consentimento verificável dos pais antes de coletar dados de menores de 13 anos — inclui foto da criança.',
      'CCPA: aviso de coleta e opção "Do Not Sell/Share My Personal Information".',
      'Canadá (PIPEDA/Lei 25 do Quebec): consentimento explícito e aviso de transferência internacional.',
      'WhatsApp/SMS: opt-in por escrito e opt-out imediato (TCPA).',
    ],
  },
  {
    iso: 'AO', dial: '244', name: 'Angola', flag: '🇦🇴',
    law: 'Lei 22/11 de Proteção de Dados', risk: 'atencao',
    requirements: [
      'Consentimento do titular e finalidade declarada.',
      'Transferência internacional requer autorização da APD.',
    ],
  },
  {
    iso: 'MZ', dial: '258', name: 'Moçambique', flag: '🇲🇿',
    law: 'Lei de Transações Eletrónicas (proteção de dados)', risk: 'atencao',
    requirements: ['Consentimento e finalidade declarada.', 'Aviso de privacidade acessível.'],
  },
  {
    iso: 'PY', dial: '595', name: 'Paraguai', flag: '🇵🇾',
    law: 'Lei 6534/2020', risk: 'atencao',
    requirements: ['Consentimento informado.', 'Direito de retificação e exclusão.'],
  },
  {
    iso: 'AR', dial: '54', name: 'Argentina', flag: '🇦🇷',
    law: 'Lei 25.326', risk: 'atencao',
    requirements: ['Consentimento informado por escrito ou equivalente.', 'Direitos de acesso e supressão.'],
  },
  {
    iso: 'UY', dial: '598', name: 'Uruguai', flag: '🇺🇾',
    law: 'Lei 18.331', risk: 'atencao',
    requirements: ['Consentimento prévio e informado.', 'Registro do banco de dados na URCDP em alguns casos.'],
  },
  {
    iso: 'CL', dial: '56', name: 'Chile', flag: '🇨🇱',
    law: 'Lei 19.628 (e nova lei de dados 21.719)', risk: 'atencao',
    requirements: ['Consentimento informado.', 'Adequação à nova autoridade de dados a partir de 2026.'],
  },
  {
    iso: 'JP', dial: '81', name: 'Japão', flag: '🇯🇵',
    law: 'APPI', risk: 'atencao',
    requirements: ['Aviso de finalidade de uso.', 'Consentimento para transferência internacional.'],
  },
  {
    iso: 'AU', dial: '61', name: 'Austrália', flag: '🇦🇺',
    law: 'Privacy Act 1988 (APPs)', risk: 'atencao',
    requirements: ['Política de privacidade pública.', 'Aviso de armazenamento no exterior.'],
  },
];

const SORTED = [...COUNTRY_COMPLIANCE].sort((a, b) => b.dial.length - a.dial.length);

/** Extrai apenas dígitos de um telefone. */
export function digitsOnly(phone: string | null | undefined): string {
  return (phone || '').replace(/\D/g, '');
}

/**
 * Detecta o país a partir do telefone. Números sem código de país
 * (10/11 dígitos) são tratados como Brasil.
 */
export function detectCountry(phone: string | null | undefined): CountryCompliance | null {
  const d = digitsOnly(phone);
  if (!d) return null;
  if (d.length <= 11 && !d.startsWith('55')) {
    return COUNTRY_COMPLIANCE.find((c) => c.iso === 'BR') || null;
  }
  return SORTED.find((c) => d.startsWith(c.dial)) || null;
}

/** True quando o telefone claramente não é brasileiro. */
export function isInternational(phone: string | null | undefined): boolean {
  const c = detectCountry(phone);
  return !!c && c.iso !== 'BR';
}

export const RISK_LABEL: Record<ComplianceRisk, string> = {
  ok: 'Conforme',
  atencao: 'Atenção',
  critico: 'Ação necessária',
};
