/**
 * telegram.js — Semua komunikasi dengan Telegram Bot API
 * Berisi: sendMessage, sendLocation, sendVideo, sendDocument (fallback).
 */

const TG_BASE = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}`;

/**
 * Kirim pesan teks ke Telegram.
 * @param {string} text - Teks pesan (mendukung Markdown)
 */
async function tgSendMessage(text) {
  const res  = await fetch(`${TG_BASE}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    CONFIG.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage: ${data.description}`);
  return data;
}

/**
 * Kirim pin lokasi interaktif (peta) ke Telegram.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
async function tgSendLocation(lat, lon) {
  const res  = await fetch(`${TG_BASE}/sendLocation`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:   CONFIG.TELEGRAM_CHAT_ID,
      latitude:  lat,
      longitude: lon,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendLocation: ${data.description}`);
  return data;
}

/**
 * Kirim file video ke Telegram.
 * Jika sendVideo gagal (format tidak didukung), otomatis fallback ke sendDocument.
 * @param {Blob}   blob    - Blob video hasil rekaman
 * @param {string} caption - Caption yang disertakan
 */
async function tgSendVideo(blob, caption) {
  const ext      = blob.type?.includes('mp4') ? 'mp4' : 'webm';
  const formData = new FormData();
  formData.append('chat_id',            CONFIG.TELEGRAM_CHAT_ID);
  formData.append('video',              blob, `konfirmasi_obat.${ext}`);
  formData.append('caption',            caption);
  formData.append('supports_streaming', 'true');

  const res  = await fetch(`${TG_BASE}/sendVideo`, { method: 'POST', body: formData });
  const data = await res.json();

  if (!data.ok) {
    // Fallback: kirim sebagai dokumen biasa jika codec tidak didukung Telegram
    console.warn('[telegram.js] sendVideo gagal, mencoba sendDocument:', data.description);
    return await tgSendDocument(blob, caption);
  }
  return data;
}

/**
 * Kirim file sebagai dokumen (fallback dari sendVideo).
 * @param {Blob}   blob    - Blob video
 * @param {string} caption - Caption yang disertakan
 */
async function tgSendDocument(blob, caption) {
  const ext      = blob.type?.includes('mp4') ? 'mp4' : 'webm';
  const formData = new FormData();
  formData.append('chat_id',  CONFIG.TELEGRAM_CHAT_ID);
  formData.append('document', blob, `konfirmasi_obat.${ext}`);
  formData.append('caption',  caption);

  const res  = await fetch(`${TG_BASE}/sendDocument`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendDocument: ${data.description}`);
  return data;
}