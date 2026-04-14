import React, { useEffect } from 'react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB: any;
    fbAsyncInit: () => void;
  }
}

import { useAuth } from '../contexts/AuthContext';

/**
 * Meta Embedded Signup Button
 * Handles the "Coexistence" flow for WhatsApp Business API.
 */
export const MetaSignupButton: React.FC = () => {
  const { session } = useAuth();
  useEffect(() => {
    // Load the Facebook SDK
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: import.meta.env.VITE_META_APP_ID || 'dummy_app_id',
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v25.0',
      });
    };

    (function (d, s, id) {
      const fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) {
        return;
      }
      const js = d.createElement(s) as HTMLScriptElement;
      js.id = id;
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      fjs.parentNode?.insertBefore(js, fjs);
    })(document, 'script', 'facebook-jssdk');
  }, []);

  const handleLaunchSignup = () => {
    if (!window.FB) {
      console.error('Facebook SDK not loaded');
      alert('Facebook SDK not loaded. Please check your internet connection or ad blocker.');
      return;
    }

    // Launch the Oauth popup
    window.FB.login(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response: any) => {
        if (response.authResponse) {
          const code = response.authResponse.code;
          // In a real flow, wabaId and phoneId are often extracted from the response or predefined
          exchangeToken(code);
        } else {
          console.error('User cancelled login or did not fully authorize.');
        }
      },
      {
        config_id: import.meta.env.VITE_META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        feature_type: 'whatsapp_business_app_onboarding',
      }
    );
  };

  const exchangeToken = async (code: string) => {
    try {
      if (!session) throw new Error('Not authenticated');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/auth/embedded-signup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      console.log('Exchange Result:', data);
    } catch (e) {
      console.error('Exchange Failed', e);
    }
  };

  return (
    <button
      onClick={handleLaunchSignup}
      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
    >
      Connect WhatsApp via Meta
    </button>
  );
};
