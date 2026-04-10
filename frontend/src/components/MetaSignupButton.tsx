import React, { useEffect } from 'react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB: any;
    fbAsyncInit: () => void;
  }
}

/**
 * Meta Embedded Signup Button
 * Handles the "Coexistence" flow for WhatsApp Business API.
 */
export const MetaSignupButton: React.FC = () => {
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
    if (!window.FB) return console.error('Facebook SDK not loaded');

    // Launch the Oauth popup
    window.FB.login(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response: any) => {
        if (response.authResponse) {
          const code = response.authResponse.code;
          exchangeToken(code, 'sample-waba', 'sample-phone-id');
        } else {
          console.error('User cancelled login or did not fully authorize.');
        }
      },
      {
        config_id: import.meta.env.VITE_META_CONFIG_ID || 'dummy_config_id',
        response_type: 'code',
        override_default_response_type: true,
        feature_type: 'whatsapp_business_app_onboarding', // Crucial for coexistence logic
      }
    );
  };

  const exchangeToken = async (code: string, wabaId: string, phoneNumberId: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/embedded-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, wabaId, phoneNumberId }),
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
