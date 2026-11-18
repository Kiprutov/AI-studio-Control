import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  handleCreateXPost,
  handleDeleteXPost,
  handleListXPosts,
  handleRefreshXMetrics,
  handleXDisconnect,
  handleXOAuthCallback,
  handleXOAuthUrl,
  handleXStatus,
  startXScheduler,
} from './server/xService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_VOICES = new Set(['Kore', 'Charon', 'Puck', 'Fenrir', 'Zephyr']);

const app = express();
app.use(express.json({ limit: '256kb' }));

const ALLOWED_CAPACITOR_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
]);

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_CAPACITOR_ORIGINS.has(origin) || origin.endsWith('.run.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/voiceover', async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      script?: unknown;
      voiceName?: unknown;
      style?: unknown;
    };

    const script = typeof body.script === 'string' ? body.script.trim() : '';
    if (!script) {
      res.status(400).json({ error: 'Voiceover script is required.' });
      return;
    }
    if (script.length > 1500) {
      res.status(400).json({ error: 'Voiceover script must be 1500 characters or fewer.' });
      return;
    }

    const rawVoice = typeof body.voiceName === 'string' ? body.voiceName : 'Charon';
    const voiceName = ALLOWED_VOICES.has(rawVoice) ? rawVoice : 'Charon';
    const style =
      typeof body.style === 'string' && body.style.trim()
        ? body.style.trim()
        : 'Sleek Google product launch keynote narrator, calm suspenseful pacing, warm authority';

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: script,
              speechMetadata: {
                style,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((p) => p.inlineData?.data);
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
      res.status(502).json({ error: 'Gemini TTS returned no audio data.' });
      return;
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: audioPart?.inlineData?.mimeType || 'audio/wav',
      voiceName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate voiceover audio.';
    const status = message.includes('GEMINI_API_KEY') ? 500 : 502;
    res.status(status).json({ error: message });
  }
});

// X (Twitter) Automation & Performance Testing Routes
app.get('/api/x/status', (req, res) => {
  void handleXStatus(req, res);
});
app.get('/api/x/auth/url', (req, res) => {
  handleXOAuthUrl(req, res);
});
app.get(['/auth/x/callback', '/auth/x/callback/'], (req, res) => {
  void handleXOAuthCallback(req, res);
});
app.post('/api/x/disconnect', (req, res) => {
  handleXDisconnect(req, res);
});
app.get('/api/x/posts', (req, res) => {
  handleListXPosts(req, res);
});
app.post('/api/x/posts', (req, res) => {
  void handleCreateXPost(req, res);
});
app.post('/api/x/posts/refresh-metrics', (req, res) => {
  void handleRefreshXMetrics(req, res);
});
app.delete('/api/x/posts/:id', (req, res) => {
  handleDeleteXPost(req, res);
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  startXScheduler();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shuleni Launch Film server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
