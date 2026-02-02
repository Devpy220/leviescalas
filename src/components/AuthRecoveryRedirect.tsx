import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Guarantees that password recovery links always land on /auth so the reset-password
 * UI can render, even if the link opens while the user is on another route.
 */
export function AuthRecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Recovery links may come in two common shapes:
    // 1) PKCE: /somewhere?code=...
    // 2) Implicit: /somewhere#access_token=...&type=recovery
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams((location.hash ?? "").replace(/^#/, ""));

    const code = searchParams.get("code");
    const queryType = searchParams.get("type");

    const accessToken = hashParams.get("access_token");
    const hashType = hashParams.get("type");

    const isRecovery =
      queryType === "recovery" ||
      hashType === "recovery" ||
      !!code ||
      !!accessToken;

    if (!isRecovery) return;
    if (location.pathname === "/auth") return;

    // If a legacy redirect added forceLogin=true, remove it for recovery.
    const search = new URLSearchParams(location.search);
    search.delete('forceLogin');
    const cleanedSearch = search.toString();
    const next = `/auth${cleanedSearch ? `?${cleanedSearch}` : ''}${location.hash}`;
    navigate(next, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}
