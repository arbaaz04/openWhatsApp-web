import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { deleteUserDb } from '../lib/db';

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
  const lastSyncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && session.user) {
        if (lastSyncedUserIdRef.current !== session.user.id) {
          lastSyncedUserIdRef.current = session.user.id;
          syncProfile(session.access_token, session.user);
        }
      } else {
        lastSyncedUserIdRef.current = null;
        setProfile(null);
        setTeams([]);
        setLoading(false);
      }
    });

    // 2. Set initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && session.user) {
        if (lastSyncedUserIdRef.current !== session.user.id) {
          lastSyncedUserIdRef.current = session.user.id;
          syncProfile(session.access_token, session.user);
        }
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncProfile = async (token: string, user: User) => {
    try {
      const metadata = user.user_metadata || {};
      const name = metadata.full_name || metadata.name || '';
      const avatarUrl = metadata.avatar_url || '';

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const params = new URLSearchParams();
      if (name) params.append('name', name);
      if (avatarUrl) params.append('avatarUrl', avatarUrl);

      const res = await fetch(`${apiUrl}/api/users/me?${params.toString()}`, {
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
      } else {
        // Fallback to metadata if backend fails
        setProfile({
          id: user.id,
          email: user.email || '',
          name: name || null,
          avatarUrl: avatarUrl || null,
        });
      }
    } catch (err) {
      console.error('Failed to sync profile with backend:', err);
      // Fallback
      const metadata = user.user_metadata || {};
      setProfile({
        id: user.id,
        email: user.email || '',
        name: metadata.full_name || metadata.name || null,
        avatarUrl: metadata.avatar_url || null,
      });
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const currentUserId = session?.user?.id;
    if (currentUserId) {
      try {
        await deleteUserDb(currentUserId);
      } catch (err) {
        console.error('Failed to wipe IndexedDB on signOut:', err);
      }
    }
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session && session.user) await syncProfile(session.access_token, session.user);
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
