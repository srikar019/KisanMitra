import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { tavily } from '@tavily/core';
import { GoogleGenAI, Type } from '@google/genai';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'api-proxy-plugin',
          configureServer(server) {
            // ── Tavily search proxy ──
            server.middlewares.use('/api/search', (req, res) => {
              if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                  body += chunk.toString();
                });
                req.on('end', async () => {
                  try {
                    const data = JSON.parse(body);
                    const tavilyClient = tavily({ apiKey: env.TAVILY_API_KEY });
                    const searchResults = await tavilyClient.search(data.query, {
                      searchDepth: data.searchDepth || 'advanced',
                      maxResults: data.maxResults || 5,
                      ...(data.topic && { topic: data.topic }),
                    });
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify(searchResults));
                  } catch (err: any) {
                    console.error('Tavily search error:', err);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message || 'Search failed' }));
                  }
                });
              } else {
                res.statusCode = 405;
                res.end();
              }
            });

            // ── Sentinel Hub satellite proxy ──
            let sentinelToken: string | null = null;
            let sentinelTokenExpiry = 0;

            const getSentinelToken = async (): Promise<string> => {
              if (sentinelToken && Date.now() < sentinelTokenExpiry) return sentinelToken;
              const tokenRes = await fetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  grant_type: 'client_credentials',
                  client_id: env.SENTINEL_CLIENT_ID,
                  client_secret: env.SENTINEL_CLIENT_SECRET,
                }),
              });
              if (!tokenRes.ok) throw new Error(`Sentinel auth failed: ${tokenRes.status}`);
              const tokenData = await tokenRes.json();
              sentinelToken = tokenData.access_token;
              sentinelTokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;
              return sentinelToken!;
            };

            server.middlewares.use('/api/satellite', (req, res) => {
              if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', async () => {
                  try {
                    const data = JSON.parse(body);
                    const token = await getSentinelToken();
                    const { endpoint, payload, responseType } = data;

                    const apiUrl = `https://sh.dataspace.copernicus.eu/api/v1/${endpoint}`;
                    const acceptHeader = responseType === 'image' ? 'image/png' : 'application/json';

                    const shRes = await fetch(apiUrl, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': acceptHeader,
                      },
                      body: JSON.stringify(payload),
                    });

                    if (!shRes.ok) {
                      const errText = await shRes.text();
                      console.error('Sentinel Hub error:', shRes.status, errText);
                      res.statusCode = shRes.status;
                      res.end(JSON.stringify({ error: errText }));
                      return;
                    }

                    if (responseType === 'image') {
                      const buffer = Buffer.from(await shRes.arrayBuffer());
                      const base64 = buffer.toString('base64');
                      res.setHeader('Content-Type', 'application/json');
                      res.statusCode = 200;
                      res.end(JSON.stringify({ image: `data:image/png;base64,${base64}` }));
                    } else {
                      const json = await shRes.json();
                      res.setHeader('Content-Type', 'application/json');
                      res.statusCode = 200;
                      res.end(JSON.stringify(json));
                    }
                  } catch (err: any) {
                    console.error('Satellite proxy error:', err);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message || 'Satellite request failed' }));
                  }
                });
              } else {
                res.statusCode = 405;
                res.end();
              }
            });

            // ── Gemini AI proxy (keeps API key server-side) ──
            const geminiAi = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

            const GEMINI_TYPE_MAP: Record<string, any> = {
              STRING: Type.STRING, NUMBER: Type.NUMBER, BOOLEAN: Type.BOOLEAN,
              OBJECT: Type.OBJECT, ARRAY: Type.ARRAY, INTEGER: Type.INTEGER,
            };
            const rebuildSchema = (schema: any): any => {
              if (!schema) return schema;
              const out: any = { ...schema };
              if (out.type && typeof out.type === 'string') out.type = GEMINI_TYPE_MAP[out.type] ?? out.type;
              if (out.properties) {
                const props: any = {};
                for (const [key, val] of Object.entries(out.properties)) props[key] = rebuildSchema(val);
                out.properties = props;
              }
              if (out.items) out.items = rebuildSchema(out.items);
              return out;
            };

            server.middlewares.use('/api/gemini', (req, res) => {
              if (req.method === 'POST') {
                let body = '';
                req.on('data', (chunk: any) => { body += chunk.toString(); });
                req.on('end', async () => {
                  try {
                    const data = JSON.parse(body);
                    const config = data.config ? { ...data.config } : undefined;
                    if (config?.responseSchema) config.responseSchema = rebuildSchema(config.responseSchema);

                    const response = await geminiAi.models.generateContent({
                      model: data.model,
                      contents: data.contents,
                      config,
                    });
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify({ text: response.text || '' }));
                  } catch (err: any) {
                    console.error('Gemini proxy error:', err);
                    res.statusCode = err?.message?.includes('429') ? 429 : 500;
                    res.end(JSON.stringify({ error: err.message || 'Gemini request failed' }));
                  }
                });
              } else {
                res.statusCode = 405;
                res.end();
              }
            });

            // ── Voice session key endpoint ──
            // WebSocket-based voice streaming requires the SDK client-side.
            // This endpoint provides the key at runtime (NOT baked into the bundle).
            // Requires Firebase auth token — matches production endpoint.
            server.middlewares.use('/api/voice-key', async (req, res) => {
              if (req.method === 'GET') {
                const authHeader = req.headers.authorization;
                if (!authHeader?.startsWith('Bearer ')) {
                  res.statusCode = 401;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Missing Authorization header' }));
                  return;
                }
                // In dev, we trust the token exists (Firebase emulator or real auth)
                // Production endpoint does full verification via Google's tokeninfo API
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ key: env.GEMINI_API_KEY }));
              } else {
                res.statusCode = 405;
                res.end();
              }
            });
          }
        }
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
