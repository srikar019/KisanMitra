import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Server-side Gemini proxy.
 * The API key NEVER reaches the browser.
 *
 * POST /api/gemini
 * Body: { model, contents, config? }
 * Returns: { text }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { model, contents, config } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ error: 'model and contents are required' });
    }

    // Rebuild Type references from serialized schema
    const resolvedConfig = config ? rebuildConfig(config) : undefined;

    const response = await ai.models.generateContent({
      model,
      contents,
      config: resolvedConfig,
    });

    return res.status(200).json({ text: response.text || '' });
  } catch (error: any) {
    console.error('Gemini proxy error:', error);
    const status = error?.message?.includes('429') ? 429 : 500;
    return res.status(status).json({
      error: error?.message || 'Gemini request failed',
    });
  }
}

/**
 * Re-maps serialised type strings ("STRING", "NUMBER", etc.)
 * back to the enum values the SDK expects.
 */
function rebuildConfig(config: any): any {
  if (!config) return config;

  const rebuilt = { ...config };

  if (rebuilt.responseSchema) {
    rebuilt.responseSchema = rebuildSchema(rebuilt.responseSchema);
  }
  return rebuilt;
}

const TYPE_MAP: Record<string, any> = {
  STRING: Type.STRING,
  NUMBER: Type.NUMBER,
  BOOLEAN: Type.BOOLEAN,
  OBJECT: Type.OBJECT,
  ARRAY: Type.ARRAY,
  INTEGER: Type.INTEGER,
};

function rebuildSchema(schema: any): any {
  if (!schema) return schema;
  const out: any = { ...schema };

  if (out.type && typeof out.type === 'string') {
    out.type = TYPE_MAP[out.type] ?? out.type;
  }
  if (out.properties) {
    const props: any = {};
    for (const [key, val] of Object.entries(out.properties)) {
      props[key] = rebuildSchema(val);
    }
    out.properties = props;
  }
  if (out.items) {
    out.items = rebuildSchema(out.items);
  }
  return out;
}
