import { useState } from 'react';

// Get the app dashboard URL from environment variable or fallback to production
const appUrl = import.meta.env.VITE_APP_URL || 'https://app.whatflow.io';

interface CtaData {
  title: string;
  body: string;
  footer: string;
  buttonText: string;
  url: string;
}

interface ListData {
  title: string;
  body: string;
  footer: string;
  actionText: string;
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      desc: string;
    }>;
  }>;
}

interface ButtonsData {
  title: string;
  body: string;
  footer: string;
  buttons: string[];
}

interface CarouselCard {
  id: string;
  image: string;
  body: string;
  buttonText: string;
}

interface CarouselData {
  cards: CarouselCard[];
}

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text?: string;
  type?: 'text' | 'cta' | 'list' | 'buttons' | 'carousel';
  data?: CtaData | ListData | ButtonsData | CarouselData;
  time: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'cta' | 'list' | 'buttons' | 'carousel'>('cta');
  const [msgIdCounter, setMsgIdCounter] = useState(3);
  
  // Custom chatbot simulation messages based on active preview
  const getMockMessages = (): Message[] => {
    const base: Message[] = [
      { id: '1', sender: 'bot', text: 'Welcome to WhatFlow! Select a component on the left to see how WhatsApp interactive messages look in real-time.', time: '10:00 AM' }
    ];

    switch (activeTab) {
      case 'cta':
        return [
          ...base,
          {
            id: '2',
            sender: 'bot',
            type: 'cta',
            data: {
              title: '🚀 Launch Your WhatsApp App',
              body: 'Integrate the Meta Cloud API in minutes. Check out our quickstart developer guides.',
              footer: 'WhatFlow API Engine',
              buttonText: 'Open Documentation',
              url: 'https://docs.whatflow.io'
            },
            time: '10:01 AM'
          }
        ];
      case 'list':
        return [
          ...base,
          {
            id: '2',
            sender: 'bot',
            type: 'list',
            data: {
              title: '🏢 Choose Your Department',
              body: 'Select a division below to instantly route your conversation to the correct support team.',
              footer: 'Powered by WhatFlow Workflows',
              actionText: 'View Departments',
              sections: [
                {
                  title: 'Support & Tech',
                  rows: [
                    { id: 'tech', title: 'Technical Support', desc: 'Resolve code, API, and webhook issues' },
                    { id: 'billing', title: 'Billing & Plans', desc: 'Invoices, limits, and upgrades' }
                  ]
                },
                {
                  title: 'Business',
                  rows: [
                    { id: 'sales', title: 'Talk to Sales', desc: 'Enterprise volumes and Custom SLAs' }
                  ]
                }
              ]
            },
            time: '10:01 AM'
          }
        ];
      case 'buttons':
        return [
          ...base,
          {
            id: '2',
            sender: 'bot',
            type: 'buttons',
            data: {
              title: '💬 Quick RSVP',
              body: 'Are you attending the WhatFlow Developer Webinar tomorrow at 3 PM UTC?',
              footer: 'Event Confirmation',
              buttons: ['Yes, definitely', 'Maybe later', 'Send info']
            },
            time: '10:01 AM'
          }
        ];
      case 'carousel':
        return [
          ...base,
          {
            id: '2',
            sender: 'bot',
            type: 'carousel',
            data: {
              cards: [
                {
                  id: 'card1',
                  image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
                  body: 'Scale with WhatsApp Cloud API',
                  buttonText: 'View API docs'
                },
                {
                  id: 'card2',
                  image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=400&q=80',
                  body: 'Automate via Custom Webhooks',
                  buttonText: 'View Webhooks'
                }
              ]
            },
            time: '10:01 AM'
          }
        ];
      default:
        return base;
    }
  };

  const [simMessages, setSimMessages] = useState<Message[]>(getMockMessages());

  // Reset messages when switching tabs
  const handleTabChange = (tab: 'cta' | 'list' | 'buttons' | 'carousel') => {
    setActiveTab(tab);
    setMsgIdCounter(3);
    // Create new array based on tab choice
    const newMessages: Message[] = [
      { id: '1', sender: 'bot', text: 'Welcome to WhatFlow! Select a component on the left to see how WhatsApp interactive messages look in real-time.', time: '10:00 AM' }
    ];
    if (tab === 'cta') {
      newMessages.push({
        id: '2', sender: 'bot', type: 'cta', data: {
          title: '🚀 Launch Your WhatsApp App',
          body: 'Integrate the Meta Cloud API in minutes. Check out our quickstart developer guides.',
          footer: 'WhatFlow API Engine',
          buttonText: 'Open Documentation',
          url: 'https://docs.whatflow.io'
        }, time: '10:01 AM'
      });
    } else if (tab === 'list') {
      newMessages.push({
        id: '2', sender: 'bot', type: 'list', data: {
          title: '🏢 Choose Your Department',
          body: 'Select a division below to route your conversation to the correct support team.',
          footer: 'Powered by WhatFlow Workflows',
          actionText: 'View Departments',
          sections: [
            {
              title: 'Support & Tech',
              rows: [
                { id: 'tech', title: 'Technical Support', desc: 'Resolve code, API, and webhook issues' },
                { id: 'billing', title: 'Billing & Plans', desc: 'Invoices, limits, and upgrades' }
              ]
            },
            {
              title: 'Business',
              rows: [
                { id: 'sales', title: 'Talk to Sales', desc: 'Enterprise volumes and Custom SLAs' }
              ]
            }
          ]
        }, time: '10:01 AM'
      });
    } else if (tab === 'buttons') {
      newMessages.push({
        id: '2', sender: 'bot', type: 'buttons', data: {
          title: '💬 Quick RSVP',
          body: 'Are you attending the WhatFlow Developer Webinar tomorrow at 3 PM UTC?',
          footer: 'Event Confirmation',
          buttons: ['Yes, definitely', 'Maybe later', 'Send info']
        }, time: '10:01 AM'
      });
    } else if (tab === 'carousel') {
      newMessages.push({
        id: '2', sender: 'bot', type: 'carousel', data: {
          cards: [
            {
              id: 'card1',
              image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
              body: 'Scale with WhatsApp Cloud API',
              buttonText: 'View API docs'
            },
            {
              id: 'card2',
              image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=400&q=80',
              body: 'Automate via Custom Webhooks',
              buttonText: 'View Webhooks'
            }
          ]
        }, time: '10:01 AM'
      });
    }
    setSimMessages(newMessages);
  };

  // User taps an interactive option inside the phone mockup
  const handleSimulateClick = (selectionText: string) => {
    // Avoid double clicks adding duplicate replies
    if (simMessages.some(m => m.sender === 'user')) return;

    const userMessage: Message = {
      id: msgIdCounter.toString(),
      sender: 'user',
      text: selectionText,
      time: '10:02 AM'
    };

    const botResponse: Message = {
      id: (msgIdCounter + 1).toString(),
      sender: 'bot',
      text: `✅ Selection received! Custom webhook dispatched to your backend with payload data for "${selectionText}".`,
      time: '10:02 AM'
    };

    setSimMessages(prev => [...prev, userMessage, botResponse]);
    setMsgIdCounter(prev => prev + 2);
  };

  return (
    <div>
      {/* Decorative Glow Elements */}
      <div className="glow-bg glow-top-left"></div>
      <div className="glow-bg glow-center"></div>
      <div className="glow-bg glow-bottom-right"></div>

      {/* Header */}
      <header className="header">
        <div className="container nav">
          <a href="#" className="logo-container">
            <span className="logo-icon">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </span>
            <span>WhatFlow</span>
          </a>
          <nav className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#interactive" className="nav-link">Interactive Messages</a>
            <a href="#pricing" className="nav-link">Pricing</a>
          </nav>
          <div>
            <a href={appUrl} className="btn btn-primary btn-sm">Launch App</a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="section container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
        <div className="hero-wrapper">
          <div className="hero-content animate-fade-in">
            <div className="hero-tag">
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></span>
              Vite + React Powered
            </div>
            <h1 className="hero-title">
              The Developer-First <br />
              <span className="text-gradient">WhatsApp API</span> Platform
            </h1>
            <p className="hero-desc">
              Connect your Meta WhatsApp Business Cloud API in minutes. Build powerful interactive buttons, menus, and media carousels. Manage conversations in a modern shared inbox.
            </p>
            <div className="hero-actions">
              <a href={appUrl} className="btn btn-primary">Start Building Free</a>
              <a href="#features" className="btn btn-secondary">Explore Features</a>
            </div>
          </div>

          {/* High-Fidelity Static Mockup illustration */}
          <div className="animate-fade-in delay-200" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '1.25rem', width: '100%', maxWidth: '420px', border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'red' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'yellow' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'green' }}></div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>whatflow-config.json</span>
              </div>
              <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.825rem', color: '#34d399', overflowX: 'auto', lineHeight: '1.5' }}>
{`{
  "platform": "whatsapp",
  "webhook": "https://api.whatflow.io/webhook",
  "routing": {
    "interactive_clicks": "trigger_workflow",
    "voice_notes": "transcribe_ai"
  },
  "interactive_components": [
    "cta_url_buttons",
    "list_menus",
    "quick_replies",
    "media_carousels"
  ]
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="section container">
        <div className="section-header">
          <span className="section-label">Features</span>
          <h2 className="section-title">Built for Modern Teams & Developers</h2>
          <p className="section-desc">Streamline customer conversations and automate WhatsApp messages with tools designed to scale.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.083.205.127.428.127.662v11.838c0 .878-.718 1.59-1.59 1.59H5.215c-.878 0-1.59-.718-1.59-1.59V9.173c0-.234.044-.457.127-.662M12 2.25c3.21 0 5.812 2.457 5.812 5.488H6.188c0-3.03 2.602-5.488 5.812-5.488z" />
              </svg>
            </div>
            <h3 className="feature-title">Shared Team Inbox</h3>
            <p className="feature-desc">Collaborate on customer inquiries in real-time. Assign threads, add internal notes, and never miss a chat.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h3 className="feature-title">Interactive Builders</h3>
            <p className="feature-desc">Design list menus, carousels, and quick-reply buttons visually. Drive conversions with guided user selections.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <h3 className="feature-title">Developer-First API</h3>
            <p className="feature-desc">Standard API keys, flexible webhooks, and secure sandbox keys. Connect with existing CRM tools seamlessly.</p>
          </div>
        </div>
      </section>

      {/* Interactive Live Simulator Section */}
      <section id="interactive" className="section container" style={{ borderTop: '1px solid var(--border-glass)' }}>
        <div className="section-header">
          <span className="section-label">Interactive Demo</span>
          <h2 className="section-title">Experience WhatsApp Interactive Elements</h2>
          <p className="section-desc">Click through the options on the left to see how WhatFlow renders interactive templates inside the WhatsApp client.</p>
        </div>

        <div className="simulator-container">
          <div className="simulator-controls">
            <button
              onClick={() => handleTabChange('cta')}
              className={`simulator-btn ${activeTab === 'cta' ? 'active' : ''}`}
            >
              <div className="sim-num">1</div>
              <div className="sim-btn-content">
                <h4>CTA URL Link Message</h4>
                <p>Add official links that drive customers directly to a website landing page or document.</p>
              </div>
            </button>

            <button
              onClick={() => handleTabChange('list')}
              className={`simulator-btn ${activeTab === 'list' ? 'active' : ''}`}
            >
              <div className="sim-num">2</div>
              <div className="sim-btn-content">
                <h4>Interactive List Menu</h4>
                <p>Provide up to 10 options organized neatly in sections for routing or configuration choice.</p>
              </div>
            </button>

            <button
              onClick={() => handleTabChange('buttons')}
              className={`simulator-btn ${activeTab === 'buttons' ? 'active' : ''}`}
            >
              <div className="sim-num">3</div>
              <div className="sim-btn-content">
                <h4>Quick Reply Buttons</h4>
                <p>Display up to 3 quick response pills to guide conversation flows easily.</p>
              </div>
            </button>

            <button
              onClick={() => handleTabChange('carousel')}
              className={`simulator-btn ${activeTab === 'carousel' ? 'active' : ''}`}
            >
              <div className="sim-num">4</div>
              <div className="sim-btn-content">
                <h4>Media Carousel</h4>
                <p>Combine header images, descriptions, and action buttons into a rich scrolling component.</p>
              </div>
            </button>
          </div>

          {/* Interactive Phone Mockup */}
          <div>
            <div className="phone-mockup">
              <div className="phone-header">
                <div className="avatar">WF</div>
                <div className="contact-info">
                  <span className="contact-name">WhatFlow Assistant</span>
                  <span className="contact-status">online</span>
                </div>
              </div>

              <div className="phone-body">
                {simMessages.map((msg) => {
                  if (msg.sender === 'user') {
                    return (
                      <div key={msg.id} className="msg-bubble msg-out">
                        {msg.text}
                        <span className="msg-time">{msg.time}</span>
                      </div>
                    );
                  }

                  if (msg.type === 'cta') {
                    const ctaData = msg.data as CtaData;
                    return (
                      <div key={msg.id} className="interactive-card">
                        <div className="interactive-body">
                          <strong>{ctaData.title}</strong>
                          {ctaData.body}
                        </div>
                        <div className="interactive-footer">{ctaData.footer}</div>
                        <div className="interactive-actions">
                          <button
                            onClick={() => handleSimulateClick(ctaData.buttonText)}
                            className="inter-btn"
                          >
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                            {ctaData.buttonText}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (msg.type === 'list') {
                    const listData = msg.data as ListData;
                    return (
                      <div key={msg.id} className="interactive-card">
                        <div className="interactive-body">
                          <strong>{listData.title}</strong>
                          {listData.body}
                        </div>
                        <div className="interactive-footer">{listData.footer}</div>
                        <div className="interactive-actions">
                          <button
                            onClick={() => handleSimulateClick('Selected Tech Support')}
                            className="inter-btn"
                            style={{ fontWeight: 600 }}
                          >
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                            </svg>
                            {listData.actionText}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (msg.type === 'buttons') {
                    const buttonsData = msg.data as ButtonsData;
                    return (
                      <div key={msg.id} className="interactive-card">
                        <div className="interactive-body">
                          <strong>{buttonsData.title}</strong>
                          {buttonsData.body}
                        </div>
                        <div className="interactive-footer">{buttonsData.footer}</div>
                        <div className="interactive-actions">
                          {buttonsData.buttons.map((btnText: string, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => handleSimulateClick(btnText)}
                              className="inter-btn"
                            >
                              {btnText}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (msg.type === 'carousel') {
                    const carouselData = msg.data as CarouselData;
                    return (
                      <div key={msg.id} className="carousel-scroller">
                        {carouselData.cards.map((card: CarouselCard, idx: number) => (
                          <div key={card.id || idx} className="carousel-item-card">
                            <div className="carousel-item-header" style={{ backgroundImage: `url(${card.image})` }}></div>
                            <div className="carousel-item-body">
                              {card.body}
                            </div>
                            <button
                              onClick={() => handleSimulateClick(card.buttonText)}
                              className="carousel-item-btn"
                            >
                              {card.buttonText}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="msg-bubble msg-in">
                      {msg.text}
                      <span className="msg-time">{msg.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {simMessages.some(m => m.sender === 'user') && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  onClick={() => handleTabChange(activeTab)}
                  className="btn btn-secondary btn-sm"
                  style={{ borderRadius: '99px', fontSize: '0.75rem', padding: '0.4rem 1rem' }}
                >
                  🔄 Reset Mockup Conversation
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="section container" style={{ borderTop: '1px solid var(--border-glass)' }}>
        <div className="section-header">
          <span className="section-label">Pricing</span>
          <h2 className="section-title">Transparent, Developer-Friendly Tiers</h2>
          <p className="section-desc">Get started for free or upgrade as your message volumes grow. All plans support core interactive elements.</p>
        </div>

        <div className="pricing-grid">
          <div className="price-card">
            <h3 className="price-title">Developer</h3>
            <p className="price-desc">Perfect for testing sandboxes and building custom integrations.</p>
            <div className="price-amount-wrapper">
              <span className="price-symbol">$</span>
              <span className="price-amount">0</span>
              <span className="price-period">/ month</span>
            </div>
            <ul className="price-features-list">
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                1 Sandbox Phone Number
              </li>
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                1,000 monthly messages
              </li>
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Webhook integration support
              </li>
            </ul>
            <a href={appUrl} className="btn btn-secondary">Get Sandbox Key</a>
          </div>

          <div className="price-card featured">
            <div className="badge">Popular</div>
            <h3 className="price-title">Pro</h3>
            <p className="price-desc">For growing businesses managing high customer chat volumes.</p>
            <div className="price-amount-wrapper">
              <span className="price-symbol">$</span>
              <span className="price-amount">49</span>
              <span className="price-period">/ month</span>
            </div>
            <ul className="price-features-list">
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                5 Live Phone Numbers
              </li>
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                50,000 monthly messages
              </li>
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Advanced Interactive Builders
              </li>
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Team Inbox & Collaboration
              </li>
            </ul>
            <a href={appUrl} className="btn btn-primary">Try Pro Free</a>
          </div>

          <div className="price-card">
            <h3 className="price-title">Enterprise</h3>
            <p className="price-desc">Custom throughput and dedicated account support.</p>
            <div className="price-amount-wrapper">
              <span className="price-symbol">$</span>
              <span className="price-amount">199</span>
              <span className="price-period">/ month</span>
            </div>
            <ul className="price-features-list">
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Unlimited Live Phone Numbers
              </li>
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Unlimited monthly messages
              </li>
              <li className="price-feature-item">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Custom APIs & SLA commitments
              </li>
            </ul>
            <a href={appUrl} className="btn btn-secondary">Contact Sales</a>
          </div>
        </div>
      </section>

      {/* CTA Footer Block */}
      <section className="section container">
        <div className="cta-banner">
          <h2 className="cta-title">Upgrade Your WhatsApp Workflows</h2>
          <p className="cta-desc">Sign up today and get access to the shared team inbox and developer tools instantly.</p>
          <a href={appUrl} className="btn btn-primary">Create Free Account</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-wrapper">
          <div>
            &copy; {new Date().getFullYear()} WhatFlow. All rights reserved.
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">API Keys</a>
            <a href="#" className="footer-link">Webhooks</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
