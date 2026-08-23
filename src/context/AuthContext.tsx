import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Session } from "@supabase/supabase-js";
import { useRouter, useSegments } from "expo-router";

type AuthContextType = {
  session: Session | null;
  user: any | null;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({ session: null, user: null, signOut: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const presenceChannelRef = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // Join global presence channel when user logs in, leave when they log out
  useEffect(() => {
    if (!session?.user) {
      // Clean up presence channel on logout
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      return;
    }

    const userId = session.user.id;

    // Join a global presence channel so other users can detect online/offline
    const channel = supabase.channel("presence_global", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {}) // keep alive
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!initialized) return;
    const inAuthGroup = segments[0] === "auth";
    if (!session && !inAuthGroup) router.replace("/auth");
    else if (session && inAuthGroup) router.replace("/");
  }, [session, initialized, segments]);

  const signOut = () => { supabase.auth.signOut(); };

  const value = useMemo(() => ({ session, user: session?.user || null, signOut }), [session]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
