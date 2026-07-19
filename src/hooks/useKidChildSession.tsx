import { useEffect, useState } from "react";

const KEY = "levikids:child-session";

export interface KidChildSession {
  child_id: string;
  full_name: string;
  page_id: string;
  photo_path: string | null;
  birth_date: string | null;
  started_at: number;
}

const TTL_MS = 8 * 60 * 60 * 1000;

export function readChildSession(): KidChildSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KidChildSession;
    if (Date.now() - parsed.started_at > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeChildSession(s: Omit<KidChildSession, "started_at">) {
  const full: KidChildSession = { ...s, started_at: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(full));
  window.dispatchEvent(new Event("levikids:child-session-changed"));
}

export function clearChildSession() {
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("levikids:child-session-changed"));
}

export function useKidChildSession() {
  const [session, setSession] = useState<KidChildSession | null>(() => readChildSession());
  useEffect(() => {
    const handler = () => setSession(readChildSession());
    window.addEventListener("levikids:child-session-changed", handler);
    return () => window.removeEventListener("levikids:child-session-changed", handler);
  }, []);
  return { session, clear: clearChildSession };
}
