export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    success: true,
    app: 'DRAK-GPT',
    owner: 'Dev ALIZZ',
    status: 'ok',
    providers: ['lexcode', 'nexray-chatgpt', 'nexray-claude', 'nexray-deepseek', 'nexray-copilot'],
    timestamp: new Date().toISOString()
  }));
}
