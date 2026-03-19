/**
 * recorder.js — Capacitor native recording bridge for the offline fallback page.
 *
 * Used only by www/index.html. Does NOT use ESM imports or npm.
 * Accesses the Capacitor plugin bridge via the globally-injected window.Capacitor object,
 * which is present whenever this page is loaded inside a Capacitor WebView (iOS/Android).
 *
 * API exposed on window.NativeRecorder:
 *   startRecording()           → Promise<void>
 *   stopRecording()            → Promise<{ base64: string, mimeType: string, msDuration: number }>
 *   downloadRecording(b64, mt) → void  (triggers device download / share)
 */

(function () {
  'use strict';

  function getPlugin() {
    if (
      typeof window !== 'undefined' &&
      window.Capacitor &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.VoiceRecorder
    ) {
      return window.Capacitor.Plugins.VoiceRecorder;
    }
    return null;
  }

  async function startRecording() {
    const plugin = getPlugin();
    if (!plugin) {
      throw new Error('VoiceRecorder plugin is not available. Make sure this page is running inside the ScribeAI native app.');
    }

    const permResult = await plugin.requestAudioRecordingPermission();
    if (permResult && permResult.value === false) {
      throw new Error('Microphone permission was denied. Please allow it in your device settings.');
    }

    await plugin.startRecording();
  }

  async function stopRecording() {
    const plugin = getPlugin();
    if (!plugin) {
      throw new Error('VoiceRecorder plugin is not available.');
    }

    const result = await plugin.stopRecording();
    const value = result && result.value ? result.value : result;
    return {
      base64: value.recordDataBase64 || '',
      mimeType: value.mimeType || 'audio/aac',
      msDuration: value.msDuration || 0,
    };
  }

  function base64ToBlob(base64, mimeType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  function downloadRecording(base64, mimeType) {
    try {
      const blob = base64ToBlob(base64, mimeType);
      const ext = mimeType.includes('aac') ? '.aac'
        : mimeType.includes('mp4') ? '.m4a'
        : mimeType.includes('webm') ? '.webm'
        : '.audio';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scribeai-recording-' + Date.now() + ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    } catch (e) {
      console.error('downloadRecording failed:', e);
    }
  }

  window.NativeRecorder = {
    startRecording: startRecording,
    stopRecording: stopRecording,
    downloadRecording: downloadRecording,
  };
})();
