/**
 * location.js — Layar Tunggal Terintegrasi untuk Kirim Lokasi GPS
 * Dioptimalkan untuk Kecepatan Prompt Izin Ekstrem:
 * 1. Panggilan getCurrentPosition() langsung dieksekusi di baris pertama event handler.
 * 2. Pre-warming global aktif di background sejak website dibuka.
 * 3. Menghindari blocking driver GPS pada prompt pertama agar dialog langsung muncul seketika.
 */

// Pre-warm otomatis di background saat modul dimuat
if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
  try { navigator.permissions.query({ name: 'geolocation' }).catch(() => {}); } catch (_) {}
}

function startLocation(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  // Reset flag cancel dan trigger agar layar ini selalu bersih
  state.locCancelled = false;
  _isTriggeringLoc = false;

  // Pre-warm background saat menu ditekan
  if (navigator.permissions && navigator.permissions.query) {
    try { navigator.permissions.query({ name: 'geolocation' }).catch(() => {}); } catch (_) {}
  }

  // Pindah layar ke lokasi
  showScreen('screen-prep-lokasi');

  // Reset status tampilan UI
  const badge = $('loc-badge');
  const badgeText = $('loc-badge-text');
  const title = $('loc-title');
  const subtitle = $('loc-subtitle');
  const bottomTrigger = $('loc-bottom-trigger');
  const bottomProgress = $('loc-bottom-progress');

  if (badge) badge.className = 'rec-badge loc-badge-idle';
  if (badgeText) badgeText.textContent = 'BAGIKAN LOKASI';
  if (title) title.textContent = 'Kabarkan Lokasi Saya';
  if (subtitle) subtitle.innerHTML = 'Titik lokasi GPS Anda akan dikirim ke tim perawat.<br>Ketuk tombol di bawah <strong>2 kali cepat</strong>.';

  if (bottomTrigger) bottomTrigger.style.display = 'flex';

  // Sembunyikan fase GPS (video + progress) saat reset ke awal
  const gpsPhase = $('loc-gps-phase');
  if (gpsPhase) gpsPhase.style.display = 'none';
  if (bottomProgress) bottomProgress.style.display = 'none';

  const locVideo = $('loc-video');
  if (locVideo) locVideo.pause();
}

async function handleLocationReady(position) {
  // Abaikan jika pengguna sudah menekan Back sebelum GPS selesai
  if (state.locCancelled) {
    state.locCancelled = false;
    return;
  }
  const { latitude: lat, longitude: lon, accuracy } = position.coords;
  const mapsLink = `https://maps.google.com/?q=${lat},${lon}`;
  const devInfo  = await collectDeviceInfo();

  const details = [
    'LAPORAN LOKASI LANSIA', '',
    'Koordinat:',
    `  Latitude  : ${lat.toFixed(7)}`,
    `  Longitude : ${lon.toFixed(7)}`,
    `  Akurasi   : ±${Math.round(accuracy)} meter`,
    '', 'Google Maps:', mapsLink, '',
    formatDeviceInfo(devInfo),
  ].join('\n');

  const bar = $('loc-progress-bar');
  if (bar) bar.style.width = '75%';

  try {
    await tgSendLocation(lat, lon);
    await tgSendMessage(details);
    if (bar) bar.style.width = '100%';

    showResult({
      success: true, icon: '📍', title: 'Lokasi Terkirim!',
      message: `Posisi Anda sudah diberitahukan ke tim perawat.\nAkurasi: ±${Math.round(accuracy)} meter. Tetap aman! 💛`,
    });
  } catch (err) {
    console.error('[location.js] Send error:', err);
    showResult({
      success: false, icon: '❌', title: 'Gagal Mengirim Lokasi',
      message: `Terjadi kesalahan saat mengirim lokasi. Periksa koneksi internet dan coba lagi.\n\n(${err.message})`,
    });
  }
}

let _isTriggeringLoc = false;

