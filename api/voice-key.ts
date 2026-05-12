import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Returns the Gemini API key for voice WebSocket sessions.
 * Voice streaming requires the SDK client-side (can't proxy WebSockets).
 * This keeps the key out of the JS bundle — it's fetched at runtime only
 * when the user explicitly starts a voice session.
 * 
 * SECURITY: Requires a valid Firebase ID token in the Authorization header.
 * Verified via Google's secure token verification endpoint (not OAuth tokeninfo).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // ── Verify Firebase ID token ──────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    // Firebase ID tokens are JWTs signed by Google — verify via Google's
    // secure token endpoint (designed for Firebase Auth tokens, NOT OAuth tokeninfo)
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY}`;
    
    const tokenRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!tokenRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired Firebase token' });
    }

    const data = await tokenRes.json();
    if (!data.users || data.users.length === 0) {
      return res.status(401).json({ error: 'No user found for this token' });
    }
  } catch {
    return res.status(401).json({ error: 'Token verification failed' });
  }

  return res.status(200).json({ key: process.env.GEMINI_API_KEY || '' });
}
