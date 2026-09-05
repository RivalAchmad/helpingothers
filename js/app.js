/**
 * app.js — Inisialisasi aplikasi
 * Entry point: tampilkan menu utama, mulai jam real-time,
 * aktifkan back-button handler, dan pasang sensitivitas tombol home.
 */

window.addEventListener('DOMContentLoaded', () => {
  if (CONFIG.TELEGRAM_CHAT_ID === 'GANTI_DENGAN_CHAT_ID_ANDA') {
    console.warn('[Lansia Care] TELEGRAM_CHAT_ID belum diisi di js/config.js');
  }

  // Jam real-time
  updateClock();
  setInterval(updateClock, 1000);

  // Sadap tombol Back hardware agar tidak menutup web
  initBackHandler();

  // Tombol menu utama dengan sensitivitas press-and-release
  // (geser jari keluar tombol sebelum angkat = batal)
  attachPressReleaseButton('btn-obat',   e => startMedication(e));
  attachPressReleaseButton('btn-lokasi', e => startLocation(e));
});

/**
 * Pasang logika "tekan-dan-lepas" pada tombol.
 * Jika jari digeser keluar tombol sebelum diangkat, aksi dibatalkan.
 *
 * @param {string}   id      - ID tombol
 * @param {Function} action  - Fungsi yang dipanggil saat tombol berhasil ditekan
 */
function attachPressReleaseButton(id, action) {
  const btn = document.getElementById(id);
  if (!btn) return;

  let pressing = false;

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pressing = true;
  });

  btn.addEventListener('pointerup', (e) => {
    if (pressing) {
      e.preventDefault();
      pressing = false;
      action(e);
    }
  });

  // Jari geser keluar tombol → batalkan
  btn.addEventListener('pointerleave',  () => { pressing = false; });
  btn.addEventListener('pointercancel', () => { pressing = false; });
}