function triggerLocationGPS(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  if (_isTriggeringLoc) return;
  _isTriggeringLoc = true;

  if (!navigator.geolocation) {
    _isTriggeringLoc = false;
    showResult({
      success: false, icon: '🗺️', title: 'GPS Tidak Tersedia',
      message: 'Perangkat ini tidak mendukung fitur GPS. Mohon hubungi pengurus yayasan.',
    });
    return;
  }

  // ⚡ LANGKAH 1 (PRIORITAS NOMOR SATU): Tembak API Geolocation SEKETIKA untuk memicu dialog izin OS
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      _isTriggeringLoc = false;
      await handleLocationReady(pos);
    },
    (err) => {
      _isTriggeringLoc = false;
      // Abaikan jika pengguna sudah menekan Back
      if (state.locCancelled) { state.locCancelled = false; return; }
      let msg = 'Tidak dapat menentukan lokasi Anda.';
      switch (err.code) {
        case err.PERMISSION_DENIED:
          msg = 'Izin lokasi ditolak. Silakan ketuk tombol 2 kali cepat lagi, lalu pilih "Izinkan".';
          break;
        case err.POSITION_UNAVAILABLE:
          // GPS mati → tampilkan layar panduan khusus, bukan pesan error biasa
          showGpsOffScreen();
          return;
        case err.TIMEOUT:
          // GPS tidak berhasil dalam 30 detik (kemungkinan sinyal lemah/mati)
          showGpsOffScreen();
          return;
      }
      showResult({ success: false, icon: '📡', title: 'Lokasi Tidak Ditemukan', message: msg });
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 }
  );

  // ⚡ LANGKAH 2: Haptic feedback instan
  if (navigator.vibrate) {
    try { navigator.vibrate([50, 40, 50]); } catch (_) {}
  }

  // ⚡ LANGKAH 3: Update DOM secara asynchronous agar tidak menahan eksekusi IPC browser
  requestAnimationFrame(() => {
    const btn = $('btn-trigger-lokasi');
    const text = $('btn-trigger-lokasi-text');
    const sub  = $('btn-trigger-lokasi-sub');
    if (btn && text) {
      btn.classList.add('trigger-active');
      text.textContent = '👆 KETUK SEKALI LAGI SEKARANG!';
      if (sub) sub.textContent = 'UNTUK MENEKAN IZINKAN';
    }

    const badge = $('loc-badge');
    const badgeText = $('loc-badge-text');
    const title = $('loc-title');
    const subtitle = $('loc-subtitle');
    const bottomTrigger = $('loc-bottom-trigger');
    const gpsPhase = $('loc-gps-phase');
    const progressText = $('loc-progress-text');
    const bar = $('loc-progress-bar');

    if (badge) badge.className = 'rec-badge rec-badge-recording';
    if (badgeText) badgeText.textContent = 'MENGIRIM LOKASI...';
    if (title) title.textContent = 'Sedang Mengirim Lokasi...';
    if (subtitle) subtitle.textContent = 'Mencari koordinat GPS presisi tinggi & mengirim ke perawat.';
    if (progressText) progressText.textContent = '📡 Mencari koordinat GPS, mohon tunggu...';

    // Sembunyikan tombol trigger, tampilkan fase GPS (video + progress)
    if (bottomTrigger) bottomTrigger.style.display = 'none';
    if (gpsPhase) gpsPhase.style.display = 'block';
    if (bar) bar.style.width = '35%';

    // Mulai putar video lokasi setelah proses dimulai
    const locVideo = $('loc-video');
    if (locVideo) {
      locVideo.currentTime = 0;
      locVideo.play().catch(() => {});
    }
  });
}

/**
 * Tampilkan layar panduan khusus saat GPS HP mati (POSITION_UNAVAILABLE).
 * Memberikan panduan visual cara mengaktifkan GPS.
 */
function showGpsOffScreen() {
  stopAllMedia();
  showScreen('screen-gps-off');
}