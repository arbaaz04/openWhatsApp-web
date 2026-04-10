import { describe, it, expect } from 'vitest';
import app from './index.js';

describe('Global App Router', () => {
  it('should successfully ping the root API status', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      message: 'Whatflow API Online'
    });
  });
});
