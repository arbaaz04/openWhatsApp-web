import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface Team {
  teamId: number;
  name: string;
  role: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  teams: Team[];
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        syncProfile(session.access_token);
      } else {
        setProfile(null);
        setTeams([]);
        setLoading(false);
      }
    });

    // 2. Set initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        syncProfile(session.access_token);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncProfile = async (token: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProfile(data.user);
          setTeams(data.teams);
        }
      }
    } catch (err) {
      console.error('Failed to sync profile with backend:', err);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session) await syncProfile(session.access_token);
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user: session?.user ?? null, 
      profile, 
      teams, 
      loading, 
      signInWithGoogle, 
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
