export interface Conversation {
  id: number;
  customerNumber: string;
  whatsappId: string;
  isWindowOpen: boolean;
  lastCustomerMessageAt: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  body: string;
  senderName?: string;
  direction: 'incoming' | 'outgoing';
  time: string;
  type?: 'text' | 'business';
  replyTo?: string;
}

const DB_VERSION = 2;

function getDbName(userId: string): string {
  return `whatflow_db_${userId}`;
}

export function openUserDb(userId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const dbName = getDbName(userId);
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('conversations')) {
        db.createObjectStore('conversations', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('conversationId', 'conversationId', { unique: false });
      }
      if (!db.objectStoreNames.contains('dashboard')) {
        db.createObjectStore('dashboard');
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export function deleteUserDb(userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbName = getDbName(userId);
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function putConversations(userId: string, conversations: Conversation[]): Promise<void> {
  try {
    const db = await openUserDb(userId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readwrite');
      const store = tx.objectStore('conversations');

      store.clear();

      conversations.forEach((conv) => {
        store.put(conv);
      });

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB putConversations error:', err);
  }
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  try {
    const db = await openUserDb(userId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readonly');
      const store = tx.objectStore('conversations');
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB getConversations error:', err);
    return [];
  }
}

export async function putMessages(userId: string, conversationId: string, messages: ChatMessage[]): Promise<void> {
  try {
    const db = await openUserDb(userId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const index = store.index('conversationId');
      
      const request = index.openCursor(IDBKeyRange.only(Number(conversationId)));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          messages.forEach((msg) => {
            store.put({
              ...msg,
              conversationId: Number(conversationId)
            });
          });
        }
      };

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB putMessages error:', err);
  }
}

export async function getMessages(userId: string, conversationId: string): Promise<ChatMessage[]> {
  try {
    const db = await openUserDb(userId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('conversationId');
      const request = index.getAll(IDBKeyRange.only(Number(conversationId)));

      request.onsuccess = () => {
        db.close();
        const result = request.result as Array<ChatMessage & { conversationId: number }>;
        const sorted = result.sort((a, b) => Number(a.id) - Number(b.id));
        resolve(sorted);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB getMessages error:', err);
    return [];
  }
}

export async function putSingleMessage(userId: string, conversationId: string, message: ChatMessage): Promise<void> {
  try {
    const db = await openUserDb(userId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      store.put({
        ...message,
        conversationId: Number(conversationId)
      });

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB putSingleMessage error:', err);
  }
}
export async function putDashboardData(userId: string, key: 'stats' | 'recentMessages', data: unknown): Promise<void> {
  try {
    const db = await openUserDb(userId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('dashboard', 'readwrite');
      const store = tx.objectStore('dashboard');
      store.put(data, key);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB putDashboardData error:', err);
  }
}

export async function getDashboardData(userId: string, key: 'stats' | 'recentMessages'): Promise<unknown> {
  try {
    const db = await openUserDb(userId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('dashboard', 'readonly');
      const store = tx.objectStore('dashboard');
      const request = store.get(key);

      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB getDashboardData error:', err);
    return null;
  }
}
