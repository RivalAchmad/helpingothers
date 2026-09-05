/**
 * ui.js — Komponen UI: layar loading dan layar hasil (sukses/error)
 */

/**
 * Tampilkan layar hasil dengan ikon, judul, dan pesan.
 * Otomatis kembali ke home setelah 4 detik.
 * @param {{ success: boolean, icon: string, title: string, message: string }} opts
 */
function showResult({ success, icon, title, message }) {
  const card = $('result-card');
  card.className = `result-card ${success ? 'success' : 'error'}`;
  $('result-icon').textContent  = icon;
  $('result-title').textContent = title;
  $('result-msg').textContent   = message;

  showScreen('screen-result');

  // Countdown 4→1 lalu auto-home
  let secs = 4;
  $('cd-num').textContent = secs;
  clearTimeout(state.autoResetTimer);

  const tick = () => {
    secs--;
    if (secs <= 0) { goHome(); return; }
    $('cd-num').textContent = secs;
    state.autoResetTimer = setTimeout(tick, 1000);
  };
  state.autoResetTimer = setTimeout(tick, 1000);
}

/**
 * Tampilkan layar loading dengan pesan kustom.
 * Mengembalikan fungsi `finish()` yang harus dipanggil saat proses selesai.
 *
 * @param {{ title?: string, subtitle?: string }} opts
 * @returns {() => void} Fungsi finish untuk menyelesaikan animasi loading
 */
function showLoading({ title = 'Sedang Mengirim…', subtitle = 'Mohon tunggu sebentar' } = {}) {
  $('loading-title').textContent    = title;
  $('loading-subtitle').textContent = subtitle;

  const bar = $('upload-bar');
  bar.style.width = '0%';
  showScreen('screen-loading');

  // Animasi progress bar yang terasa responsif
  let w = 0;
  const grow = setInterval(() => {
    w = Math.min(w + Math.random() * 8, 88);
    bar.style.width = `${w}%`;
    if (w >= 88) clearInterval(grow);
  }, 300);

  // Kembalikan fungsi finish yang menutup interval dan set bar ke 100%
  return () => {
    clearInterval(grow);
    bar.style.width = '100%';
  };
}