import type { Message, CtaData, ListData, ButtonsData, CarouselData } from '../App';
import ChatBubble from './ChatBubble';

interface IphoneMockupProps {
  messages: Message[];
  onActionClick: (selectionText: string) => void;
}

export default function IphoneMockup({ messages, onActionClick }: IphoneMockupProps) {
  return (
    <div className="wf-phone-container">
      <img src="/iPhone-Frame-PNG-Cutout.png" className="wf-phone-frame-img" alt="" />
      <div className="wf-phone-screen">
        <div className="wf-pm-statusbar">
          <span className="wf-pm-time">9:41</span>
          <div className="wf-pm-status-icons">
            <svg width="13" height="8.5" viewBox="0 0 17 11" fill="currentColor">
              <rect x="0" y="8" width="2.5" height="3" rx="0.5" />
              <rect x="4.5" y="6" width="2.5" height="5" rx="0.5" />
              <rect x="9" y="3" width="2.5" height="8" rx="0.5" />
              <rect x="13.5" y="0" width="2.5" height="11" rx="0.5" />
            </svg>
            <svg width="11.5" height="8.5" viewBox="0 0 15 11" fill="currentColor">
              <path d="M7.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-3.8-3.8c2.1-2.1 5.5-2.1 7.6 0l-1 1c-1.5-1.5-4-1.5-5.5 0l-1.1-1zm-2.2-2.2c3.3-3.3 8.7-3.3 12 0l-1 1c-2.7-2.7-7.2-2.7-9.9 0l-1.1-1z" fillRule="evenodd" />
            </svg>
            <svg width="17" height="8.5" viewBox="0 0 22 11" fill="currentColor">
              <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="2.5" y="2.5" width="12" height="6" rx="1.2" />
              <path d="M19.5 3.5c.8 0 1 .4 1 1v2c0 .6-.2 1-1 1" fill="currentColor" />
            </svg>
          </div>
        </div>
        <div className="wf-pm-header">
          <span className="wf-pm-back">‹</span>
          <div className="wf-pm-avatar">WF</div>
          <div className="wf-pm-info">
            <span className="wf-pm-name">WhatFlow Assistant</span>
            <span className="wf-pm-status">online</span>
          </div>
          <div className="wf-pm-actions">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2z" /></svg>
          </div>
        </div>
        <div className="wf-pm-body">
          {messages.map((msg) => {
            if (msg.sender === 'user') return (
              <ChatBubble key={msg.id} text={msg.text || ''} time={msg.time} direction="out" variant="mockup" />
            );
            if (msg.type === 'cta') {
              const d = msg.data as CtaData;
              return (
                <div key={msg.id} className="wf-ic-card">
                  <div className="wf-ic-body"><strong>{d.title}</strong>{d.body}</div>
                  <div className="wf-ic-footer">{d.footer}</div>
                  <div className="wf-ic-actions">
                    <button className="wf-ic-btn" onClick={() => onActionClick(d.buttonText)}>{d.buttonText}</button>
                  </div>
                </div>
              );
            }
            if (msg.type === 'list') {
              const d = msg.data as ListData;
              return (
                <div key={msg.id} className="wf-ic-card">
                  <div className="wf-ic-body"><strong>{d.title}</strong>{d.body}</div>
                  <div className="wf-ic-footer">{d.footer}</div>
                  <div className="wf-ic-actions">
                    <button className="wf-ic-btn" onClick={() => onActionClick('Selected Tech Support')}>{d.actionText}</button>
                  </div>
                </div>
              );
            }
            if (msg.type === 'buttons') {
              const d = msg.data as ButtonsData;
              return (
                <div key={msg.id} className="wf-ic-card">
                  <div className="wf-ic-body"><strong>{d.title}</strong>{d.body}</div>
                  <div className="wf-ic-footer">{d.footer}</div>
                  <div className="wf-ic-actions">
                    {d.buttons.map((b, i) => <button key={i} className="wf-ic-btn" onClick={() => onActionClick(b)}>{b}</button>)}
                  </div>
                </div>
              );
            }
            if (msg.type === 'carousel') {
              const d = msg.data as CarouselData;
              return (
                <div key={msg.id} className="wf-carousel-scroll">
                  {d.cards.map((c, i) => (
                    <div key={c.id || i} className="wf-carousel-card">
                      <div className="wf-carousel-img" style={{ backgroundImage: `url(${c.image})` }} />
                      <div className="wf-carousel-body">{c.body}</div>
                      <button className="wf-ic-btn" onClick={() => onActionClick(c.buttonText)}>{c.buttonText}</button>
                    </div>
                  ))}
                </div>
              );
            }
            return <ChatBubble key={msg.id} text={msg.text || ''} time={msg.time} direction="in" variant="mockup" />;
          })}
        </div>
        <div className="wf-pm-input-bar">
          <span className="wf-pm-plus">+</span>
          <div className="wf-pm-input-wrapper">
            <span className="wf-pm-input-placeholder">Type a message...</span>
          </div>
          <button className="wf-pm-input-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" /></svg>
          </button>
          <button className="wf-pm-input-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
