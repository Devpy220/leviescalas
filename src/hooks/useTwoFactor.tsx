import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TwoFactorState {
  isEnabled: boolean;
  isLoading: boolean;
  factors: any[];
}

export function useTwoFactor() {
  const { session } = useAuth();
  const [state, setState] = useState<TwoFactorState>({
    isEnabled: false,
    isLoading: true,
    factors: [],
  });

  const checkFactors = useCallback(async () => {
    try {
      if (!session) {
        setState({ isEnabled: false, isLoading: false, factors: [] });
        return;
      }

      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) {
        console.error('Error listing MFA factors:', error);
        setState({ isEnabled: false, isLoading: false, factors: [] });
        return;
      }

      const verifiedFactors = data?.totp?.filter(f => f.status === 'verified') || [];
      
      setState({
        isEnabled: verifiedFactors.length > 0,
        isLoading: false,
        factors: verifiedFactors,
      });
    } catch (error) {
      console.error('Error checking 2FA status:', error);
      setState({ isEnabled: false, isLoading: false, factors: [] });
    }
  }, [session]);

  useEffect(() => {
    checkFactors();
  }, [checkFactors]);

  const disable2FA = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      
      for (const factor of data?.totp || []) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      
      await checkFactors();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const requiresMFA = async (): Promise<boolean> => {
    try {
      if (!session) return false;

      // Check the assurance level
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (error) {
        console.error('Error getting AAL:', error);
        return false;
      }

      // If current level is aal1 but next level is aal2, MFA is required
      return data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
    } catch (error) {
      console.error('Error checking MFA requirement:', error);
      return false;
    }
  };

  return {
    ...state,
    checkFactors,
    disable2FA,
    requiresMFA,
  };
}
