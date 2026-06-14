import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import IphoneMockup from './components/IphoneMockup';
import ChatBubble from './components/ChatBubble';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Pricing from './pages/Pricing';

const webAppUrl = 'https://app.whatflow.io';
const shopifyAppUrl = 'https://apps.shopify.com/whatflow-official-api';

export interface CtaData {
  title: string;
  body: string;
  footer: string;
  buttonText: string;
  url: string;
}
export interface ListData {
  title: string;
  body: string;
  footer: string;
  actionText: string;
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; desc: string }> }>;
}
export interface ButtonsData { title: string; body: string; footer: string; buttons: string[] }
export interface CarouselCard { id: string; image: string; body: string; buttonText: string }
export interface CarouselData { cards: CarouselCard[] }
export interface Message {
  id: string;
  sender: 'bot' | 'user';
  text?: string;
  type?: 'text' | 'cta' | 'list' | 'buttons' | 'carousel';
  data?: CtaData | ListData | ButtonsData | CarouselData;
  time: string;
}

const WfLogo = ({ size = 32, color }: { size?: number; color?: string }) => (
  <img
    src="/logo.png"
    alt="WhatFlow Logo"
    style={{ width: size, height: size, objectFit: 'contain', borderColor: color }}
    className="wf-logo-img"
  />
);


