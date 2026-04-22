import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Guarantees that password recovery links always land on /auth so the reset-password
 * UI can render, even if the link opens while the user is on another route.
 */
/**
 * Detects recovery params on the current URL synchronously.
 */
function detectRecovery(search: string, hash: string) {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams((hash ?? "").replace(/^#/, ""));

  const code = searchParams.get("code");
  const queryType = searchParams.get("type");
  const accessToken = hashParams.get("access_token");
  const hashType = hashParams.get("type");

  return (
    queryType === "recovery" ||
    hashType === "recovery" ||
    !!code ||
    !!accessToken
  );
}

export function AuthRecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  // Synchronous redirect-in-progress flag: if recovery params are present
  // on a non-/auth route, perform the redirect immediately so downstream
  // guards (AdminRedirect, Landing auto-login redirect, etc.) do not fire.
  const needsRedirect =
    detectRecovery(location.search, location.hash) && location.pathname !== "/auth";

  useEffect(() => {
    if (!needsRedirect) return;

    const search = new URLSearchParams(location.search);
    search.delete('forceLogin');
    const cleanedSearch = search.toString();
    const next = `/auth${cleanedSearch ? `?${cleanedSearch}` : ''}${location.hash}`;
    navigate(next, { replace: true });
  }, [needsRedirect, location.search, location.hash, navigate]);

  return null;
}

/**
 * Synchronous helper used by guards (AdminRedirect, Landing) to bail out
 * when a password-recovery link is being processed.
 */
export function isRecoveryLinkActive() {
  if (typeof window === "undefined") return false;
  return detectRecovery(window.location.search, window.location.hash);
}
