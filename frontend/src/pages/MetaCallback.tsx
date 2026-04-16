import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * MetaCallback - A specialized component for the OAuth popup window.
 * It extracts the ?code= from the URL and sends it to the main window (window.opener).
 */
export const MetaCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error_description') || searchParams.get('error');

  useEffect(() => {
    // If we have a code or an error, send it to the opener
    if (window.opener) {
      if (code) {
        window.opener.postMessage({ type: 'META_AUTH_CODE', code }, window.location.origin);
      } else if (error) {
        window.opener.postMessage({ type: 'META_AUTH_ERROR', error }, window.location.origin);
      }
      
      // Close the popup after a small delay to ensure message is sent
      setTimeout(() => window.close(), 100);
    } else {
      // If no opener, just redirect to dashboard (fallback)
      window.location.href = '/dashboard';
    }
  }, [code, error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] p-6 text-center">
      <div className="w-12 h-12 border-4 border-[#128C7E] border-t-transparent rounded-full animate-spin mb-4" />
      <h2 className="text-lg font-bold text-gray-900">Connecting to Meta...</h2>
      <p className="text-gray-500 text-sm mt-2">This window will close automatically.</p>
    </div>
  );
};
