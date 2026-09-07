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
 * Fallback ke sendDocument ditangani di sisi server.
 * @param {Blob}   blob    - Blob video hasil rekaman
 * @param {string} caption - Caption yang disertakan
 */
async function tgSendVideo(blob, caption) {
  const ext = blob.type?.includes('mp4') ? 'mp4' : 'webm';
  const formData = new FormData();
  formData.append('chat_id', '');   // chat_id diisi server dari env var
  formData.append('video', blob, `periksa_makanan.${ext}`);
  formData.append('caption', caption);
  formData.append('supports_streaming', 'true');

  const res = await fetch('/api/send-video', { method: 'POST', body: formData });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendVideo: ${data.description}`);
  return data;
}