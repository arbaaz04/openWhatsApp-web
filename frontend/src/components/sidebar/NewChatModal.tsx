import React, { useState } from 'react';
import { X, Smartphone, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (phone: string) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose, onStart }) => {
  const [phoneNumber, setPhoneNumber] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.trim()) {
      onStart(phoneNumber.trim());
      onClose();
      setPhoneNumber('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">New Message</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label htmlFor="phone" className="block text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Recipient Phone Number
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <input
                id="phone"
                type="text"
                autoFocus
                placeholder="e.g. +14155552671"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10 transition-all font-medium"
              />
            </div>
          </div>

          <div className="flex gap-3">
             <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 border border-gray-200 text-gray-700 font-bold text-[14px] rounded-xl hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!phoneNumber.trim()}
              className={cn(
                "flex-1 h-11 flex items-center justify-center gap-2 font-bold text-[14px] rounded-xl transition-all shadow-md",
                phoneNumber.trim() 
                  ? "bg-[#128C7E] text-white hover:bg-[#075E54] active:scale-[0.98]" 
                  : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
              )}
            >
              Start Chat
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
