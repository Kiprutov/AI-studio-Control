import { sharedAudioEngine } from '../audio/shuleniAudioEngine';
import { AdConfig, ASPECT_DIMENSIONS, getScenesForCampaign } from '../types/ad';
import { LoadedAdAssets, renderAdFrame } from './shuleniAdRenderer';

export interface ExportProgress {
  progress: number; // 0 to 1
  elapsedSec: number;
  totalSec: number;
}

function pickSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

export async function exportLaunchVideoWebM(
  config: AdConfig,
  assets: LoadedAdAssets,
  musicVol: number,
  sfxVol: number,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal,
  voiceVol = 0.95,
): Promise<Blob> {
  const dims = ASPECT_DIMENSIONS[config.aspectRatio];
  const durationSec = config.cut === '30s' ? 30 : 45;

  const offscreen = document.createElement('canvas');
  offscreen.width = dims.width;
  offscreen.height = dims.height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for export.');
  }

  // Ensure audio engine is configured and unmuted on its export bus
  sharedAudioEngine.setConfig(config.soundtrack, durationSec, config.disableTransitionTones);
  sharedAudioEngine.setCustomMusicScenes(
    getScenesForCampaign(config.campaign),
    config.customMusicStarts,
    config.customMusicPlayMode,
    config.customMusicContinuousStartSec,
  );
  sharedAudioEngine.setVoiceoverEnabled(config.voiceoverEnabled);
  sharedAudioEngine.setVolumes(musicVol, sfxVol, false, voiceVol);

  const videoStream = offscreen.captureStream(30);
  const audioStream = sharedAudioEngine.getExportAudioStream();

  const combinedStream = new MediaStream();
  videoStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
  if (audioStream) {
    audioStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
  }

  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(combinedStream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 6_000_000,
    audioBitsPerSecond: 192_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  return new Promise<Blob>((resolve, reject) => {
    let rafId = 0;
    let finished = false;

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      sharedAudioEngine.stop();
      videoStream.getTracks().forEach((t) => t.stop());
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        if (finished) return;
        finished = true;
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        cleanup();
        reject(new Error('Export cancelled.'));
      });
    }

    recorder.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error('Browser MediaRecorder encountered an encoding error.'));
    };

    recorder.onstop = () => {
      if (finished) return;
      finished = true;
      cleanup();
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      resolve(blob);
    };

    // Draw frame 0 first so the stream starts with a clean frame
    renderAdFrame(ctx, 0, config, assets);
    recorder.start(250);
    sharedAudioEngine.start(0);

    const startPerf = performance.now();
    const tick = () => {
      if (finished) return;
      const elapsedSec = (performance.now() - startPerf) / 1000;
      const clamped = Math.min(elapsedSec, durationSec);
      renderAdFrame(ctx, clamped, config, assets);
      onProgress({
        progress: clamped / durationSec,
        elapsedSec: clamped,
        totalSec: durationSec,
      });

      if (elapsedSec >= durationSec + 0.15) {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
