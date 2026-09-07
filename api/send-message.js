/**
 * api/send-message.js — Vercel Serverless Function
 * Meneruskan pesan teks ke Telegram Bot API.
 * Token disimpan aman di environment variable Vercel, tidak pernah ke browser.
 */
export default async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, description: 'Method Not Allowed' });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ ok: false, description: 'Parameter "text" wajib diisi.' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ ok: false, description: 'Environment variable belum dikonfigurasi di Vercel.' });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });

    const data = await tgRes.json();
    return res.status(tgRes.ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, description: err.message });
  }
}
