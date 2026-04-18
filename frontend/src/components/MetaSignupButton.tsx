import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// Types for Meta SDK
interface MetaAuthResponse {
  authResponse?: {
    code: string;
    userID: string;
  };
}

interface FacebookSDK {
  init: (config: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
  login: (callback: (response: MetaAuthResponse) => void, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    FB: FacebookSDK;
    fbAsyncInit: () => void;
  }
}

export const MetaSignupButton: React.FC = () => {
  const { session, teams } = useAuth();
  const [status, setStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Store session info from WA_EMBEDDED_SIGNUP postMessage event
  const sessionInfoRef = useRef<{ waba_id: string; phone_number_id: string } | null>(null);

  const metaAppId = import.meta.env.VITE_META_APP_ID;
  const metaConfigId = import.meta.env.VITE_META_CONFIG_ID;
  const metaSdkVersion = import.meta.env.VITE_META_SDK_VERSION || 'v25.0';

  // 1. Set up message listener for WA_EMBEDDED_SIGNUP events (runs once on mount)
  useEffect(() => {
    const sessionListener = (event: MessageEvent) => {
      // Only accept messages from Facebook domains
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH') {
            const { phone_number_id, waba_id } = data.data;
            console.log('Embedded Signup FINISH — Phone:', phone_number_id, 'WABA:', waba_id);
            sessionInfoRef.current = { waba_id, phone_number_id };
          } else if (data.event === 'CANCEL') {
            console.warn('Embedded Signup cancelled at step:', data.data?.current_step);
            setStatus('idle');
          } else if (data.event === 'ERROR') {
            console.error('Embedded Signup error:', data.data?.error_message);
            setError(data.data?.error_message || 'Embedded signup error occurred');
            setStatus('error');
          }
        }
      } catch {
        // Non-JSON message, ignore
      }
    };

    window.addEventListener('message', sessionListener);
    return () => {
      window.removeEventListener('message', sessionListener);
    };
  }, []);

  // 2. Load the Facebook SDK (runs once on mount)
  useEffect(() => {
    if (window.FB) {
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: metaAppId,
        autoLogAppEvents: true,
        xfbml: true,
        version: metaSdkVersion,
      });
    };

    // Load the SDK script
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);

    return () => {
      // Don't remove SDK script on cleanup — it should persist
    };
  }, [metaAppId, metaSdkVersion]);

  // 4. Submit signup data to backend
  const submitEmbeddedSignup = useCallback(
    async (code: string, wabaId: string, phoneNumberId: string) => {
      setStatus('linking');
      setError(null);

      try {
        const teamId = teams?.[0]?.teamId;
        if (!teamId) throw new Error('No team found for current user');

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        const res = await fetch(`${apiUrl}/api/auth/embedded-signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ code, wabaId, phoneNumberId, teamId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.message ||
            data.error ||
            (res.status === 409
              ? 'This phone number is already connected to another team'
              : 'Connection failed')
          );
        }

        setStatus('success');
        setError(null);

        // Auto-refresh after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (e) {
        console.error('Token exchange failed', e);
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Unknown error occurred');
      }
    },
    [session?.access_token, teams]
  );

  // 3. FB.login callback — called when user completes the login flow
  const fbLoginCallback = useCallback(
    (response: MetaAuthResponse) => {
      if (response.authResponse) {
        const code = response.authResponse.code;

        if (!code) {
          setError('No authorization code received. Please try again.');
          setStatus('error');
          return;
        }

        // Check if we have session info from the message listener
        const sessionInfo = sessionInfoRef.current;

        if (sessionInfo && sessionInfo.waba_id && sessionInfo.phone_number_id) {
          submitEmbeddedSignup(code, sessionInfo.waba_id, sessionInfo.phone_number_id);
        } else {
          // Session info may arrive slightly after the callback — wait a moment
          setTimeout(() => {
            const delayedInfo = sessionInfoRef.current;
            if (delayedInfo && delayedInfo.waba_id && delayedInfo.phone_number_id) {
              submitEmbeddedSignup(code, delayedInfo.waba_id, delayedInfo.phone_number_id);
            } else {
              setError('WhatsApp Business Account details were not captured. Please try again.');
              setStatus('error');
            }
          }, 2000);
        }
      } else {
        setError('Login was cancelled or failed. Please try again.');
        setStatus('error');
      }
    },
    [submitEmbeddedSignup]
  );

  // 5. Launch the embedded signup flow
  const handleLaunchSignup = useCallback(() => {
    if (!window.FB) {
      setError('Facebook SDK not loaded. Please refresh the page.');
      setStatus('error');
      return;
    }

    if (!metaConfigId) {
      setError('Meta config_id is not configured (VITE_META_CONFIG_ID)');
      setStatus('error');
      return;
    }

    // Reset status and session info when starting new flow
    setStatus('idle');
    setError(null);
    sessionInfoRef.current = null;

    // Launch Facebook login with WhatsApp Embedded Signup
    window.FB.login(fbLoginCallback, {
      config_id: metaConfigId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        version: 'v3',
        setup: {
          business: {
            id: null,
            name: null,
            email: null,
            phone: {},
            website: null,
            address: {
              streetAddress1: null,
              streetAddress2: null,
              city: null,
              state: null,
              zipPostal: null,
              country: null,
            },
            timezone: null,
          },
          phone: {
            displayName: null,
            category: null,
            description: '',
          },
          solutionID: null,
          whatsAppBusinessAccount: {
            ids: null,
          },
        },
      },
    });
  }, [fbLoginCallback, metaConfigId]);

  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg border border-green-200">
        <CheckCircle2 className="w-5 h-5" />
        Connected Successfully! Reloading...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-red-600 font-bold bg-red-50 px-4 py-2 rounded-lg border border-red-200">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error || 'Connection failed'}</span>
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
