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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
      if (session?.user) {
        supabase.from('profiles').update({ updated_at: new Date().toISOString() }).eq('id', session.user.id).then();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    
    // Heartbeat every 5 minutes
    const heartbeat = setInterval(() => {
      supabase.from('profiles').update({ updated_at: new Date().toISOString() }).eq('id', session.user.id).then();
    }, 5 * 60 * 1000);

    return () => clearInterval(heartbeat);
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
