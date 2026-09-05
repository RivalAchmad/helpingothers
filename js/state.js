/**
 * state.js — State global aplikasi
 * Semua variabel yang perlu di-share antar modul disimpan di sini.
 */
const state = {
  mediaStream:    null,   // MediaStream aktif dari kamera
  mediaRecorder:  null,   // Instance MediaRecorder
  recordedChunks: [],     // Chunks video yang direkam
  countdownTimer: null,   // ID setInterval countdown
  autoResetTimer: null,   // ID setTimeout auto-reset ke home
  isCancelled:    false,  // Flag apakah rekaman dibatalkan user
};