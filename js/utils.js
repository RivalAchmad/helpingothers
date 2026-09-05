/**
 * utils.js — Helper & utilitas umum
 * Berisi: DOM query, screen switcher, media cleanup, jam real-time,
 *         dan penyadap tombol Back hardware.
 */

/** Shortcut querySelector by ID */
const $ = id => document.getElementById(id);

/**
 * Tampilkan screen tertentu, sembunyikan yang lain.
 * @param {string} id - ID elemen section screen
 */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

/** Kembali ke halaman utama dan bersihkan semua resource */
function goHome() {
  clearTimeout(state.autoResetTimer);
  stopAllMedia();
  showScreen('screen-main');
}

/**
 * Hentikan semua track kamera/audio dan reset state media.
 * Dipanggil setelah rekaman selesai atau dibatalkan.
 */
function stopAllMedia() {
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
    state.mediaStream = null;
  }
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    try { state.mediaRecorder.stop(); } catch (_) {}
    state.mediaRecorder = null;
  }
  clearInterval(state.countdownTimer);
  state.countdownTimer = null;
  state.isCancelled    = false;
  state.recordedChunks = [];
}

/** Update jam real-time WIB di halaman utama */
function updateClock() {
  const opts = {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Jakarta',
  };
  $('current-time').textContent = new Date().toLocaleString('id-ID', opts) + ' WIB';
}

/* ── Back Button Hardware Handler ── */

/** Push state palsu ke History API agar tombol Back fisik tertangkap */
function pushHistoryState() {
  history.pushState({ lansiaApp: true }, '');
}

/**
 * Inisialisasi penyadap tombol Back hardware.
 * Mencegah web tertutup saat pengguna menekan Back di luar screen-main.
 * Harus dipanggil sekali di DOMContentLoaded (lihat app.js).
 */
function initBackHandler() {
  pushHistoryState();
  window.addEventListener('popstate', function () {
    // Re-push agar back berikutnya juga tertangkap
    pushHistoryState();
    _handleBackPress();
  });
}

/** Logika internal: apa yang dilakukan saat Back ditekan */
function _handleBackPress() {
  const activeScreen = document.querySelector('.screen.active');
  if (!activeScreen || activeScreen.id === 'screen-main') return;

  const id = activeScreen.id;

  // ── Layar Kamera (Obat) ──
  if (id === 'screen-camera') {
    const cameraPhase = document.getElementById('med-camera-phase');
    const isRecording = cameraPhase && cameraPhase.style.display !== 'none';

    if (isRecording && state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      // Hentikan rekaman → onstop akan fire → handleVideoReady kirim video seadanya
      // Tandai agar handleVideoReady TIDAK tampilkan layar analisis
      state.backPressedDuringRecording = true;
      state.isCancelled = false; // pastikan video tetap dikirim
      state.mediaRecorder.stop();
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    } else {
      // Belum rekam, bersihkan saja
      state.backPressedDuringRecording = false;
      stopAllMedia();
    }
    // Kembali ke layar awal minum obat
    startMedication(null);
    return;
  }

  // ── Layar Lokasi ──
  if (id === 'screen-prep-lokasi') {
    // Tandai agar callback GPS diabaikan jika masih pending
    state.locCancelled = true;
    startLocation(null);
    return;
  }

  // ── Layar lain (result, analysis, medicine-list) ──
  goHome();
}