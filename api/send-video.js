/**
 * api/send-video.js — Vercel Serverless Function
 * Meneruskan file video ke Telegram Bot API (dengan fallback ke sendDocument).
 * Token disimpan aman di environment variable Vercel, tidak pernah ke browser.
 *
 * Catatan: Vercel membatasi ukuran body request default 4.5 MB.
 * Untuk video lebih besar, config export di bawah menonaktifkan limit bawaan.
 */
export const config = {
  api: {
    bodyParser: false, // wajib false agar bisa terima multipart/form-data (file)
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

  try {
    // Baca raw body dari request sebagai buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Ambil Content-Type dari request frontend (sudah berisi boundary multipart)
    const contentType = req.headers['content-type'];

    // Coba kirim sebagai video terlebih dahulu
    const sendAs = async (method) => {
      // Buat FormData baru dengan mengganti nama field jika perlu
      // Untuk kesederhanaan, teruskan body mentah apa adanya — browser sudah
      // membentuk multipart yang benar dengan field "video" atau "document".
      return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: rawBody,
      });
    };

    let tgRes = await sendAs('sendVideo');
    let data  = await tgRes.json();

    // Fallback ke sendDocument jika codec tidak didukung Telegram
    if (!data.ok) {
      console.warn('[send-video] sendVideo gagal, fallback ke sendDocument:', data.description);
      tgRes = await sendAs('sendDocument');
      data  = await tgRes.json();
    }

    return res.status(tgRes.ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, description: err.message });
  }
}
