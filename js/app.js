/**
 * app.js — Inisialisasi aplikasi
 * Entry point: tampilkan menu utama dan mulai jam real-time.
 */

window.addEventListener('DOMContentLoaded', () => {
  if (CONFIG.TELEGRAM_CHAT_ID === 'GANTI_DENGAN_CHAT_ID_ANDA') {
    console.warn('[Lansia Care] TELEGRAM_CHAT_ID belum diisi di js/config.js');
  }
  updateClock();
  setInterval(updateClock, 1000);
});