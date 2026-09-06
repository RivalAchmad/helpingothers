/**
 * ui.js — Komponen UI: layar error (showResult)
 */

/**
 * Tampilkan layar error dengan ikon, judul, dan pesan.
 * Otomatis kembali ke home setelah 4 detik.
 * @param {{ icon: string, title: string, message: string }} opts
 */
function showResult({ icon, title, message }) {
  const card = $('result-card');
  card.className = 'result-card error';
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