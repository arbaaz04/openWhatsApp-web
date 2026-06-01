import { useState } from 'react';
import { X, Send, Plus, Trash2, Smartphone, Globe, List, MessageSquare, Layers, Sparkles, Image, Video, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

interface InteractivePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (payload: { type: 'interactive'; body: string; payload: Record<string, any> }) => void;
}

type TabType = 'cta_url' | 'button' | 'list' | 'carousel';

export function InteractivePicker({ isOpen, onClose, onSelect }: InteractivePickerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('button');

  // --- 1. Reply Buttons State ---
  const [replyHeaderType, setReplyHeaderType] = useState<'none' | 'text' | 'image' | 'video'>('none');
  const [replyHeaderText, setReplyHeaderText] = useState('');
  const [replyHeaderLink, setReplyHeaderLink] = useState('');
  const [replyBody, setReplyBody] = useState('How can we help you today?');
  const [replyFooter, setReplyFooter] = useState('Please select an option below.');
  const [replyButtons, setReplyButtons] = useState<Array<{ id: string; title: string }>>([
    { id: 'btn_support', title: 'Talk to Support' },
    { id: 'btn_billing', title: 'Billing Query' }
  ]);

  // --- 2. CTA URL State ---
  const [ctaHeaderType, setCtaHeaderType] = useState<'none' | 'text' | 'image' | 'video'>('none');
  const [ctaHeaderText, setCtaHeaderText] = useState('');
  const [ctaHeaderLink, setCtaHeaderLink] = useState('');
  const [ctaBody, setCtaBody] = useState('Check out our summer deals!');
  const [ctaFooter, setCtaFooter] = useState('Valid until June 30.');
  const [ctaDisplayText, setCtaDisplayText] = useState('Visit Store');
  const [ctaUrl, setCtaUrl] = useState('https://example.com/store');

  // --- 3. List Message State ---
  const [listHeaderText, setListHeaderText] = useState('Help Desk Menu');
  const [listBody, setListBody] = useState('Please choose a topic from our catalog.');
  const [listFooter, setListFooter] = useState('WhatFlow Customer Service');
  const [listButtonText, setListButtonText] = useState('View Topics');
  const [listSections, setListSections] = useState<Array<{
    title: string;
    rows: Array<{ id: string; title: string; description: string }>;
  }>>([
    {
      title: 'Our Services',
      rows: [
        { id: 'row_hosting', title: 'Cloud Hosting', description: 'Deploy apps instantly' },
        { id: 'row_domains', title: 'Domain Search', description: 'Register custom domains' }
      ]
    }
  ]);

  // --- 4. Carousel State ---
  const [carouselBody, setCarouselBody] = useState('Browse our top properties:');
  const [carouselCards, setCarouselCards] = useState<Array<{
    headerType: 'image' | 'video';
    headerLink: string;
    bodyText: string;
    buttonType: 'quick_reply' | 'cta_url';
    buttons: Array<{ id: string; title: string }>;
    ctaDisplay: string;
    ctaUrl: string;
  }>>([
    {
      headerType: 'image',
      headerLink: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=600&q=80',
      bodyText: '*Beachfront Villa*\nBeautiful 4-bedroom villa with private pool.',
      buttonType: 'cta_url',
      buttons: [{ id: 'card1_btn1', title: 'Inquire' }],
      ctaDisplay: 'View Details',
      ctaUrl: 'https://example.com/villa1'
    },
    {
      headerType: 'image',
      headerLink: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
      bodyText: '*Modern Penthouse*\nLuxury living in the heart of downtown.',
      buttonType: 'cta_url',
      buttons: [{ id: 'card2_btn1', title: 'Inquire' }],
      ctaDisplay: 'Book Tour',
      ctaUrl: 'https://example.com/penthouse2'
    }
  ]);

  // --- Button Handlers ---
  const addReplyButton = () => {
    if (replyButtons.length >= 3) return;
    setReplyButtons([...replyButtons, { id: `btn_${Date.now()}`, title: 'New Option' }]);
  };

  const removeReplyButton = (index: number) => {
    setReplyButtons(replyButtons.filter((_, i) => i !== index));
  };

  const updateReplyButton = (index: number, key: 'id' | 'title', val: string) => {
    setReplyButtons(replyButtons.map((btn, i) => i === index ? { ...btn, [key]: val } : btn));
  };

  // --- List Section Handlers ---
  const addListSection = () => {
    setListSections([...listSections, { title: 'New Section', rows: [{ id: `row_${Date.now()}`, title: 'Item Title', description: 'Item description' }] }]);
  };

  const removeListSection = (sIdx: number) => {
    setListSections(listSections.filter((_, i) => i !== sIdx));
  };

  const updateListSectionTitle = (sIdx: number, title: string) => {
    setListSections(listSections.map((sec, i) => i === sIdx ? { ...sec, title } : sec));
  };

  const addListRow = (sIdx: number) => {
    setListSections(listSections.map((sec, i) => {
      if (i !== sIdx) return sec;
      return {
        ...sec,
        rows: [...sec.rows, { id: `row_${Date.now()}`, title: 'New Item', description: '' }]
      };
    }));
  };

  const removeListRow = (sIdx: number, rIdx: number) => {
    setListSections(listSections.map((sec, i) => {
      if (i !== sIdx) return sec;
      return {
        ...sec,
        rows: sec.rows.filter((_, j) => j !== rIdx)
      };
    }));
  };

  const updateListRow = (sIdx: number, rIdx: number, key: 'id' | 'title' | 'description', val: string) => {
    setListSections(listSections.map((sec, i) => {
      if (i !== sIdx) return sec;
      return {
        ...sec,
        rows: sec.rows.map((row, j) => j === rIdx ? { ...row, [key]: val } : row)
      };
    }));
  };

  // --- Carousel Handlers ---
  const addCarouselCard = () => {
    if (carouselCards.length >= 10) return;
    setCarouselCards([...carouselCards, {
      headerType: 'image',
      headerLink: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
      bodyText: '*Luxury Estate*\nModern architectural marvel.',
      buttonType: 'cta_url',
      buttons: [{ id: `card_${Date.now()}_btn1`, title: 'Inquire' }],
      ctaDisplay: 'View Listing',
      ctaUrl: 'https://example.com'
    }]);
  };

  const removeCarouselCard = (index: number) => {
    if (carouselCards.length <= 2) {
      alert('Carousels must have at least 2 cards.');
      return;
    }
    setCarouselCards(carouselCards.filter((_, i) => i !== index));
  };

  const updateCarouselCard = (index: number, key: string, val: any) => {
    setCarouselCards(carouselCards.map((card, i) => i === index ? { ...card, [key]: val } : card));
  };

  const addCardQuickReply = (cIdx: number) => {
    const card = carouselCards[cIdx];
    if (card.buttons.length >= 2) return;
    updateCarouselCard(cIdx, 'buttons', [...card.buttons, { id: `btn_${Date.now()}`, title: 'Quick Action' }]);
  };

  const removeCardQuickReply = (cIdx: number, bIdx: number) => {
    const card = carouselCards[cIdx];
    updateCarouselCard(cIdx, 'buttons', card.buttons.filter((_, i) => i !== bIdx));
  };

  const updateCardQuickReply = (cIdx: number, bIdx: number, val: string) => {
    const card = carouselCards[cIdx];
    updateCarouselCard(cIdx, 'buttons', card.buttons.map((btn, i) => i === bIdx ? { ...btn, title: val } : btn));
  };

  // --- Payload Compilation ---
  const compileAndSend = () => {
    // Basic verification
    if (activeTab === 'button') {
      if (!replyBody.trim()) {
        alert('Body text is required.');
        return;
      }
      if (replyButtons.length === 0) {
        alert('At least one button is required.');
        return;
      }
      for (const btn of replyButtons) {
        if (!btn.title.trim()) {
          alert('Button titles cannot be empty.');
          return;
        }
        if (btn.title.length > 20) {
          alert(`Button title "${btn.title}" exceeds 20 characters limit.`);
          return;
        }
      }

      const metaInteractive = {
        type: 'button',
        ...(replyHeaderType !== 'none' ? {
          header: replyHeaderType === 'text' 
            ? { type: 'text', text: replyHeaderText }
            : { type: replyHeaderType, [replyHeaderType]: { link: replyHeaderLink } }
        } : {}),
        body: { text: replyBody },
        ...(replyFooter.trim() ? { footer: { text: replyFooter } } : {}),
        action: {
          buttons: replyButtons.map((btn) => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title }
          }))
        }
      };

      onSelect({
        type: 'interactive',
        body: `[INTERACTIVE]${JSON.stringify(metaInteractive)}`,
        payload: { interactive: metaInteractive }
      });
    }

    if (activeTab === 'cta_url') {
      if (!ctaBody.trim()) {
        alert('Body text is required.');
        return;
      }
      if (!ctaDisplayText.trim() || !ctaUrl.trim()) {
        alert('CTA button display text and URL are required.');
        return;
      }
      if (ctaDisplayText.length > 20) {
        alert('CTA button display text exceeds 20 characters.');
        return;
      }

      const metaInteractive = {
        type: 'cta_url',
        ...(ctaHeaderType !== 'none' ? {
          header: ctaHeaderType === 'text' 
            ? { type: 'text', text: ctaHeaderText }
            : { type: ctaHeaderType, [ctaHeaderType]: { link: ctaHeaderLink } }
        } : {}),
        body: { text: ctaBody },
        ...(ctaFooter.trim() ? { footer: { text: ctaFooter } } : {}),
        action: {
          name: 'cta_url',
          parameters: {
            display_text: ctaDisplayText,
            url: ctaUrl
          }
        }
      };

      onSelect({
        type: 'interactive',
        body: `[INTERACTIVE]${JSON.stringify(metaInteractive)}`,
        payload: { interactive: metaInteractive }
      });
    }

    if (activeTab === 'list') {
      if (!listBody.trim()) {
        alert('Body text is required.');
        return;
      }
      if (!listButtonText.trim()) {
        alert('Menu list button text is required.');
        return;
      }
      if (listButtonText.length > 20) {
        alert('Menu list button text exceeds 20 characters limit.');
        return;
      }
      if (listSections.length === 0) {
        alert('At least one section is required.');
        return;
      }

      let totalRows = 0;
      for (const sec of listSections) {
        if (!sec.title.trim()) {
          alert('Section titles cannot be empty.');
          return;
        }
        if (sec.title.length > 24) {
          alert(`Section title "${sec.title}" exceeds 24 characters limit.`);
          return;
        }
        if (sec.rows.length === 0) {
          alert(`Section "${sec.title}" has no row options.`);
          return;
        }
        totalRows += sec.rows.length;
        for (const row of sec.rows) {
          if (!row.title.trim()) {
            alert('Item titles cannot be empty.');
            return;
          }
          if (row.title.length > 24) {
            alert(`Item title "${row.title}" exceeds 24 characters.`);
            return;
          }
          if (row.description && row.description.length > 72) {
            alert(`Item description "${row.description}" exceeds 72 characters.`);
            return;
          }
        }
      }

      if (totalRows > 10) {
        alert(`A list message cannot have more than 10 row items total. Currently has ${totalRows}.`);
        return;
      }

      const metaInteractive = {
        type: 'list',
        ...(listHeaderText.trim() ? { header: { type: 'text', text: listHeaderText } } : {}),
        body: { text: listBody },
        ...(listFooter.trim() ? { footer: { text: listFooter } } : {}),
        action: {
          button: listButtonText,
          sections: listSections.map((sec) => ({
            title: sec.title,
            rows: sec.rows.map((row) => ({
              id: row.id,
              title: row.title,
              ...(row.description.trim() ? { description: row.description } : {})
            }))
          }))
        }
      };

      onSelect({
        type: 'interactive',
        body: `[INTERACTIVE]${JSON.stringify(metaInteractive)}`,
        payload: { interactive: metaInteractive }
      });
    }

    if (activeTab === 'carousel') {
      if (carouselCards.length < 2 || carouselCards.length > 10) {
        alert('Carousels must contain between 2 and 10 cards.');
        return;
      }

      for (let i = 0; i < carouselCards.length; i++) {
        const card = carouselCards[i];
        if (!card.headerLink.trim()) {
          alert(`Card ${i + 1} requires a header link.`);
          return;
        }
        if (!card.bodyText.trim()) {
          alert(`Card ${i + 1} requires body text.`);
          return;
        }
        if (card.bodyText.length > 120) {
          alert(`Card ${i + 1} body text exceeds 120 characters limit.`);
          return;
        }
        if (card.buttonType === 'cta_url') {
          if (!card.ctaDisplay.trim() || !card.ctaUrl.trim()) {
            alert(`Card ${i + 1} requires button label and URL.`);
            return;
          }
          if (card.ctaDisplay.length > 20) {
            alert(`Card ${i + 1} button label exceeds 20 characters.`);
            return;
          }
        } else {
          if (card.buttons.length === 0) {
            alert(`Card ${i + 1} requires at least one quick reply button.`);
            return;
          }
          for (const btn of card.buttons) {
            if (!btn.title.trim()) {
              alert(`Card ${i + 1} quick reply title cannot be empty.`);
              return;
            }
            if (btn.title.length > 20) {
              alert(`Card ${i + 1} quick reply "${btn.title}" exceeds 20 characters limit.`);
              return;
            }
          }
        }
      }

      const metaInteractive = {
        type: 'carousel',
        ...(carouselBody.trim() ? { body: { text: carouselBody } } : {}),
        action: {
          cards: carouselCards.map((card, idx) => {
            const isCta = card.buttonType === 'cta_url';
            return {
              card_index: idx,
              type: 'cta_url', // The API payload type key for carousel cards is cta_url
              header: {
                type: card.headerType,
                [card.headerType]: { link: card.headerLink }
              },
              body: { text: card.bodyText },
              action: isCta ? {
                name: 'cta_url',
                parameters: {
                  display_text: card.ctaDisplay,
                  url: card.ctaUrl
                }
              } : {
                buttons: card.buttons.map(btn => ({
                  type: 'quick_reply',
                  quick_reply: { id: btn.id, title: btn.title }
                }))
              }
            };
          })
        }
      };

      onSelect({
        type: 'interactive',
        body: `[INTERACTIVE]${JSON.stringify(metaInteractive)}`,
        payload: { interactive: metaInteractive }
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl h-[680px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-[#128C7E]" />
              WhatsApp Interactive Builder
            </h3>
            <p className="text-[12px] text-gray-500">Construct and preview high-engagement interactive messages.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-gray-50 px-6 py-2 border-b border-gray-100 shrink-0 gap-1.5">
          {[
            { id: 'button', label: 'Reply Buttons', desc: 'Simulated options', icon: MessageSquare },
            { id: 'cta_url', label: 'CTA Link', desc: 'Web URL redirect', icon: Globe },
            { id: 'list', label: 'List Options', desc: 'Multi-select catalog', icon: List },
            { id: 'carousel', label: 'Media Carousel', desc: 'Sliding product cards', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-left transition-all cursor-pointer",
                  activeTab === tab.id 
                    ? "bg-white text-[#128C7E] shadow-sm border border-gray-200/80 font-bold scale-[1.01]" 
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 font-medium"
                )}
              >
                <Icon className={cn("w-4 h-4", activeTab === tab.id ? "text-[#128C7E]" : "text-gray-400")} />
                <div className="flex flex-col leading-none">
                  <span className="text-[12px]">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Split Content */}
        <div className="flex-1 flex min-h-0 bg-white">
          {/* Left Form Configurations */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 border-r border-gray-100 text-left">
            
            {/* === TAB 1: REPLY BUTTONS FORM === */}
            {activeTab === 'button' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Header Type</label>
                  <select 
                    value={replyHeaderType} 
                    onChange={(e) => setReplyHeaderType(e.target.value as any)}
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                  >
                    <option value="none">No Header</option>
                    <option value="text">Text Title</option>
                    <option value="image">Image (URL)</option>
                    <option value="video">Video (URL)</option>
                  </select>
                </div>

                {replyHeaderType === 'text' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-bold text-gray-700">Header Text</label>
                    <input 
                      type="text" 
                      value={replyHeaderText} 
                      onChange={(e) => setReplyHeaderText(e.target.value)}
                      placeholder="e.g. Action Required"
                      className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                    />
                  </div>
                )}

                {(replyHeaderType === 'image' || replyHeaderType === 'video') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-bold text-gray-700">{replyHeaderType === 'image' ? 'Image URL' : 'Video URL'}</label>
                    <input 
                      type="text" 
                      value={replyHeaderLink} 
                      onChange={(e) => setReplyHeaderLink(e.target.value)}
                      placeholder="https://example.com/asset.mp4"
                      className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Body Text *</label>
                    <span className={cn("text-[10px] font-bold", replyBody.length > 1024 ? "text-red-500" : "text-gray-400")}>
                      {replyBody.length}/1024
                    </span>
                  </div>
                  <textarea 
                    value={replyBody} 
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={3}
                    placeholder="Enter main message body..."
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Footer Text</label>
                    <span className={cn("text-[10px] font-bold", replyFooter.length > 60 ? "text-red-500" : "text-gray-400")}>
                      {replyFooter.length}/60
                    </span>
                  </div>
                  <input 
                    type="text" 
                    value={replyFooter} 
                    onChange={(e) => setReplyFooter(e.target.value)}
                    placeholder="Optional footer tagline"
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Buttons (Max 3)</label>
                    <button 
                      onClick={addReplyButton} 
                      disabled={replyButtons.length >= 3}
                      className="text-[11px] font-bold text-[#128C7E] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Button
                    </button>
                  </div>
                  <div className="space-y-2">
                    {replyButtons.map((btn, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200/50">
                        <input 
                          type="text" 
                          value={btn.title} 
                          onChange={(e) => updateReplyButton(idx, 'title', e.target.value)}
                          placeholder="Button Label"
                          maxLength={20}
                          className="flex-1 border border-gray-200 rounded-md p-1.5 text-[12px] bg-white focus:outline-none"
                        />
                        <input 
                          type="text" 
                          value={btn.id} 
                          onChange={(e) => updateReplyButton(idx, 'id', e.target.value)}
                          placeholder="Button ID (Payload)"
                          className="w-[140px] border border-gray-200 rounded-md p-1.5 text-[11px] bg-white focus:outline-none font-mono"
                        />
                        <button 
                          onClick={() => removeReplyButton(idx)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* === TAB 2: CTA URL BUTTON FORM === */}
            {activeTab === 'cta_url' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Header Type</label>
                  <select 
                    value={ctaHeaderType} 
                    onChange={(e) => setCtaHeaderType(e.target.value as any)}
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                  >
                    <option value="none">No Header</option>
                    <option value="text">Text Title</option>
                    <option value="image">Image (URL)</option>
                    <option value="video">Video (URL)</option>
                  </select>
                </div>

                {ctaHeaderType === 'text' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-bold text-gray-700">Header Text</label>
                    <input 
                      type="text" 
                      value={ctaHeaderText} 
                      onChange={(e) => setCtaHeaderText(e.target.value)}
                      placeholder="e.g. Limited Offer"
                      className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                    />
                  </div>
                )}

                {(ctaHeaderType === 'image' || ctaHeaderType === 'video') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-bold text-gray-700">{ctaHeaderType === 'image' ? 'Image URL' : 'Video URL'}</label>
                    <input 
                      type="text" 
                      value={ctaHeaderLink} 
                      onChange={(e) => setCtaHeaderLink(e.target.value)}
                      placeholder="https://example.com/asset.jpg"
                      className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Body Text *</label>
                    <span className={cn("text-[10px] font-bold", ctaBody.length > 1024 ? "text-red-500" : "text-gray-400")}>
                      {ctaBody.length}/1024
                    </span>
                  </div>
                  <textarea 
                    value={ctaBody} 
                    onChange={(e) => setCtaBody(e.target.value)}
                    rows={3}
                    placeholder="Enter main message body..."
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Footer Text</label>
                    <span className={cn("text-[10px] font-bold", ctaFooter.length > 60 ? "text-red-500" : "text-gray-400")}>
                      {ctaFooter.length}/60
                    </span>
                  </div>
                  <input 
                    type="text" 
                    value={ctaFooter} 
                    onChange={(e) => setCtaFooter(e.target.value)}
                    placeholder="Optional footer tagline"
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Button Label *</label>
                    <input 
                      type="text" 
                      value={ctaDisplayText} 
                      onChange={(e) => setCtaDisplayText(e.target.value)}
                      placeholder="e.g. Visit Website"
                      maxLength={20}
                      className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Target URL *</label>
                    <input 
                      type="text" 
                      value={ctaUrl} 
                      onChange={(e) => setCtaUrl(e.target.value)}
                      placeholder="https://yourstore.com"
                      className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* === TAB 3: LIST PICKER FORM === */}
            {activeTab === 'list' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Header Title</label>
                  <input 
                    type="text" 
                    value={listHeaderText} 
                    onChange={(e) => setListHeaderText(e.target.value)}
                    maxLength={60}
                    placeholder="Optional list header text"
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Body Text *</label>
                    <span className={cn("text-[10px] font-bold", listBody.length > 1024 ? "text-red-500" : "text-gray-400")}>
                      {listBody.length}/1024
                    </span>
                  </div>
                  <textarea 
                    value={listBody} 
                    onChange={(e) => setListBody(e.target.value)}
                    rows={2}
                    placeholder="Enter main message body..."
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Footer Text</label>
                  <input 
                    type="text" 
                    value={listFooter} 
                    onChange={(e) => setListFooter(e.target.value)}
                    maxLength={60}
                    placeholder="Optional footer tagline"
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">List Trigger Button Title *</label>
                  <input 
                    type="text" 
                    value={listButtonText} 
                    onChange={(e) => setListButtonText(e.target.value)}
                    maxLength={20}
                    placeholder="e.g. View Topics"
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none"
                  />
                </div>

                {/* Sections and Rows */}
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Catalog Sections</label>
                    <button 
                      onClick={addListSection}
                      className="text-[11px] font-bold text-[#128C7E] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Section
                    </button>
                  </div>

                  <div className="space-y-4">
                    {listSections.map((sec, sIdx) => (
                      <div key={sIdx} className="bg-gray-50/50 rounded-xl p-4 border border-gray-200/60 relative">
                        <button 
                          onClick={() => removeListSection(sIdx)}
                          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <div className="flex flex-col gap-1 max-w-[80%] mb-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Section Title</label>
                          <input 
                            type="text" 
                            value={sec.title} 
                            onChange={(e) => updateListSectionTitle(sIdx, e.target.value)}
                            maxLength={24}
                            placeholder="Section Name"
                            className="border-b border-gray-200 bg-transparent py-1 text-[13px] font-bold text-gray-800 focus:outline-none focus:border-[#128C7E]"
                          />
                        </div>

                        {/* Rows List */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10.5px] font-bold text-gray-600">Rows / Choices</span>
                            <button 
                              onClick={() => addListRow(sIdx)}
                              className="text-[10px] font-bold text-[#128C7E] hover:underline cursor-pointer"
                            >
                              + Add Row
                            </button>
                          </div>
                          
                          {sec.rows.map((row, rIdx) => (
                            <div key={rIdx} className="flex gap-2 items-start bg-white p-2.5 rounded-lg border border-gray-200/80 shadow-xs">
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <input 
                                    type="text" 
                                    value={row.title} 
                                    onChange={(e) => updateListRow(sIdx, rIdx, 'title', e.target.value)}
                                    placeholder="Item Title (Max 24)"
                                    maxLength={24}
                                    className="border border-gray-200 rounded-md p-1.5 text-[11.5px] focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <input 
                                    type="text" 
                                    value={row.description} 
                                    onChange={(e) => updateListRow(sIdx, rIdx, 'description', e.target.value)}
                                    placeholder="Description (Max 72)"
                                    maxLength={72}
                                    className="border border-gray-200 rounded-md p-1.5 text-[11.5px] focus:outline-none"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <input 
                                    type="text" 
                                    value={row.id} 
                                    onChange={(e) => updateListRow(sIdx, rIdx, 'id', e.target.value)}
                                    placeholder="Item ID (e.g. select_hosting)"
                                    className="w-full border border-gray-200 rounded-md p-1.5 text-[10px] bg-gray-50 focus:outline-none font-mono"
                                  />
                                </div>
                              </div>
                              <button 
                                onClick={() => removeListRow(sIdx, rIdx)}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors mt-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* === TAB 4: CAROUSEL BUILDER === */}
            {activeTab === 'carousel' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Intro / Carousel Body</label>
                    <span className={cn("text-[10px] font-bold", carouselBody.length > 1024 ? "text-red-500" : "text-gray-400")}>
                      {carouselBody.length}/1024
                    </span>
                  </div>
                  <input 
                    type="text" 
                    value={carouselBody} 
                    onChange={(e) => setCarouselBody(e.target.value)}
                    placeholder="Introductory text before cards (Optional)"
                    className="border border-gray-200 rounded-lg p-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#128C7E]/20"
                  />
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">Cards List (2 to 10)</label>
                    <button 
                      onClick={addCarouselCard} 
                      disabled={carouselCards.length >= 10}
                      className="text-[11px] font-bold text-[#128C7E] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Card
                    </button>
                  </div>

                  <div className="space-y-4">
                    {carouselCards.map((card, cIdx) => (
                      <div key={cIdx} className="bg-gray-50/50 rounded-xl p-4 border border-gray-200/60 relative space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-[#128C7E]">Card #{cIdx + 1}</span>
                          <button 
                            onClick={() => removeCarouselCard(cIdx)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-gray-500">Header Type</label>
                            <select 
                              value={card.headerType} 
                              onChange={(e) => updateCarouselCard(cIdx, 'headerType', e.target.value)}
                              className="border border-gray-200 rounded-md p-1.5 text-[11px] bg-white focus:outline-none"
                            >
                              <option value="image">Image</option>
                              <option value="video">Video</option>
                            </select>
                          </div>
                          <div className="col-span-2 flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-gray-500">Media URL *</label>
                            <input 
                              type="text" 
                              value={card.headerLink} 
                              onChange={(e) => updateCarouselCard(cIdx, 'headerLink', e.target.value)}
                              placeholder="https://..."
                              className="border border-gray-200 rounded-md p-1.5 text-[11px] bg-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-semibold text-gray-500">Card Body Text *</label>
                            <span className={cn("text-[9px] font-bold", card.bodyText.length > 120 ? "text-red-500" : "text-gray-400")}>
                              {card.bodyText.length}/120
                            </span>
                          </div>
                          <textarea 
                            value={card.bodyText} 
                            onChange={(e) => updateCarouselCard(cIdx, 'bodyText', e.target.value)}
                            rows={2}
                            placeholder="Brief description for this card..."
                            className="border border-gray-200 rounded-md p-1.5 text-[11px] bg-white focus:outline-none resize-none"
                          />
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-gray-200/50 space-y-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-600 uppercase">Button Type</label>
                            <select 
                              value={card.buttonType} 
                              onChange={(e) => updateCarouselCard(cIdx, 'buttonType', e.target.value)}
                              className="border border-gray-200 rounded-md p-1.5 text-[11px] bg-gray-50 focus:outline-none font-semibold text-gray-700"
                            >
                              <option value="cta_url">URL Link (1 Button)</option>
                              <option value="quick_reply">Quick Reply (1-2 Buttons)</option>
                            </select>
                          </div>

                          {card.buttonType === 'cta_url' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9.5px] text-gray-500">Button Label</label>
                                <input 
                                  type="text" 
                                  value={card.ctaDisplay} 
                                  onChange={(e) => updateCarouselCard(cIdx, 'ctaDisplay', e.target.value)}
                                  placeholder="e.g. View Item"
                                  maxLength={20}
                                  className="border border-gray-200 rounded-md p-1.5 text-[11.5px]"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9.5px] text-gray-500">Redirect Link</label>
                                  <input 
                                    type="text" 
                                    value={card.ctaUrl} 
                                    onChange={(e) => updateCarouselCard(cIdx, 'ctaUrl', e.target.value)}
                                    placeholder="https://..."
                                    className="border border-gray-200 rounded-md p-1.5 text-[11.5px]"
                                  />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[9.5px] text-gray-500 font-bold">Quick Replies</span>
                                <button 
                                  onClick={() => addCardQuickReply(cIdx)} 
                                  disabled={card.buttons.length >= 2}
                                  className="text-[9px] font-bold text-[#128C7E] disabled:opacity-30 cursor-pointer"
                                >
                                  + Add Reply
                                </button>
                              </div>
                              {card.buttons.map((btn, bIdx) => (
                                <div key={bIdx} className="flex gap-2 items-center bg-gray-50 p-1.5 rounded border border-gray-200/50">
                                  <input 
                                    type="text" 
                                    value={btn.title} 
                                    onChange={(e) => updateCardQuickReply(cIdx, bIdx, e.target.value)}
                                    placeholder="Button Title (Max 20)"
                                    maxLength={20}
                                    className="flex-1 border border-gray-200 rounded p-1 text-[11px] bg-white focus:outline-none"
                                  />
                                  <button 
                                    onClick={() => removeCardQuickReply(cIdx, bIdx)}
                                    className="text-gray-400 hover:text-red-500 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Phone Mockup Preview */}
          <div className="w-[380px] bg-gray-100 p-6 flex flex-col items-center justify-center shrink-0 border-l border-gray-200/60 overflow-y-auto">
            <div className="text-[11px] font-bold text-gray-400 mb-3 flex items-center gap-1 uppercase tracking-widest">
              <Smartphone className="w-3.5 h-3.5" /> Live Simulator
            </div>
            
            {/* Phone Container */}
            <div className="w-[300px] bg-[#E5DDD5] rounded-[32px] border-8 border-gray-900 shadow-xl overflow-hidden flex flex-col min-h-[440px] max-h-[460px] relative text-left">
              {/* Phone Header */}
              <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between text-[11px] font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-5.5 h-5.5 rounded-full bg-[#128C7E] flex items-center justify-center text-[8px] text-white select-none">WF</div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px]">WhatFlow Business</span>
                    <span className="text-[8px] text-emerald-100 font-medium">Online</span>
                  </div>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {/* Chat Area */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#E5DDD5] select-none flex flex-col justify-end">
                
                {/* Simulated Outbound Message Bubble */}
                <div className="max-w-[90%] self-end bg-[#DCF8C6] rounded-xl rounded-tr-none px-3 py-2 border border-[#d1ecd1] shadow-xs text-gray-900 flex flex-col gap-1 relative overflow-hidden">
                  
                  {/* --- MOCK: REPLY BUTTONS PREVIEW --- */}
                  {activeTab === 'button' && (
                    <div className="text-[12px] flex flex-col">
                      {replyHeaderType === 'text' && replyHeaderText && (
                        <div className="font-bold border-b border-gray-200/40 pb-1 mb-1 text-[12px]">{replyHeaderText}</div>
                      )}
                      {replyHeaderType === 'image' && replyHeaderLink && (
                        <div className="rounded-lg overflow-hidden mb-1.5 border border-gray-200/30">
                          <img src={replyHeaderLink} className="max-h-[100px] w-full object-cover block" alt="Header preview" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/300x150?text=Preview+Image'; }} />
                        </div>
                      )}
                      {replyHeaderType === 'video' && replyHeaderLink && (
                        <div className="rounded-lg overflow-hidden mb-1.5 border border-gray-200/30 relative bg-black flex items-center justify-center h-[90px]">
                          <Video className="w-8 h-8 text-white/70" />
                        </div>
                      )}
                      <div className="font-medium whitespace-pre-wrap">{replyBody || 'Enter body text...'}</div>
                      {replyFooter.trim() && <div className="text-[9px] text-gray-500 mt-1 font-semibold">{replyFooter}</div>}
                      
                      <div className="border-t border-gray-200/60 mt-2 -mx-3 -mb-2 flex flex-col divide-y divide-gray-200/60 bg-white/40">
                        {replyButtons.map((btn, idx) => (
                          <div key={idx} className="py-2 text-center text-[11px] font-bold text-[#128C7E] hover:bg-white/30">
                            {btn.title || 'Button Option'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* --- MOCK: CTA URL PREVIEW --- */}
                  {activeTab === 'cta_url' && (
                    <div className="text-[12px] flex flex-col">
                      {ctaHeaderType === 'text' && ctaHeaderText && (
                        <div className="font-bold border-b border-gray-200/40 pb-1 mb-1 text-[12px]">{ctaHeaderText}</div>
                      )}
                      {ctaHeaderType === 'image' && ctaHeaderLink && (
                        <div className="rounded-lg overflow-hidden mb-1.5 border border-gray-200/30">
                          <img src={ctaHeaderLink} className="max-h-[100px] w-full object-cover block" alt="Header preview" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/300x150?text=Preview+Image'; }} />
                        </div>
                      )}
                      {ctaHeaderType === 'video' && ctaHeaderLink && (
                        <div className="rounded-lg overflow-hidden mb-1.5 border border-gray-200/30 relative bg-black flex items-center justify-center h-[90px]">
                          <Video className="w-8 h-8 text-white/70" />
                        </div>
                      )}
                      <div className="font-medium whitespace-pre-wrap">{ctaBody || 'Enter body text...'}</div>
                      {ctaFooter.trim() && <div className="text-[9px] text-gray-500 mt-1 font-semibold">{ctaFooter}</div>}
                      
                      <div className="border-t border-gray-200/60 mt-2 -mx-3 -mb-2 py-2 flex items-center justify-center gap-1 text-[11px] font-bold text-sky-600 bg-white/40">
                        <ExternalLink className="w-3 h-3" />
                        {ctaDisplayText || 'Visit Link'}
                      </div>
                    </div>
                  )}

                  {/* --- MOCK: LIST MENU PREVIEW --- */}
                  {activeTab === 'list' && (
                    <div className="text-[12px] flex flex-col">
                      {listHeaderText.trim() && (
                        <div className="font-bold border-b border-gray-200/40 pb-1 mb-1 text-[11.5px]">{listHeaderText}</div>
                      )}
                      <div className="font-medium whitespace-pre-wrap">{listBody || 'Enter body text...'}</div>
                      {listFooter.trim() && <div className="text-[9px] text-gray-500 mt-1 font-semibold">{listFooter}</div>}
                      
                      <div className="border-t border-gray-200/60 mt-2 -mx-3 -mb-2 p-1.5 bg-[#DCF8C6]">
                        <div className="py-1.5 px-2 bg-white rounded border border-gray-200/50 shadow-xs flex items-center justify-between text-[11px] font-bold text-gray-800">
                          <span className="flex items-center gap-1">
                            <List className="w-3.5 h-3.5 text-[#128C7E]" />
                            {listButtonText || 'Select Option'}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- MOCK: CAROUSEL PREVIEW --- */}
                  {activeTab === 'carousel' && (
                    <div className="text-[12px] flex flex-col max-w-full">
                      {carouselBody.trim() && <div className="font-medium mb-1.5">{carouselBody}</div>}
                      
                      {/* Horizontal mockup */}
                      <div className="flex gap-2 overflow-x-auto pb-1 max-w-[240px] scrollbar-thin">
                        {carouselCards.map((card, idx) => (
                          <div key={idx} className="w-[140px] shrink-0 bg-white rounded-lg border border-gray-200/60 overflow-hidden flex flex-col">
                            {card.headerLink ? (
                              <div className="h-[60px] w-full bg-gray-50 relative border-b border-gray-100 flex items-center justify-center">
                                {card.headerType === 'video' ? (
                                  <Video className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <img src={card.headerLink} className="h-full w-full object-cover block" alt="Card preview" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/150x80?text=Card'; }} />
                                )}
                              </div>
                            ) : (
                              <div className="h-[60px] w-full bg-gray-100 flex items-center justify-center text-gray-300">
                                <Image className="w-4 h-4" />
                              </div>
                            )}
                            <div className="p-1.5 flex-1">
                              <div className="text-[9.5px] leading-tight text-gray-800 line-clamp-2 font-medium">{card.bodyText || 'Card Body...'}</div>
                            </div>
                            <div className="border-t border-gray-100 bg-gray-50/20 divide-y divide-gray-100 flex flex-col">
                              {card.buttonType === 'cta_url' ? (
                                <div className="py-1.5 text-center text-[8.5px] font-bold text-sky-600 flex items-center justify-center gap-0.5">
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  {card.ctaDisplay || 'Link'}
                                </div>
                              ) : (
                                card.buttons.map((btn, bIdx) => (
                                  <div key={bIdx} className="py-1 text-center text-[8.5px] font-bold text-[#128C7E]">
                                    {btn.title || 'Action'}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tiny timestamp ticks */}
                  <div className="text-[8px] mt-0.5 self-end text-gray-500/80 font-semibold flex items-center gap-0.5 leading-none">
                    <span>15:10</span>
                    <svg viewBox="0 0 16 15" width="12" height="12" fill="none" className="text-sky-500"><path d="M15.01 3.3a.5.5 0 0 0-.08-.03.5.5 0 0 0-.46.08L8.12 9.7l-3.2-3.2a.5.5 0 0 0-.7.7l3.56 3.56a.5.5 0 0 0 .7 0l6.82-6.83a.5.5 0 0 0-.29-.63z" fill="currentColor"/><path d="M11.16 9.7L9.56 8.1l-.7.7 2.3 2.3a.5.5 0 0 0 .7 0l6.82-6.83a.5.5 0 0 0-.07-.78.5.5 0 0 0-.64.08L11.16 9.7z" fill="currentColor"/></svg>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-400">
            <Smartphone className="w-4 h-4 text-gray-400" />
            Meta WhatsApp Cloud API Compliance Enforced
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onClose} 
              className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-semibold hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              onClick={compileAndSend}
              className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-lg text-[13px] font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              Send Interactive
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
