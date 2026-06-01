/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ParsedMessage {
  replyToWamid?: string;
  media?: {
    type: 'image' | 'video' | 'voice' | 'audio' | 'document';
    id: string;
    caption: string;
  };
  interactive?: any;
  cleanBody: string;
}

/**
 * Parses a message body string for serialization formatting.
 * Matches:
 *  - [REPLY:wamid_here] prefix
 *  - [MEDIA:type:id] prefix
 *  - [INTERACTIVE] prefix
 * Sequential matching allows a message to have reply context, media context, and interactive context.
 */
export function parseMessageBody(body: string): ParsedMessage {
  let current = body || '';
  let replyToWamid: string | undefined;
  let media: ParsedMessage['media'];
  let interactive: any;

  // 1. Match reply prefix
  const replyMatch = current.match(/^\[REPLY:([^\]]+)\]/);
  if (replyMatch) {
    replyToWamid = replyMatch[1];
    current = current.slice(replyMatch[0].length);
  }

  // 2. Match media prefix
  const mediaMatch = current.match(/^\[MEDIA:(image|video|voice|audio|document):([^\]]*)\]/);
  if (mediaMatch) {
    media = {
      type: mediaMatch[1] as 'image' | 'video' | 'voice' | 'audio' | 'document',
      id: mediaMatch[2],
      caption: '',
    };
    current = current.slice(mediaMatch[0].length);
    media.caption = current; // the rest acts as the caption
  }

  // 3. Match interactive prefix
  if (current.startsWith('[INTERACTIVE]')) {
    try {
      const jsonStr = current.slice('[INTERACTIVE]'.length);
      interactive = JSON.parse(jsonStr);
      // Fallback cleanBody for display in notifications, push alerts or chat summaries
      current = interactive.body?.text || 'Interactive Message';
    } catch (e) {
      console.error('Failed to parse interactive payload:', e);
    }
  }

  return {
    replyToWamid,
    media,
    interactive,
    cleanBody: current,
  };
}
