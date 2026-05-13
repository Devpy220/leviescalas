import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";
import { supabase } from "@/integrations/supabase/client";

export const isWebAuthnSupported = () => browserSupportsWebAuthn();

export const isPlatformAuthenticatorAvailable = async () => {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
};

const guessDeviceName = () => {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone (Face ID/Touch ID)";
  if (/iPad/i.test(ua)) return "iPad (Face ID/Touch ID)";
  if (/Macintosh/i.test(ua)) return "Mac (Touch ID)";
  if (/Android/i.test(ua)) return "Android (biometria)";
  if (/Windows/i.test(ua)) return "Windows Hello";
  return "Este dispositivo";
};

export async function registerBiometric(): Promise<void> {
  const { data: opts, error } = await supabase.functions.invoke(
    "webauthn-register-options",
  );
  if (error || !opts) throw new Error(error?.message || "Falha ao iniciar cadastro");

  const credential = await startRegistration({ optionsJSON: opts });

  const { error: vErr } = await supabase.functions.invoke(
    "webauthn-register-verify",
    { body: { credential, deviceName: guessDeviceName() } },
  );
  if (vErr) throw new Error(vErr.message || "Falha ao verificar credencial");
}

export async function loginWithBiometric(email: string): Promise<void> {
  const { data: opts, error } = await supabase.functions.invoke(
    "webauthn-login-options",
    { body: { email } },
  );
  if (error || !opts) throw new Error(error?.message || "Nenhuma biometria cadastrada para este email");

  const credential = await startAuthentication({ optionsJSON: opts });

  const { data: result, error: vErr } = await supabase.functions.invoke(
    "webauthn-login-verify",
    { body: { credential, email } },
  );
  if (vErr || !result?.session) {
    throw new Error(vErr?.message || "Falha na autenticação biométrica");
  }

  const { error: setErr } = await supabase.auth.setSession({
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token,
  });
  if (setErr) throw setErr;
}