// SVGs for tracking timeline
const SingleCheck = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M3 8.5l3 3L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DoubleCheck = ({ className }: { className?: string }) => (
  <svg width="16" height="14" viewBox="0 0 20 16" fill="none" className={className}>
    <path d="M2 8.5l3 3L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 8.5l3 3L17 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);


export default function App({ page }: { page?: 'privacy' | 'terms' | 'pricing' }) {
  const [activeTab, setActiveTab] = useState<'cta' | 'list' | 'buttons' | 'carousel'>('cta');
  const [msgIdCounter, setMsgIdCounter] = useState(3);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroRevealed, setHeroRevealed] = useState(false);
  const location = useLocation();

  // Handle hash-based scrolling when navigating between routes
  useEffect(() => {
    if (location.hash) {
      // Small delay to allow DOM to render before scrolling
      setTimeout(() => {
        const el = document.querySelector(location.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location]);

  useEffect(() => {
    // Reveal hero on load
    const timer = setTimeout(() => setHeroRevealed(true), 100);

    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);

    // Setup intersection observer for scroll reveal
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('wf-revealed');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    const revealElements = document.querySelectorAll('.wf-reveal');
    revealElements.forEach((el) => observer.observe(el));

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      revealElements.forEach((el) => observer.unobserve(el));
    };
  }, [page]);

  const getMockMessages = (): Message[] => {
    const base: Message[] = [
      { id: '1', sender: 'bot', text: 'Welcome to WhatFlow! Select a component below to see live previews.', time: '10:00 AM' }
    ];
    switch (activeTab) {
      case 'cta': return [...base, { id: '2', sender: 'bot', type: 'cta', data: { title: 'Launch Your WhatsApp App', body: 'Integrate the Meta Cloud API in minutes. Check out our quickstart developer guides.', footer: 'WhatFlow API Engine', buttonText: 'Open Documentation', url: 'https://docs.whatflow.io' }, time: '10:01 AM' }];
      case 'list': return [...base, { id: '2', sender: 'bot', type: 'list', data: { title: 'Choose Your Department', body: 'Select a division below to route your conversation to the correct support team.', footer: 'Powered by WhatFlow Workflows', actionText: 'View Departments', sections: [{ title: 'Support & Tech', rows: [{ id: 'tech', title: 'Technical Support', desc: 'Resolve code, API, and webhook issues' }, { id: 'billing', title: 'Billing & Plans', desc: 'Invoices, limits, and upgrades' }] }, { title: 'Business', rows: [{ id: 'sales', title: 'Talk to Sales', desc: 'Enterprise volumes and Custom SLAs' }] }] }, time: '10:01 AM' }];
      case 'buttons': return [...base, { id: '2', sender: 'bot', type: 'buttons', data: { title: 'Quick RSVP', body: 'Are you attending the WhatFlow Developer Webinar tomorrow at 3 PM UTC?', footer: 'Event Confirmation', buttons: ['Yes, definitely', 'Maybe later', 'Send info'] }, time: '10:01 AM' }];
      case 'carousel': return [...base, { id: '2', sender: 'bot', type: 'carousel', data: { cards: [{ id: 'card1', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80', body: 'Scale with WhatsApp Cloud API', buttonText: 'View API docs' }, { id: 'card2', image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=400&q=80', body: 'Automate via Custom Webhooks', buttonText: 'View Webhooks' }] }, time: '10:01 AM' }];
      default: return base;
    }
  };

  const [simMessages, setSimMessages] = useState<Message[]>(getMockMessages());

  const handleTabChange = (tab: 'cta' | 'list' | 'buttons' | 'carousel') => {
    setActiveTab(tab);
    setMsgIdCounter(3);
    const base: Message[] = [{ id: '1', sender: 'bot', text: 'Welcome to WhatFlow! Select a component below to see live previews.', time: '10:00 AM' }];
    let newMessages = [...base];
    if (tab === 'cta') newMessages.push({ id: '2', sender: 'bot', type: 'cta', data: { title: 'Launch Your WhatsApp App', body: 'Integrate the Meta Cloud API in minutes.', footer: 'WhatFlow API Engine', buttonText: 'Open Documentation', url: 'https://docs.whatflow.io' }, time: '10:01 AM' });
    else if (tab === 'list') newMessages.push({ id: '2', sender: 'bot', type: 'list', data: { title: 'Choose Your Department', body: 'Select a division to route your conversation to the correct team.', footer: 'Powered by WhatFlow Workflows', actionText: 'View Departments', sections: [{ title: 'Support & Tech', rows: [{ id: 'tech', title: 'Technical Support', desc: 'Resolve code, API, and webhook issues' }, { id: 'billing', title: 'Billing & Plans', desc: 'Invoices, limits, and upgrades' }] }, { title: 'Business', rows: [{ id: 'sales', title: 'Talk to Sales', desc: 'Enterprise volumes and Custom SLAs' }] }] }, time: '10:01 AM' });
    else if (tab === 'buttons') newMessages.push({ id: '2', sender: 'bot', type: 'buttons', data: { title: 'Quick RSVP', body: 'Are you attending the WhatFlow Developer Webinar tomorrow at 3 PM UTC?', footer: 'Event Confirmation', buttons: ['Yes, definitely', 'Maybe later', 'Send info'] }, time: '10:01 AM' });
    else if (tab === 'carousel') newMessages.push({ id: '2', sender: 'bot', type: 'carousel', data: { cards: [{ id: 'card1', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80', body: 'Scale with WhatsApp Cloud API', buttonText: 'View API docs' }, { id: 'card2', image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=400&q=80', body: 'Automate via Custom Webhooks', buttonText: 'View Webhooks' }] }, time: '10:01 AM' });
    setSimMessages(newMessages);
  };

  const handleSimulateClick = (selectionText: string) => {
    if (simMessages.some(m => m.sender === 'user')) return;
    setSimMessages(prev => [...prev, { id: msgIdCounter.toString(), sender: 'user', text: selectionText, time: '10:02 AM' }, { id: (msgIdCounter + 1).toString(), sender: 'bot', text: `Selection received! Webhook dispatched for "${selectionText}".`, time: '10:02 AM' }]);
    setMsgIdCounter(prev => prev + 2);
  };

  return (
    <div className="wf-root">
      {/* ── NAVBAR ── */}
      <header className={`wf-header${scrolled ? ' wf-header--scrolled' : ''}`}>
        <div className="wf-nav-inner">
          <Link to="/" className="wf-logo" id="logo-link" onClick={() => window.scrollTo(0, 0)}>
            <WfLogo size={36} color="#25D366" />
            <span className="wf-logo-text">WhatFlow</span>
          </Link>

          <nav className="wf-nav-links" id="main-nav">
            <Link to="/#features" className="wf-nav-link">Features</Link>
            <Link to="/#interactive" className="wf-nav-link">Interactive Messages</Link>
            <Link to="/#developer" className="wf-nav-link">Developers</Link>
            <Link to="/pricing" className="wf-nav-link">Pricing</Link>
          </nav>

          <div className="wf-nav-actions">
            <a href={shopifyAppUrl} target="_blank" rel="noopener noreferrer" className="wf-btn wf-btn-outline" id="login-btn">Shopify App <span className="wf-arrow">›</span></a>
            <a href={webAppUrl} target="_blank" rel="noopener noreferrer" className="wf-btn wf-btn-primary" id="get-started-btn">Web App</a>
          </div>

          <button className="wf-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            <span /><span /><span />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="wf-mobile-menu">
            <Link to="/#features" className="wf-mobile-link" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link to="/#interactive" className="wf-mobile-link" onClick={() => setMobileMenuOpen(false)}>Interactive Messages</Link>
            <Link to="/#developer" className="wf-mobile-link" onClick={() => setMobileMenuOpen(false)}>Developers</Link>
            <Link to="/pricing" className="wf-mobile-link" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <a href={shopifyAppUrl} target="_blank" rel="noopener noreferrer" className="wf-btn wf-btn-outline wf-mobile-cta" style={{ marginBottom: '12px' }} onClick={() => setMobileMenuOpen(false)}>Shopify App</a>
            <a href={webAppUrl} target="_blank" rel="noopener noreferrer" className="wf-btn wf-btn-primary wf-mobile-cta" onClick={() => setMobileMenuOpen(false)}>Web App</a>
          </div>
        )}
      </header>

      {!page ? (
        <>
          {/* ── HERO SECTION ── */}
          <section className="wf-hero" id="hero">
        <div className="wf-hero-image-wrap">
          <img src="/hero.png" alt="WhatFlow — WhatsApp Business Platform" className="wf-hero-img" />
          <div className="wf-hero-overlay" />
        </div>

        <div className="wf-hero-content">
          <h1 className={`wf-hero-title wf-reveal ${heroRevealed ? 'wf-revealed' : ''}`}>
            Automate your<br />
            WhatsApp Business
          </h1>
          <p className={`wf-hero-sub wf-reveal ${heroRevealed ? 'wf-revealed' : ''}`} style={{ transitionDelay: '0.1s' }}>
            The developer-first platform to build interactive flows, run a shared team inbox, and automate WhatsApp conversations at scale.
          </p>
          <div className={`wf-hero-btns wf-reveal ${heroRevealed ? 'wf-revealed' : ''}`} style={{ transitionDelay: '0.2s', display: 'flex', gap: '16px' }}>
            <a href={webAppUrl} target="_blank" rel="noopener noreferrer" className="wf-btn wf-btn-primary wf-btn-lg" id="hero-cta-web">
              Web App
            </a>
            <a href={shopifyAppUrl} target="_blank" rel="noopener noreferrer" className="wf-btn wf-btn-outline wf-btn-lg" id="hero-cta-shopify">
              Shopify App <span className="wf-arrow">›</span>
            </a>
          </div>
          <p className={`wf-hero-fine wf-reveal ${heroRevealed ? 'wf-revealed' : ''}`} style={{ transitionDelay: '0.3s' }}>* No credit card required. Free tier available.</p>
        </div>

        <div className="wf-hero-bubbles">
          <div
            className={`wf-hero-bubble-wrap wf-reveal ${heroRevealed ? 'wf-revealed' : ''}`}
            style={{ transitionDelay: '0.2s' }}
          >
            <div className="wf-hero-bubble-inner bubble-float-1">
              <ChatBubble
                sender="WhatFlow"
                text={"Hi John! Your order #12345 is now out for delivery. Tracking link:\nwhatflow.io/track"}
                time="12:00 PM"
                direction="out"
                className="wf-hero-bubble"
              />
            </div>
          </div>

          <div
            className={`wf-hero-bubble-wrap wf-reveal ${heroRevealed ? 'wf-revealed' : ''}`}
            style={{ transitionDelay: '0.5s' }}
          >
            <div className="wf-hero-bubble-inner bubble-float-2">
              <ChatBubble
                sender="John"
                text="Great, thanks! Can I get an ETA?"
                time="12:01 PM"
                direction="in"
                className="wf-hero-bubble"
              />
            </div>
          </div>

          <div
            className={`wf-hero-bubble-wrap wf-reveal ${heroRevealed ? 'wf-revealed' : ''}`}
            style={{ transitionDelay: '0.8s' }}
          >
            <div className="wf-hero-bubble-inner bubble-float-3">
              <ChatBubble
                sender="WhatFlow"
                text="Estimated delivery is by 3:00 PM today. 👍"
                time="12:01 PM"
                direction="out"
                className="wf-hero-bubble"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FLOATING CHAT BUBBLES / TAGLINE STRIP ── */}
      <section className="wf-bubbles-section">
        <h2 className="wf-bubbles-headline wf-reveal">
          Keep your customers close, no matter where they are.
        </h2>
        <div className="wf-floating-bubbles" aria-hidden="true">
          <div className="wf-float-item wf-float-1 wf-reveal wf-reveal-delay-1">
            <div className="wf-float-inner wf-float-inner-1">
              <img className="wf-float-avatar" src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&h=120&q=80" alt="Professional Client Jane" />
              <ChatBubble direction="in" text="Order confirmed!" time="11:59" className="wf-tagline-bubble" />
            </div>
          </div>
          <div className="wf-float-item wf-float-2 wf-reveal wf-reveal-delay-2">
            <div className="wf-float-inner wf-float-inner-2">
              <img className="wf-float-avatar" src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=120&h=120&q=80" alt="Professional Client Sam" />
              <ChatBubble direction="in" text="Support ticket resolved" time="12:04" className="wf-tagline-bubble" />
            </div>
          </div>
          <div className="wf-float-item wf-float-3 wf-reveal wf-reveal-delay-3">
            <div className="wf-float-inner wf-float-inner-3">
              <img className="wf-float-avatar" src="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&h=120&q=80" alt="Professional Client Alisha" />
              <ChatBubble direction="in" text="Your delivery is on the way!" time="12:07" className="wf-tagline-bubble" />
            </div>
          </div>
          <div className="wf-float-item wf-float-4 wf-reveal wf-reveal-delay-4">
            <div className="wf-float-inner wf-float-inner-4">
              <img className="wf-float-avatar" src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=120&h=120&q=80" alt="Professional Client Nathan" />
              <ChatBubble direction="in" text="New lead captured" time="12:10" className="wf-tagline-bubble" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES: Team Inbox ── */}
      <section id="features" className="wf-feature-section wf-feature-light">
        <div className="wf-feature-inner wf-feature-left">
          <div className="wf-feature-text wf-reveal">
            <h2 className="wf-feature-title">Never miss a message<br />with your shared inbox</h2>
            <p className="wf-feature-desc">
              Multiple agents, one number. Route conversations to the right team, leave internal notes, and resolve customer queries faster than ever.
            </p>
          </div>
          <div className="wf-feature-visual wf-reveal wf-reveal-delay-2">
            <div className="wf-image-card">
              <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&h=450&q=80" alt="Team Inbox" className="wf-card-photo" />
              <ChatBubble direction="in" sender="Customer" text="Hi, I need help with my order" time="11:55 AM" className="wf-float-bubble-in" />
              <ChatBubble direction="out" sender="Sarah (Agent)" text="I've updated your shipment tracking!" time="11:56 AM" className="wf-float-bubble-out" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES: Voice & Automation ── */}
      <section className="wf-feature-section wf-feature-light">
        <div className="wf-feature-inner wf-feature-right">
          <div className="wf-feature-visual wf-reveal">
            <div className="wf-image-card">
              <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&h=450&q=80" alt="Conversation Automation" className="wf-card-photo" />
              <ChatBubble direction="in" sender="Customer" text="What are your hours today?" time="10:15 AM" className="wf-float-bubble-in-auto" />
              <ChatBubble direction="out" sender="Bot" text="We're open until 6:00 PM! 🕒" time="10:15 AM" className="wf-float-bubble-out-auto" />
            </div>
          </div>
          <div className="wf-feature-text wf-reveal wf-reveal-delay-2">
            <h2 className="wf-feature-title">Automate conversations<br />with powerful flows</h2>
            <p className="wf-feature-desc">
              Build no-code automation workflows. Trigger actions on keywords, route messages to the right team, and connect to your existing CRM via webhooks.
            </p>
          </div>
        </div>
      </section>

      {/* ── DARK SECTION: End-to-End Security ── */}
      <section className="wf-dark-section">
        <div className="wf-dark-inner">
          <div className="wf-dark-visual wf-reveal">
            <svg width="180" height="180" viewBox="0 0 120 120" fill="none" className="wf-premium-lock-svg">
              {/* Ripple circle behind the lock */}
              <circle className="wf-lock-ripple-circle" cx="60" cy="76" r="10" stroke="var(--color-whatsapp-green)" strokeWidth="1.5" opacity="0" fill="none" />
              
              {/* Shackle */}
              <path className="wf-lock-shackle-path" d="M 40 48 V 30 A 20 20 0 0 1 80 30 V 48" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
              
              {/* Lock Body */}
              <rect className="wf-lock-body-rect" x="22" y="46" width="76" height="54" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="currentColor" strokeWidth="2.5" />
              
              {/* Checkmark inside body */}
              <path className="wf-lock-check-path" d="M 46 73 L 55 82 L 74 62" stroke="var(--color-whatsapp-green)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <div className="wf-dark-text wf-reveal wf-reveal-delay-2">
            <h2 className="wf-dark-title">
              Your data stays <span className="wf-green-text">private</span>
            </h2>
            <p className="wf-dark-desc">
              WhatFlow is built on top of the official Meta WhatsApp Business Cloud API. All messages are end-to-end encrypted. Your customer data is never sold or shared. Only your team sees your conversations.
            </p>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE DEMO SECTION ── */}
      <section id="interactive" className="wf-feature-section wf-feature-light">
        <div className="wf-section-header wf-reveal">
          <h2 className="wf-section-title">Experience WhatsApp<br />Interactive Elements</h2>
          <p className="wf-section-desc">Click through the components to see how WhatFlow renders interactive templates inside the WhatsApp client.</p>
        </div>

        <div className="wf-simulator-wrap wf-reveal wf-reveal-delay-2">
          <div className="wf-sim-controls">
            {([
              { key: 'cta', num: 1, title: 'CTA URL Link Message', desc: 'Add official links that drive customers directly to a website or document.' },
              { key: 'list', num: 2, title: 'Interactive List Menu', desc: 'Provide up to 10 options organized in sections for routing or choice.' },
              { key: 'buttons', num: 3, title: 'Quick Reply Buttons', desc: 'Display up to 3 quick response pills to guide conversation flows.' },
              { key: 'carousel', num: 4, title: 'Media Carousel', desc: 'Combine images, descriptions, and buttons into a rich scrolling component.' },
            ] as const).map(({ key, num, title, desc }) => (
              <button
                key={key}
                className={`wf-sim-btn${activeTab === key ? ' wf-sim-btn--active' : ''}`}
                onClick={() => handleTabChange(key)}
                id={`sim-btn-${key}`}
              >
                <div className={`wf-sim-num${activeTab === key ? ' wf-sim-num--active' : ''}`}>{num}</div>
                <div className="wf-sim-content">
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="wf-sim-phone-wrap">
            <IphoneMockup messages={simMessages} onActionClick={handleSimulateClick} />
          </div>
        </div>
      </section>

      {/* ── DEVELOPER EXPERIENCE SECTION ── */}
      <section id="developer" className="wf-dev-section">
        <div className="wf-section-header wf-reveal">
          <h2 className="wf-section-title">First-class developer experience</h2>
          <p className="wf-section-desc">Built by engineers, for engineers. Test safely, integrate easily, and ship faster.</p>
        </div>

        <div className="wf-dev-grid">
          {/* Card 1: Sandbox */}
          <div className="wf-dev-card wf-reveal wf-reveal-delay-1">
            <div className="wf-dev-visual wf-dev-visual-sandbox">
              <div className="wf-sandbox-header">
                <span className="wf-sandbox-tag">Sandbox:</span>
                <span className="wf-sandbox-num">+1 555 867 5309</span>
              </div>
              <div className="wf-sandbox-session">
                <div className="wf-sandbox-session-left">
                  <div className="wf-session-title">Your test session</div>
                  <span className="wf-sandbox-badge">
                    <span className="wf-badge-dot" /> Active
                  </span>
                </div>
              </div>
              <div className="wf-sandbox-details">
                <div className="wf-detail-row">
                  <span className="wf-detail-label">Phone:</span>
                  <span className="wf-detail-val">+1 (555) 432-1098</span>
                </div>
                <div className="wf-detail-row">
                  <span className="wf-detail-label">Connected Agent:</span>
                  <span className="wf-detail-val">Support Bot</span>
                </div>
              </div>
              <div className="wf-sandbox-prompt">Send a message to test your integration</div>
            </div>
            <div className="wf-dev-info">
              <h3 className="wf-dev-title">Sandbox mode</h3>
              <p className="wf-dev-desc">Test with a shared sandbox number. Add your phone, connect an agent, and start testing without any setup.</p>
            </div>
          </div>

          {/* Card 2: Webhooks */}
          <div className="wf-dev-card wf-reveal wf-reveal-delay-2">
            <div className="wf-dev-visual wf-dev-visual-webhooks">
              <div className="wf-webhook-log">
                <div className="wf-log-row">
                  <span className="wf-status-badge wf-status-200">200</span>
                  <span className="wf-log-event">message.received</span>
                  <span className="wf-log-time">12ms</span>
                </div>
                <div className="wf-log-row">
                  <span className="wf-status-badge wf-status-200">200</span>
                  <span className="wf-log-event">message.delivered</span>
                  <span className="wf-log-time">8ms</span>
                </div>
                <div className="wf-log-row">
                  <span className="wf-status-badge wf-status-200">200</span>
                  <span className="wf-log-event">message.read</span>
                  <span className="wf-log-time">15ms</span>
                </div>
                <div className="wf-log-row">
                  <span className="wf-status-badge wf-status-500">500</span>
                  <span className="wf-log-event">message.failed</span>
                  <span className="wf-log-time wf-log-retry">retry 1/3</span>
                </div>
                <div className="wf-log-row">
                  <span className="wf-status-badge wf-status-200">200</span>
                  <span className="wf-log-event">message.sent</span>
                  <span className="wf-log-time">9ms</span>
                </div>
              </div>
            </div>
            <div className="wf-dev-info">
              <h3 className="wf-dev-title">WhatsApp webhooks</h3>
              <p className="wf-dev-desc">Receive real-time notifications directly to your server. Track delivery status, retries, and response times.</p>
            </div>
          </div>

          {/* Card 3: API Logs */}
          <div className="wf-dev-card wf-reveal wf-reveal-delay-3">
            <div className="wf-dev-visual wf-dev-visual-api">
              <div className="wf-api-log">
                <div className="wf-api-row">
                  <span className="wf-api-status-dot wf-api-status-200" />
                  <span className="wf-api-method wf-method-post">POST</span>
                  <span className="wf-api-path">/meta/whatsapp/v24.0/.../messages</span>
                  <span className="wf-api-latency">124ms</span>
                </div>
                <div className="wf-api-row">
                  <span className="wf-api-status-dot wf-api-status-200" />
                  <span className="wf-api-method wf-method-get">GET</span>
                  <span className="wf-api-path">/meta/whatsapp/v24.0/.../message_templates</span>
                  <span className="wf-api-latency">89ms</span>
                </div>
                <div className="wf-api-row">
                  <span className="wf-api-status-dot wf-api-status-400" />
                  <span className="wf-api-method wf-method-post">POST</span>
                  <span className="wf-api-path">/meta/whatsapp/v24.0/.../messages</span>
                  <span className="wf-api-latency">45ms</span>
                </div>
                <div className="wf-api-row">
                  <span className="wf-api-status-dot wf-api-status-200" />
                  <span className="wf-api-method wf-method-post">POST</span>
                  <span className="wf-api-path">/meta/whatsapp/v24.0/.../messages</span>
                  <span className="wf-api-latency">156ms</span>
                </div>
                <div className="wf-api-row">
                  <span className="wf-api-status-dot wf-api-status-200" />
                  <span className="wf-api-method wf-method-get">GET</span>
                  <span className="wf-api-path">/platform/v1/workflows</span>
                  <span className="wf-api-latency">23ms</span>
                </div>
              </div>
            </div>
            <div className="wf-dev-info">
              <h3 className="wf-dev-title">API logs</h3>
              <p className="wf-dev-desc">Debug with confidence. Every API request logged with timing, payloads, and responses in real-time.</p>
            </div>
          </div>

          {/* Card 4: Message Tracking */}
          <div className="wf-dev-card wf-reveal wf-reveal-delay-4">
            <div className="wf-dev-visual wf-dev-visual-tracking">
              <div className="wf-tracking-card">
                <div className="wf-tracking-id">
                  <span className="wf-track-label">Message ID:</span>
                  <code className="wf-track-code">wamid.HBgL...</code>
                </div>
                <div className="wf-timeline">
                  <div className="wf-timeline-item wf-timeline-active">
                    <div className="wf-timeline-badge">
                      <SingleCheck className="wf-timeline-icon" />
                    </div>
                    <div className="wf-timeline-info">
                      <span className="wf-timeline-status">Sent</span>
                      <span className="wf-timeline-time">04:05:39</span>
                    </div>
                  </div>
                  <div className="wf-timeline-item wf-timeline-active">
                    <div className="wf-timeline-badge">
                      <DoubleCheck className="wf-timeline-icon" />
                    </div>
                    <div className="wf-timeline-info">
                      <span className="wf-timeline-status">Delivered</span>
                      <span className="wf-timeline-time">04:05:40</span>
                    </div>
                  </div>
                  <div className="wf-timeline-item wf-timeline-read">
                    <div className="wf-timeline-badge">
                      <DoubleCheck className="wf-timeline-icon wf-icon-blue" />
                    </div>
                    <div className="wf-timeline-info">
                      <span className="wf-timeline-status">Read</span>
                      <span className="wf-timeline-time">04:05:44</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="wf-dev-info">
              <h3 className="wf-dev-title">Message tracking</h3>
              <p className="wf-dev-desc">Track every message status in real-time. Know exactly when messages are sent, delivered, and read.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BLOG / STAY UP TO DATE ── */}
      <section id="blog" className="wf-blog-section">
        <div className="wf-blog-inner">
          <div className="wf-blog-header wf-reveal">
            <h2 className="wf-blog-title">What's inside</h2>
            <p className="wf-blog-desc">Explore the core capabilities that make WhatFlow the most complete WhatsApp Business platform.</p>
          </div>
          <div className="wf-blog-cards wf-reveal wf-reveal-delay-2">
            {[
              { title: 'Shared Team Inbox', body: 'Multiple agents, one WhatsApp number. Assign conversations, leave internal notes, and resolve customer queries collaboratively in real time.', tag: 'Feature' },
              { title: 'Custom Webhook Workflows', body: 'Receive real-time delivery, read, and failure notifications directly to your server. Track retries, latencies, and trigger automations on every event.', tag: 'Feature' },
              { title: 'WhatsApp Template Manager', body: 'Create, submit, and manage Meta-approved message templates directly from the dashboard. Track approval status and send template campaigns at scale.', tag: 'Feature' },
            ].map((post, i) => (
              <div key={i} className="wf-blog-card" id={`blog-card-${i}`}>
                <div className="wf-blog-card-icon">
                  <WfLogo size={24} color="#25D366" />
                </div>
                <span className="wf-blog-tag">{post.tag}</span>
                <h3 className="wf-blog-card-title">{post.title}</h3>
                <p className="wf-blog-card-body">{post.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="wf-cta-banner wf-reveal">
        <h2 className="wf-cta-title">Ready to supercharge your WhatsApp?</h2>
        <p className="wf-cta-desc">Join thousands of businesses automating their customer conversations with WhatFlow.</p>
        <div className="wf-cta-btns" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
          <a href={webAppUrl} target="_blank" rel="noopener noreferrer" className="wf-btn wf-btn-primary wf-btn-lg" id="bottom-cta-web">Web App</a>
          <a href={shopifyAppUrl} target="_blank" rel="noopener noreferrer" className="wf-btn wf-btn-outline wf-btn-lg" id="bottom-cta-shopify" style={{ background: 'transparent', borderColor: 'rgba(255, 255, 255, 0.4)', color: '#ffffff' }}>Shopify App</a>
        </div>
      </section>
        </>
      ) : page === 'privacy' ? (
        <PrivacyPolicy />
      ) : page === 'terms' ? (
        <TermsOfService />
      ) : (
        <Pricing />
      )}

      {/* ── FOOTER ── */}
      <footer className="wf-footer">
        <div className="wf-footer-inner">
          <div className="wf-footer-cols">
            <div className="wf-footer-col">
              <h4>What we do</h4>
              <a href="#features">Features</a>
              <a href="#interactive">Interactive Messages</a>
              <a href="#developer">Developers</a>
              <a href={webAppUrl} target="_blank" rel="noopener noreferrer">For Business</a>
            </div>
            <div className="wf-footer-col">
              <h4>Use WhatFlow</h4>
              <a href={webAppUrl} target="_blank" rel="noopener noreferrer">Web App</a>
              <a href={shopifyAppUrl} target="_blank" rel="noopener noreferrer">Shopify App</a>
              <Link to="/pricing">Pricing</Link>
              <a href="#">Documentation</a>
              <a href="#">API Reference</a>
            </div>
            <div className="wf-footer-col">
              <h4>Need help?</h4>
              <a href="#">Contact Us</a>
              <a href="#blog">Blog</a>
            </div>
          </div>
        </div>

        <div className="wf-footer-bottom">
          <span>{new Date().getFullYear()} © WhatFlow. All rights reserved.</span>
          <div className="wf-footer-legal">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
          <div className="wf-footer-socials">
            <a href="https://www.linkedin.com/company/whatflow" className="wf-social" aria-label="LinkedIn" id="social-linkedin" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554V14.845c0-1.327-.026-3.037-1.851-3.037-1.852 0-2.135 1.445-2.135 2.939v5.705h-3.554V9h3.414v1.561h.049c.476-.9 1.637-1.851 3.369-1.851 3.603 0 4.27 2.371 4.27 5.456v6.286zM5.337 7.433c-1.144 0-2.069-.926-2.069-2.069 0-1.144.925-2.069 2.069-2.069 1.145 0 2.069.925 2.069 2.069 0 1.143-.925 2.069-2.069 2.069zM7.114 20.452H3.561V9h3.553v11.452zM22.225 0H1.771C.791 0 0 .771 0 1.725v20.549C0 23.229.79 24 1.771 24h20.451C23.2 24 24 23.229 24 22.274V1.725C24 .771 23.2 0 22.225 0z" /></svg>
            </a>
            <a href="https://www.instagram.com/whatflow.shopify/" className="wf-social" aria-label="Instagram" id="social-instagram" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
            </a>
            <a href="https://www.facebook.com/whatflow.shopify/" className="wf-social" aria-label="Facebook" id="social-facebook" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
