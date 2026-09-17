import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';

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

  useEffect(() => {
    const checkBan = async (uid: string) => {
      const { data } = await supabase.from('profiles').select('is_banned').eq('id', uid).single();
      if (data?.is_banned) {
        if (typeof alert !== "undefined") {
          alert("Your account has been suspended by an administrator.");
        }
        supabase.auth.signOut();
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
      if (session?.user) {
        supabase.from('profiles').update({ updated_at: new Date().toISOString() }).eq('id', session.user.id).then();
        checkBan(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        checkBan(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    
    // Heartbeat every 30 seconds for accurate presence
    const heartbeat = setInterval(() => {
      supabase.from('profiles').update({ updated_at: new Date().toISOString() }).eq('id', session.user.id).then();
    }, 30 * 1000);

    const syncChannel = supabase.channel("app_settings_sync");
    syncChannel
      .on("broadcast", { event: "settings_updated" }, (payload: any) => {
        if (payload.payload?.userId === session.user.id && payload.payload?.isBanned) {
          if (typeof alert !== "undefined") {
            alert("Your account has been suspended by an administrator.");
          }
          supabase.auth.signOut();
        }
      })
      .subscribe();

    const profChannel = supabase.channel(`auth_prof_sync_${session.user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${session.user.id}` }, (payload: any) => {
        if (payload.new?.is_banned) {
          if (typeof alert !== "undefined") {
            alert("Your account has been suspended by an administrator.");
          }
          supabase.auth.signOut();
        }
      })
      .subscribe();

    return () => {
      clearInterval(heartbeat);
      try { supabase.removeChannel(syncChannel); } catch (e) {}
      try { supabase.removeChannel(profChannel); } catch (e) {}
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!initialized) return;

    // Check if the path/url is in the (auth) group
    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      // Redirect to the login page.
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      // Redirect away from the login page.
      router.replace('/');
    }
  }, [session, initialized, segments]);

  const signOut = () => {
    supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user || null, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
