import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithPasskey: () => Promise<{ error: string | null }>;
  registerPasskey: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasPasskey: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const PASSKEY_FLAG = "lifehub:has-passkey";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPasskey, setHasPasskey] = useState(() => localStorage.getItem(PASSKEY_FLAG) === "1");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    setUser((await supabase.auth.getUser()).data.user ?? null);
    return { error: null };
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const embeddedCheck = (forSetup: boolean): string | null => {
    if (typeof PublicKeyCredential === "undefined") return "This device or browser does not support passkeys.";
    if (window.self !== window.top) {
      return `Biometric ${forSetup ? "setup" : "unlock"} cannot run inside an embedded preview — the browser blocks fingerprint scans there. Open the app at its published address (not the preview) to ${forSetup ? "set it up" : "use it"} on this device.`;
    }
    return null;
  };

  const signInWithPasskey = async (): Promise<{ error: string | null }> => {
    const blocked = embeddedCheck(false);
    if (blocked) return { error: blocked };
    try {
      const { error } = await supabase.auth.signInWithPasskey();
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Biometric sign-in failed on this device." };
    }
  };

  const registerPasskey = async (): Promise<{ error: string | null }> => {
    const blocked = embeddedCheck(true);
    if (blocked) return { error: blocked };
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) return { error: error.message };
      localStorage.setItem(PASSKEY_FLAG, "1");
      setHasPasskey(true);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Biometric setup failed on this device." };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, loading, signUp, signIn, signInWithPasskey, registerPasskey, signOut, hasPasskey }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
