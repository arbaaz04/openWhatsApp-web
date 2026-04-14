import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { InboxSidebar } from './components/sidebar/InboxSidebar';
import { ChatPane } from './components/chat/ChatPane';
import { Dashboard } from './components/dashboard/Dashboard';
import { PhoneNumbers } from './components/phones/PhoneNumbers';
import { ApiKeys } from './components/api/ApiKeys';
import { Flows } from './components/flows/Flows';
import { Templates } from './components/templates/Templates';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './pages/Auth';
import { ComingSoon } from './components/layout/ComingSoon';
import './index.css';

// A guard component to protect private routes
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-xl" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }
  
  if (!session) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

// A layout specifically for the Inbox section (Sidebar + right side content)
function InboxLayout() {
  return (
    <>
      <InboxSidebar />
      <Outlet />
    </>
  );
}

// A simple placeholder for when no chat is selected
function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#F8F9FA] shrink-0 border-l border-[#EDEDED]">
      <div className="w-20 h-20 bg-[#128C7E]/5 text-[#128C7E] rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-[#128C7E]/10 rotate-3">
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.397C5.28 19.467 4.5 21 4.5 21c1.554 0 3.33-.67 4.67-1.488.9.314 1.884.488 2.83.488z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2 tracking-tight italic-none">Select a conversation</h2>
      <p className="text-gray-500 text-[14px] max-w-[280px] text-center font-medium leading-relaxed opacity-80">
        Choose a conversation from the sidebar to view messages or start a new chat.
      </p>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
            
            {/* Dashboard Module */}
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Inbox Module */}
            <Route path="/" element={<InboxLayout />}>
              <Route index element={<EmptyChat />} />
              <Route path="c/:conversationId" element={<ChatPane />} />
            </Route>
            
            {/* Configuration Modules */}
            <Route path="/phones" element={<PhoneNumbers />} />
            <Route path="/api-keys" element={<ApiKeys />} />
            <Route path="/flows" element={<Flows />} />
            <Route path="/templates" element={<Templates />} />
            
            {/* Coming Soon / Placeholders */}
            <Route path="/search" element={<ComingSoon title="Search Module" />} />
            <Route path="/add-number" element={<PhoneNumbers />} />
            <Route path="/integrate" element={<ComingSoon title="Integration Hub" />} />
            <Route path="/workflows" element={<ComingSoon title="Workflows Engine" />} />
            <Route path="/functions" element={<ComingSoon title="Cloud Functions" />} />
            <Route path="/broadcasts" element={<ComingSoon title="Message Broadcasts" />} />
            <Route path="/team" element={<ComingSoon title="Team Management" />} />
            <Route path="/billing" element={<ComingSoon title="Billing & Plans" />} />
            <Route path="/help" element={<ComingSoon title="Help & Documentation" />} />
            <Route path="/profile" element={<ComingSoon title="Profile Settings" />} />
            
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
