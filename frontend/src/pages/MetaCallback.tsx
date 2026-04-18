import React from 'react';

/**
 * MetaCallback - Legacy fallback page (no longer needed with embedded signup)
 * 
 * With WhatsApp Embedded Signup using FB.login, the OAuth flow is handled
 * entirely within the Facebook SDK without needing a separate callback page.
 * 
 * This page remains as a fallback in case the route is accessed directly.
 */
export const MetaCallback: React.FC = () => {
  React.useEffect(() => {
    // Redirect to dashboard if someone accesses this page directly
    const timer = setTimeout(() => {
      window.location.href = '/dashboard';
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] p-6 text-center">
      <h2 className="text-lg font-bold text-gray-900">Redirecting...</h2>
      <p className="text-gray-500 text-sm mt-2">This page is no longer used with Embedded Signup.</p>
    </div>
  );
};
