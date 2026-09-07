/**
 * telegram.js — Komunikasi ke Vercel Serverless Functions
 *
 * Browser TIDAK lagi memanggil Telegram API secara langsung.
 * Semua permintaan diteruskan ke endpoint /api/* di server Vercel,
 * sehingga TELEGRAM_BOT_TOKEN tidak pernah terekspos ke browser.
 */

/**
 * Kirim pesan teks ke Telegram (melalui /api/send-message).
 * @param {string} text - Teks pesan (mendukung Markdown)
 */
async function tgSendMessage(text) {
  const res = await fetch('/api/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage: ${data.description}`);
  return data;
}

/**
 * Kirim pin lokasi interaktif (peta) ke Telegram (melalui /api/send-location).
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
async function tgSendLocation(lat, lon) {
  const res = await fetch('/api/send-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendLocation: ${data.description}`);
  return data;
}

/**
 * Kirim file video ke Telegram (melalui /api/send-video).
 * Video dikonversi ke base64 agar chat_id bisa diisi di sisi server.
 * Fallback ke sendDocument ditangani di sisi server.
 * @param {Blob}   blob    - Blob video hasil rekaman
 * @param {string} caption - Caption yang disertakan
 */
async function tgSendVideo(blob, caption) {
  const ext = blob.type?.includes('mp4') ? 'mp4' : 'webm';

  // Konversi Blob → base64 agar bisa dikirim lewat JSON
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]); // strip "data:...;base64,"
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const res = await fetch('/api/send-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoBase64: base64,
      mimeType: blob.type || 'video/webm',
      ext,
      caption,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendVideo: ${data.description}`);
  return data;
}