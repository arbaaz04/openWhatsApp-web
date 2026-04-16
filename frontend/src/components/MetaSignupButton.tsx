import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const MetaSignupButton: React.FC = () => {
  const { session, teams } = useAuth();
  const [status, setStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleExchange = useCallback(async (authCode: string) => {
    setStatus('linking');
    try {
      const teamId = teams?.[0]?.teamId;
      if (!teamId) throw new Error('No team found for current user');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/auth/embedded-signup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ code: authCode, teamId }),
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Linking failed');
      
      setStatus('success');
    } catch (e) {
      console.error('Exchange Failed', e);
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [teams, session]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Validate the origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'META_AUTH_CODE') {
        handleExchange(event.data.code);
      } else if (event.data?.type === 'META_AUTH_ERROR') {
        setStatus('error');
        setError(event.data.error || 'Authentication aborted');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleExchange]);

  const handleLaunchSignup = () => {
    const appId = import.meta.env.VITE_META_APP_ID;
    if (!appId) {
      alert('Meta App ID is not configured (VITE_META_APP_ID)');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/meta-callback`;
    const scopes = 'whatsapp_business_management,whatsapp_business_messaging';
    
    const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;
    
    // Calculate popup position (centered)
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      oauthUrl,
      'MetaSignup',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (popup) {
      popup.focus();
    } else {
      alert('Popup blocked! Please allow popups for this site.');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg border border-green-200">
        <CheckCircle2 className="w-5 h-5" />
        Connected Successfully
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-red-600 font-bold bg-red-50 px-4 py-2 rounded-lg border border-red-200">
          <AlertCircle className="w-5 h-5" />
          {error || 'Linking failed'}
        </div>
        <button
          onClick={handleLaunchSignup}
          className="text-gray-500 hover:text-gray-700 text-[12px] font-bold underline px-4"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLaunchSignup}
      disabled={status === 'linking'}
      className="inline-flex items-center gap-2 bg-[#128C7E] hover:bg-[#075E54] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md group disabled:opacity-50"
    >
      {status === 'linking' ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          Connect via Meta
        </>
      )}
    </button>
  );
};
