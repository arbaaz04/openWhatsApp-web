import React from 'react';

export interface ChatBubbleProps {
  sender?: string;
  text: string;
  time: string;
  direction: 'in' | 'out';
  className?: string;
  variant?: 'shared' | 'mockup';
  style?: React.CSSProperties;
}

export default function ChatBubble({
  sender,
  text,
  time,
  direction,
  className = '',
  variant = 'shared',
  style
}: ChatBubbleProps) {
  if (variant === 'mockup') {
    return (
      <div className={`wf-bubble wf-bubble--${direction} ${className}`} style={style}>
        {sender && <div className="wf-bubble-sender">{sender}</div>}
        <span className="wf-bubble-text">{text}</span>
        <span className="wf-btime">{time}</span>
      </div>
    );
  }

  return (
    <div className={`wf-chat-bubble wf-chat-bubble--${direction} ${className}`} style={style}>
      {sender && <div className="wf-bubble-sender">{sender}</div>}
      <div className="wf-bubble-body">
        <span className="wf-bubble-text">{text}</span>
        <span className="wf-bubble-time">{time}</span>
      </div>
    </div>
  );
}
