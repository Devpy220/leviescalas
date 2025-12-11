/**
 * Verifica se uma senha foi encontrada em vazamentos de dados
 * usando a API Have I Been Pwned de forma segura (k-anonymity)
 */
export class PasswordBreachChecker {
  private readonly apiUrl = 'https://api.pwnedpasswords.com/range/';

  /**
   * Gera hash SHA-1 usando Web Crypto API
   */
  private async generateSHA1(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /**
   * Verifica se a senha está na lista de senhas vazadas
   */
  async isPasswordPwned(password: string): Promise<boolean> {
    try {
      const hash = await this.generateSHA1(password);
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      const response = await fetch(`${this.apiUrl}${prefix}`);
      
      if (!response.ok) {
        throw new Error('Erro ao consultar API de senhas vazadas');
      }

      const data = await response.text();
      const hashes = data.split('\n');
      
      for (const line of hashes) {
        const [hashSuffix] = line.split(':');
        if (hashSuffix?.trim() === suffix) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar senha:', error);
      return false; // Fail-open
    }
  }

  /**
   * Retorna quantas vezes a senha apareceu em vazamentos
   */
  async getPasswordBreachCount(password: string): Promise<number> {
    try {
      const hash = await this.generateSHA1(password);
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      const response = await fetch(`${this.apiUrl}${prefix}`);
      
      if (!response.ok) return 0;

      const data = await response.text();
      const hashes = data.split('\n');
      
      for (const line of hashes) {
        const [hashSuffix, count] = line.split(':');
        if (hashSuffix?.trim() === suffix) {
          return parseInt(count?.trim() || '0', 10);
        }
      }

      return 0;
    } catch (error) {
      console.error('Erro ao verificar senha:', error);
      return 0;
    }
  }
}

// Instância singleton para uso
export const passwordChecker = new PasswordBreachChecker();

/**
 * Função de validação combinada
 */
export async function validatePassword(password: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Validações de formato obrigatórias
  if (password.length < 8) {
    errors.push('Senha deve ter no mínimo 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Senha deve conter ao menos uma letra maiúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Senha deve conter ao menos uma letra minúscula');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Senha deve conter ao menos um símbolo');
  }

  // Verifica se foi vazada (só se passou nas validações básicas)
  if (errors.length === 0) {
    const isPwned = await passwordChecker.isPasswordPwned(password);
    
    if (isPwned) {
      const count = await passwordChecker.getPasswordBreachCount(password);
      const countMessage = count > 0 ? ` (encontrada ${count.toLocaleString()} vezes)` : '';
      errors.push(`Esta senha foi encontrada em vazamentos de dados${countMessage}. Por favor, escolha outra.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
