/**
 * api/send-location.js — Vercel Serverless Function
 * Meneruskan pin lokasi (latitude & longitude) ke Telegram Bot API.
 * Token disimpan aman di environment variable Vercel, tidak pernah ke browser.
 */
export default async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, description: 'Method Not Allowed' });
  }

  const { lat, lon } = req.body;

  if (lat === undefined || lon === undefined) {
    return res.status(400).json({ ok: false, description: 'Parameter "lat" dan "lon" wajib diisi.' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ ok: false, description: 'Environment variable belum dikonfigurasi di Vercel.' });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendLocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        latitude: lat,
        longitude: lon,
      }),
    });

    const data = await tgRes.json();
    return res.status(tgRes.ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, description: err.message });
  }
}
