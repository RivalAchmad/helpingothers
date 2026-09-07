/**
 * api/send-video.js — Vercel Serverless Function
 *
 * Menerima video dalam format base64 JSON dari browser,
 * lalu meneruskannya ke Telegram Bot API dengan chat_id dari env variable.
 * Token & chat_id tidak pernah terekspos ke browser.
 *
 * Alur:
 *   Browser → base64 JSON → /api/send-video → FormData → Telegram API
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // video 5 detik umumnya < 5MB; base64 ~+33%, jadi 15MB aman
    },
  },
};

export default async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, description: 'Method Not Allowed' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ ok: false, description: 'Environment variable belum dikonfigurasi di Vercel.' });
  }

  const { videoBase64, mimeType, ext, caption } = req.body;

  if (!videoBase64) {
    return res.status(400).json({ ok: false, description: 'Parameter "videoBase64" wajib diisi.' });
  }

  try {
    // Konversi base64 → Buffer → Blob
    const videoBuffer = Buffer.from(videoBase64, 'base64');
    const videoBlob   = new Blob([videoBuffer], { type: mimeType || 'video/webm' });
    const filename    = `periksa_makanan.${ext || 'webm'}`;

    /**
     * Bangun FormData baru dengan chat_id yang benar dari env var.
     * Browser tidak pernah tahu chat_id atau token ini.
     */
    const buildFormData = (fieldName) => {
      const formData = new FormData();
      formData.append('chat_id', CHAT_ID);
      formData.append(fieldName, videoBlob, filename);
      if (caption) formData.append('caption', caption);
      if (fieldName === 'video') formData.append('supports_streaming', 'true');
      return formData;
    };

    // Coba kirim sebagai video terlebih dahulu
    let tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
      method: 'POST',
      body: buildFormData('video'),
    });
    let data = await tgRes.json();

    // Fallback ke sendDocument jika codec tidak didukung Telegram
    if (!data.ok) {
      console.warn('[send-video] sendVideo gagal, fallback ke sendDocument:', data.description);
      tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: buildFormData('document'),
      });
      data = await tgRes.json();
    }

    return res.status(data.ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, description: err.message });
  }
}
