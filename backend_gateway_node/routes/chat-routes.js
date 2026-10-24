/**
 * Chat Routes - Proxy to Python AI Core
 * Forwards authenticated requests to the AI core at 127.0.0.1:8000
 */
const { verifyToken } = require('../middleware/jwtAuth');
const http = require('http');

const AI_CORE_URL = process.env.AI_CORE_URL || 'http://127.0.0.1:8000';

function forwardToAICore(path, req, res) {
  const bodyStr = JSON.stringify(req.body || {});
  const url = new URL(AI_CORE_URL + path);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 8000,
    path: url.pathname,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      // Forward the original JWT so AI core can verify it
      'Authorization': req.headers['authorization'] || req.headers['x-access-token'] || '',
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    let data = '';
    proxyRes.on('data', chunk => { data += chunk; });
    proxyRes.on('end', () => {
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        res.send(data);
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error('[Chat Proxy] AI Core unreachable:', err.message);
    res.status(503).json({
      error: 'AI Core service unavailable',
      detail: 'The AI backend is not running. Start it with: npm run start:ai'
    });
  });

  proxyReq.write(bodyStr);
  proxyReq.end();
}

module.exports = function(app) {
  // Main chat endpoint - JWT protected, proxied to AI core
  app.post('/api/v1/chat', [verifyToken], (req, res) => {
    forwardToAICore('/chat', req, res);
  });

  // Confirm high-risk action (block card, raise dispute)
  app.post('/api/v1/chat/confirm', [verifyToken], (req, res) => {
    forwardToAICore('/chat/confirm', req, res);
  });

  // Health check for AI core (proxied)
  app.get('/api/v1/ai-health', (req, res) => {
    forwardToAICore('/health', req, res);
  });
};
