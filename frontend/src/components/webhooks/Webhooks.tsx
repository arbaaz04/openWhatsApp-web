import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe, Plus, Trash2, RotateCw, Eye, EyeOff, Copy, Check,
  ChevronDown, ChevronUp, Activity, Pause, Zap, AlertCircle,
  ExternalLink, Shield
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WebhookEvent =
  | 'conversation.message.received'
  | 'conversation.message.sent'
  | 'conversation.window.opened'
  | 'conversation.window.closed';

const ALL_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  { value: 'conversation.message.received', label: 'Message Received', description: 'Fired when a new inbound message arrives' },
  { value: 'conversation.message.sent', label: 'Message Sent', description: 'Fired when an outbound message is sent' },
  { value: 'conversation.window.opened', label: 'Window Opened', description: 'Fired when the 24-hour messaging window opens' },
  { value: 'conversation.window.closed', label: 'Window Closed', description: 'Fired when the 24-hour messaging window closes' },
];

interface Webhook {
  id: number;
  teamId: number;
  channelId: number | null;
  kind: 'whatflow-web' | 'meta';
  url: string;
  secret: '***';
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function useApi() {
  const { session, teams } = useAuth();
  const teamId = teams[0]?.teamId;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

  const authFetch = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`${apiUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          ...(init?.headers || {}),
        },
      }),
    [apiUrl, session?.access_token]
  );

  return { authFetch, teamId, apiUrl };
}

// ---------------------------------------------------------------------------
// Main Webhooks Component
// ---------------------------------------------------------------------------

export function Webhooks() {
  const { teams } = useAuth();
  const { authFetch, teamId } = useApi();

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    if (!teamId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch(`/api/teams/${teamId}/webhooks`);
      if (!res.ok) throw new Error(`Failed to load webhooks (${res.status})`);
      const data = await res.json();
      setWebhooks(data.webhooks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [authFetch, teamId]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleDelete = async (webhookId: number) => {
    if (!teamId || !confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) return;
    try {
      const res = await authFetch(`/api/teams/${teamId}/webhooks/${webhookId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete webhook');
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const handleToggle = async (webhook: Webhook) => {
    if (!teamId) return;
    try {
      const res = await authFetch(`/api/teams/${teamId}/webhooks/${webhook.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !webhook.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update webhook');
      const data = await res.json();
      setWebhooks((prev) => prev.map((w) => (w.id === webhook.id ? data.webhook : w)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update webhook');
    }
  };

  if (!teams.length) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <p className="text-gray-500 text-[14px] font-medium">No team found. Please set up your team first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white overflow-y-auto no-scrollbar">
      <div className="max-w-4xl mx-auto px-8 py-12 space-y-8">

        {/* Header */}
        <div className="flex justify-between items-end border-b border-[#EDEDED] pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Webhooks</h1>
            <p className="text-[14px] text-gray-500 font-medium">
              Register endpoints to receive real-time event notifications from your workspace.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="h-9 px-4 bg-[#128C7E] hover:bg-[#075E54] text-white text-[13px] font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add webhook
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <CreateWebhookForm
            teamId={teamId!}
            authFetch={authFetch}
            onCreated={(webhook) => {
              setWebhooks((prev) => [webhook, ...prev]);
              setShowCreateForm(false);
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {/* Docs Info Banner */}
        <div className="flex items-start gap-3 bg-[#128C7E]/5 border border-[#128C7E]/15 rounded-xl p-4">
          <Shield className="w-4 h-4 text-[#128C7E] mt-0.5 shrink-0" />
          <div className="text-[13px] text-gray-700 space-y-1">
            <p className="font-semibold text-gray-900">Secure webhook delivery</p>
            <p className="text-gray-500 leading-relaxed">
              Every request includes an <code className="bg-white px-1 py-0.5 rounded border border-gray-200 text-[11px] font-mono text-gray-700">X-WhatFlow-Signature-256</code> header — an HMAC-SHA256 of the payload signed with your webhook secret. Verify this on your server.
            </p>
          </div>
        </div>

        {/* Webhook List */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
              <Globe className="w-4 h-4 text-gray-400" />
            </div>
            <h2 className="text-[15px] font-bold text-gray-900">Registered endpoints</h2>
            {webhooks.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">
                {webhooks.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse border border-[#EDEDED]" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-[13px] font-medium">{error}</p>
            </div>
          ) : webhooks.length === 0 ? (
            <EmptyState onAdd={() => setShowCreateForm(true)} />
          ) : (
            webhooks.map((webhook) => (
              <WebhookCard
                key={webhook.id}
                webhook={webhook}
                teamId={teamId!}
                authFetch={authFetch}
                onDelete={() => handleDelete(webhook.id)}
                onToggle={() => handleToggle(webhook)}
                onUpdate={(updated) =>
                  setWebhooks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-20 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center space-y-4 bg-gray-50/20">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-200 shadow-inner">
        <Globe className="w-6 h-6 text-gray-300" />
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-[15px] font-bold text-gray-900">No webhooks yet</h3>
        <p className="text-[13px] text-gray-500 font-medium">Register an endpoint to start receiving real-time events.</p>
      </div>
      <button
        onClick={onAdd}
        className="px-6 py-2 bg-white border border-[#EDEDED] text-[#128C7E] text-[13px] font-bold rounded-lg shadow-sm hover:shadow-md transition-all mt-2"
      >
        Add your first webhook
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webhook Card
// ---------------------------------------------------------------------------

interface WebhookCardProps {
  webhook: Webhook;
  teamId: number;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onDelete: () => void;
  onToggle: () => void;
  onUpdate: (webhook: Webhook) => void;
}

function WebhookCard({ webhook, teamId, authFetch, onDelete, onToggle, onUpdate }: WebhookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [editingEvents, setEditingEvents] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>(webhook.events as WebhookEvent[]);
  const [savingEvents, setSavingEvents] = useState(false);

  const handleRotateSecret = async () => {
    if (!confirm('Rotate the signing secret? Your current secret will stop working immediately.')) return;
    setRotating(true);
    try {
      const res = await authFetch(`/api/teams/${teamId}/webhooks/${webhook.id}/rotate-secret`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to rotate secret');
      const data = await res.json();
      setNewSecret(data.secretPlaintext);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rotate secret');
    } finally {
      setRotating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEvents = async () => {
    setSavingEvents(true);
    try {
      const res = await authFetch(`/api/teams/${teamId}/webhooks/${webhook.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ events: selectedEvents }),
      });
      if (!res.ok) throw new Error('Failed to update events');
      const data = await res.json();
      onUpdate(data.webhook);
      setEditingEvents(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update events');
    } finally {
      setSavingEvents(false);
    }
  };

  const visibleSecret = newSecret ?? '••••••••••••••••••••••••••••••••';

  return (
    <div className={cn(
      "border rounded-2xl overflow-hidden transition-all",
      webhook.isActive ? "border-[#EDEDED]" : "border-gray-100 opacity-70"
    )}>
      {/* Card Header */}
      <div className="p-5 bg-white flex items-center gap-4">
        {/* Status indicator */}
        <div className={cn(
          "w-2 h-2 rounded-full shrink-0",
          webhook.isActive ? "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.3)]" : "bg-gray-300"
        )} />

        {/* URL */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-gray-900 truncate font-mono">{webhook.url}</p>
            <a
              href={webhook.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
              webhook.kind === 'whatflow-web'
                ? "bg-[#128C7E]/8 text-[#128C7E] border border-[#128C7E]/20"
                : "bg-blue-50 text-blue-600 border border-blue-200"
            )}>
              {webhook.kind}
            </span>
            <span className="text-[11px] text-gray-400">
              {webhook.events.length === 0 ? 'All events' : `${webhook.events.length} event${webhook.events.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggle}
            title={webhook.isActive ? 'Pause webhook' : 'Activate webhook'}
            className={cn(
              "h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all border",
              webhook.isActive
                ? "text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100"
                : "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
            )}
          >
            {webhook.isActive ? <Pause className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
            {webhook.isActive ? 'Pause' : 'Activate'}
          </button>

          <button
            onClick={onDelete}
            title="Delete webhook"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 border border-[#EDEDED] transition-all"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-[#EDEDED] bg-gray-50/50 divide-y divide-[#EDEDED]">

          {/* Secret section */}
          <div className="px-5 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> Signing Secret
              </p>
              <div className="flex items-center gap-2">
                {newSecret && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                    New secret — copy now!
                  </span>
                )}
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="h-6 px-2 text-[11px] text-gray-400 hover:text-gray-700 border border-[#EDEDED] rounded-md flex items-center gap-1 transition-colors bg-white"
                >
                  {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showSecret ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => newSecret && handleCopy(newSecret)}
                  disabled={!newSecret}
                  className={cn(
                    "h-6 px-2 text-[11px] border rounded-md flex items-center gap-1 transition-colors bg-white",
                    newSecret ? "text-gray-400 hover:text-gray-700 border-[#EDEDED] cursor-pointer" : "text-gray-200 border-gray-100 cursor-not-allowed"
                  )}
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  Copy
                </button>
                <button
                  onClick={handleRotateSecret}
                  disabled={rotating}
                  className="h-6 px-2 text-[11px] text-gray-400 hover:text-orange-600 border border-[#EDEDED] hover:border-orange-200 hover:bg-orange-50 rounded-md flex items-center gap-1 transition-all bg-white"
                >
                  <RotateCw className={cn("w-3 h-3", rotating && "animate-spin")} />
                  Rotate
                </button>
              </div>
            </div>
            <div className="font-mono text-[12px] bg-white border border-[#EDEDED] rounded-lg px-3 py-2 text-gray-600 tracking-wider">
              {showSecret && newSecret ? newSecret : visibleSecret}
            </div>
            {!newSecret && (
              <p className="text-[11px] text-gray-400">The plaintext secret was shown once at creation. Rotate to generate a new one.</p>
            )}
          </div>

          {/* Events section */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Subscribed Events
              </p>
              {!editingEvents ? (
                <button
                  onClick={() => { setEditingEvents(true); setSelectedEvents(webhook.events as WebhookEvent[]); }}
                  className="h-6 px-2 text-[11px] text-gray-400 hover:text-gray-700 border border-[#EDEDED] rounded-md bg-white transition-colors"
                >
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingEvents(false)} className="h-6 px-2 text-[11px] text-gray-400 hover:text-gray-700 border border-[#EDEDED] rounded-md bg-white transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEvents}
                    disabled={savingEvents}
                    className="h-6 px-2 text-[11px] text-white bg-[#128C7E] hover:bg-[#075E54] rounded-md font-bold transition-colors"
                  >
                    {savingEvents ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ALL_EVENTS.map((event) => {
                const isActive = editingEvents
                  ? selectedEvents.includes(event.value)
                  : webhook.events.includes(event.value);

                return (
                  <button
                    key={event.value}
                    disabled={!editingEvents}
                    onClick={() => {
                      if (!editingEvents) return;
                      setSelectedEvents((prev) =>
                        prev.includes(event.value)
                          ? prev.filter((e) => e !== event.value)
                          : [...prev, event.value]
                      );
                    }}
                    className={cn(
                      "flex items-start gap-2 text-left p-2.5 rounded-lg border transition-all",
                      isActive
                        ? "bg-[#128C7E]/5 border-[#128C7E]/25 text-[#128C7E]"
                        : "bg-white border-[#EDEDED] text-gray-400",
                      editingEvents && "cursor-pointer hover:border-[#128C7E]/40",
                      !editingEvents && "cursor-default"
                    )}
                  >
                    <div className={cn(
                      "w-3.5 h-3.5 rounded-sm border shrink-0 mt-0.5 flex items-center justify-center",
                      isActive ? "bg-[#128C7E] border-[#128C7E]" : "bg-white border-gray-200"
                    )}>
                      {isActive && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div>
                      <p className={cn("text-[11px] font-bold", isActive ? "text-[#128C7E]" : "text-gray-600")}>{event.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{event.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {!editingEvents && webhook.events.length === 0 && (
              <p className="text-[11px] text-gray-400 italic">Subscribed to all events</p>
            )}
          </div>

          {/* Metadata footer */}
          <div className="px-5 py-3 flex items-center justify-between">
            <p className="text-[11px] text-gray-400">ID: <span className="font-mono text-gray-500">wh_{webhook.id}</span></p>
            <p className="text-[11px] text-gray-400">
              Created {new Date(webhook.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Webhook Form
// ---------------------------------------------------------------------------

interface CreateWebhookFormProps {
  teamId: number;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onCreated: (webhook: Webhook) => void;
  onCancel: () => void;
}

function CreateWebhookForm({ teamId, authFetch, onCreated, onCancel }: CreateWebhookFormProps) {
  const [url, setUrl] = useState('');
  const [kind] = useState<'whatflow-web'>('whatflow-web');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.startsWith('https://')) {
      setError('URL must use HTTPS.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch(`/api/teams/${teamId}/webhooks`, {
        method: 'POST',
        body: JSON.stringify({ url, kind, events: selectedEvents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? `Error ${res.status}`);
      setCreatedSecret(data.secretPlaintext);
      onCreated(data.webhook);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySecret = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2500);
    }
  };

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="border-2 border-[#128C7E]/20 rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="px-6 py-4 bg-[#128C7E]/5 border-b border-[#128C7E]/15 flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-gray-900">Register new webhook</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-[12px] transition-colors">
          Cancel
        </button>
      </div>

      {/* Secret reveal banner (shown after creation) */}
      {createdSecret && (
        <div className="mx-6 mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-[13px] font-bold text-amber-800">Copy your signing secret — shown only once!</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-[12px] bg-white border border-amber-200 rounded-lg px-3 py-2 text-amber-900 tracking-wider truncate">
              {createdSecret}
            </code>
            <button
              onClick={handleCopySecret}
              className="h-9 px-3 bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
            >
              {secretCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {secretCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
        {/* URL */}
        <div className="space-y-1.5">
          <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider">
            Endpoint URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks/whatflow"
            required
            className="w-full h-10 px-3 rounded-lg border border-[#EDEDED] text-[13px] font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#128C7E]/30 focus:border-[#128C7E]/50 transition-all"
          />
          <p className="text-[11px] text-gray-400">Must use HTTPS. We'll POST a JSON payload to this URL.</p>
        </div>

        {/* Events */}
        <div className="space-y-2">
          <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider">
            Events to Subscribe <span className="normal-case font-normal text-gray-400 ml-1">(leave empty for all)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_EVENTS.map((event) => {
              const isSelected = selectedEvents.includes(event.value);
              return (
                <button
                  key={event.value}
                  type="button"
                  onClick={() => toggleEvent(event.value)}
                  className={cn(
                    "flex items-start gap-2 text-left p-3 rounded-xl border transition-all",
                    isSelected
                      ? "bg-[#128C7E]/5 border-[#128C7E]/30 ring-1 ring-[#128C7E]/20"
                      : "bg-gray-50/50 border-[#EDEDED] hover:border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <div className={cn(
                    "w-3.5 h-3.5 rounded-sm border shrink-0 mt-0.5 flex items-center justify-center transition-all",
                    isSelected ? "bg-[#128C7E] border-[#128C7E]" : "bg-white border-gray-300"
                  )}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div>
                    <p className={cn("text-[12px] font-bold leading-tight", isSelected ? "text-[#128C7E]" : "text-gray-700")}>{event.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{event.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <p className="text-[12px] text-red-600 font-medium">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#EDEDED]">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 text-[13px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !url}
            className="h-9 px-5 bg-[#128C7E] hover:bg-[#075E54] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            {submitting ? (
              <><RotateCw className="w-3.5 h-3.5 animate-spin" /> Creating…</>
            ) : (
              <><Plus className="w-3.5 h-3.5" /> Create webhook</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
