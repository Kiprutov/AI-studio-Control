import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Film,
  Loader2,
  Mic,
  Music2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { SfxCue, sharedAudioEngine } from '../audio/shuleniAudioEngine';
import {
  AdConfig,
  AdCut,
  ASPECT_DIMENSIONS,
  AspectRatio,
  CAMPAIGN_PRESETS,
  CampaignId,
  DEFAULT_AD_CONFIG,
  getScenesForCampaign,
  SOUNDTRACKS,
  SoundtrackId,
  VOICEOVER_VOICES,
  VoiceoverVoice,
} from '../types/ad';
import { LoadedAdAssets, preloadAdAssets, renderAdFrame } from '../video/shuleniAdRenderer';
import { exportLaunchVideoWebM, ExportProgress, triggerBlobDownload } from '../video/videoExporter';
import { apiUrl } from '../lib/api';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';
import XAutomationSection from './XAutomationSection';

const SFX_PADS: { cue: SfxCue; label: string; detail: string }[] = [
  { cue: 'whoosh', label: 'Crossfade Swell', detail: 'Warm filtered breeze' },
  { cue: 'chime', label: 'Brand Reveal', detail: 'Harmonic crest chord' },
  { cue: 'mpesa-ding', label: 'M-Pesa Settlement', detail: 'Rounded dual-tone chime' },
  { cue: 'qr-beep', label: 'Gate QR Scan', detail: 'Soft marimba confirm' },
  { cue: 'sms-pop', label: 'Parent SMS Alert', detail: 'Gentle notification' },
  { cue: 'launch-boom', label: 'Finale Impact', detail: 'Warm sub-bass swell' },
];

function formatTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const rem = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
}

function formatMmSs(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

function parseMmSs(raw: string): number | null {
  const clean = raw.trim();
  if (!clean) return 0;
  if (clean.includes(':')) {
    const [mStr, sStr] = clean.split(':');
    const m = Number(mStr);
    const s = Number(sStr);
    if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0) return null;
    return m * 60 + s;
  }
  const num = Number(clean);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export default function LaunchAdStudio() {
  const [config, setConfig] = useState<AdConfig>(DEFAULT_AD_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedOnce, setHasStartedOnce] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [musicVol, setMusicVol] = useState(0.85);
  const [sfxVol, setSfxVol] = useState(0.85);
  const [voiceVol, setVoiceVol] = useState(0.95);
  const [muted, setMuted] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);

  const [voiceoverStatus, setVoiceoverStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [voiceoverError, setVoiceoverError] = useState<string | null>(null);
  const voiceoverCacheKeyRef = useRef<string>('');
  const [customMusicName, setCustomMusicName] = useState<string | null>(null);
  const [customMusicError, setCustomMusicError] = useState<string | null>(null);
  const musicUploadInputRef = useRef<HTMLInputElement | null>(null);

  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportingWav, setIsExportingWav] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const assetsRef = useRef<LoadedAdAssets>({
    campusDawn: null,
    classroomTech: null,
    parentMobile: null,
    studentStudy: null,
  });
  const playOriginPerfRef = useRef(0);
  const playOriginTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const exportAbortRef = useRef<AbortController | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(32)));
  const spectrumBarsRef = useRef<(HTMLDivElement | null)[]>([]);

  const durationSec = config.cut === '30s' ? 30 : 45;
  const dims = ASPECT_DIMENSIONS[config.aspectRatio];
  const scenes = useMemo(() => getScenesForCampaign(config.campaign), [config.campaign]);

  const activeScene = useMemo(() => {
    const frac = Math.min(0.999, Math.max(0, currentTime / durationSec));
    return scenes.find((s) => frac >= s.startFrac && frac < s.endFrac) ?? scenes[0];
  }, [currentTime, durationSec, scenes]);

  // Preload bespoke editorial campus/classroom/parent/student imagery
  useEffect(() => {
    let mounted = true;
    preloadAdAssets().then((loaded) => {
      if (!mounted) return;
      assetsRef.current = loaded;
      setAssetsReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const currentVoiceKey = `${config.voiceoverVoice}::${config.voiceoverScript.trim()}`;
  const isVoiceoverReady =
    sharedAudioEngine.hasVoiceoverBuffer() && voiceoverCacheKeyRef.current === currentVoiceKey;

  // Sync audio engine config, scene cues & volumes
  useEffect(() => {
    sharedAudioEngine.setConfig(config.soundtrack, durationSec, config.disableTransitionTones);
  }, [config.soundtrack, durationSec, config.disableTransitionTones]);

  useEffect(() => {
    sharedAudioEngine.setCustomMusicScenes(
      scenes,
      config.customMusicStarts,
      config.customMusicPlayMode,
      config.customMusicContinuousStartSec,
    );
  }, [scenes, config.customMusicStarts, config.customMusicPlayMode, config.customMusicContinuousStartSec]);

  useEffect(() => {
    sharedAudioEngine.setVoiceoverEnabled(config.voiceoverEnabled);
  }, [config.voiceoverEnabled]);

  useEffect(() => {
    sharedAudioEngine.setVolumes(musicVol, sfxVol, muted, voiceVol);
  }, [musicVol, sfxVol, muted, voiceVol]);

  // Invalidate cached voiceover buffer if voice or script changes
  useEffect(() => {
    if (voiceoverCacheKeyRef.current && voiceoverCacheKeyRef.current !== currentVoiceKey) {
      sharedAudioEngine.clearVoiceoverBuffer();
      voiceoverCacheKeyRef.current = '';
      setVoiceoverStatus('idle');
      setVoiceoverError(null);
    }
  }, [currentVoiceKey]);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      sharedAudioEngine.stop();
    };
  }, []);

  // Render helper for any timestamp
  const drawFrame = useCallback(
    (tSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderAdFrame(ctx, tSec, config, assetsRef.current);
    },
    [config],
  );

  // Redraw when paused and config/assets/time change
  useEffect(() => {
    if (!isPlaying) {
      // Before the user hits Play the very first time, show Scene 1 Past Papers & Resources settled frame
      const previewTime = !hasStartedOnce && currentTime === 0 ? durationSec * 0.125 : currentTime;
      drawFrame(previewTime);
    }
  }, [isPlaying, hasStartedOnce, currentTime, durationSec, assetsReady, drawFrame]);

  // Main 60fps animation & live audio spectrum loop
  useEffect(() => {
    if (!isPlaying) return;

    let rafId = 0;
    const loop = (now: number) => {
      const elapsed = (now - playOriginPerfRef.current) / 1000;
      const nextTime = playOriginTimeRef.current + elapsed;

      if (nextTime >= durationSec) {
        currentTimeRef.current = durationSec;
        setCurrentTime(durationSec);
        drawFrame(durationSec);
        setIsPlaying(false);
        sharedAudioEngine.stop();
        return;
      }

      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      drawFrame(nextTime);

      // Update live spectrum bars from real AnalyserNode without React re-renders
      sharedAudioEngine.getFrequencyData(freqDataRef.current);
      const bars = spectrumBarsRef.current;
      for (let i = 0; i < bars.length; i++) {
        const el = bars[i];
        if (!el) continue;
        const val = freqDataRef.current[i + 1] ?? 0;
        const pct = Math.max(14, Math.min(100, Math.round((val / 255) * 100)));
        el.style.transform = `scaleY(${pct / 100})`;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      // Reset spectrum bars cleanly on pause
      spectrumBarsRef.current.forEach((el) => {
        if (el) el.style.transform = 'scaleY(0.18)';
      });
    };
  }, [isPlaying, durationSec, drawFrame]);

  const generateVoiceover = useCallback(async (): Promise<boolean> => {
    const trimmed = config.voiceoverScript.trim();
    if (!trimmed) {
      setVoiceoverStatus('error');
      setVoiceoverError('Enter a voiceover script before generating audio.');
      return false;
    }

    setVoiceoverStatus('loading');
    setVoiceoverError(null);
    const requestKey = `${config.voiceoverVoice}::${trimmed}`;

    try {
      const res = await fetch(apiUrl('/api/voiceover'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: trimmed,
          voiceName: config.voiceoverVoice,
          style: 'Sleek Google product launch keynote narrator, calm suspenseful pacing, warm authority',
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        audioBase64?: string;
        error?: string;
      };

      if (!res.ok || !payload.audioBase64) {
        throw new Error(payload.error || `Voiceover service returned status ${res.status}.`);
      }

      await sharedAudioEngine.decodeBase64Voiceover(payload.audioBase64);
      voiceoverCacheKeyRef.current = requestKey;
      setVoiceoverStatus('ready');
      setVoiceoverError(null);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate AI voiceover.';
      setVoiceoverStatus('error');
      setVoiceoverError(message);
      return false;
    }
  }, [config.voiceoverScript, config.voiceoverVoice]);

  const handlePlayPause = async () => {
    if (isExportingVideo || voiceoverStatus === 'loading') return;
    if (isPlaying) {
      setIsPlaying(false);
      sharedAudioEngine.stop();
      return;
    }

    if (config.voiceoverEnabled && !isVoiceoverReady) {
      await generateVoiceover();
    }

    const startFrom = currentTime >= durationSec - 0.15 ? 0 : currentTime;
    setHasStartedOnce(true);
    currentTimeRef.current = startFrom;
    setCurrentTime(startFrom);
    playOriginTimeRef.current = startFrom;
    playOriginPerfRef.current = performance.now();
    sharedAudioEngine.setConfig(config.soundtrack, durationSec, config.disableTransitionTones);
    sharedAudioEngine.setVoiceoverEnabled(config.voiceoverEnabled);
    sharedAudioEngine.setVolumes(musicVol, sfxVol, muted, voiceVol);
    sharedAudioEngine.start(startFrom);
    setIsPlaying(true);
  };

  const handleRestart = async () => {
    if (isExportingVideo || voiceoverStatus === 'loading') return;
    if (config.voiceoverEnabled && !isVoiceoverReady) {
      await generateVoiceover();
    }
    setHasStartedOnce(true);
    currentTimeRef.current = 0;
    setCurrentTime(0);
    playOriginTimeRef.current = 0;
    playOriginPerfRef.current = performance.now();
    sharedAudioEngine.setConfig(config.soundtrack, durationSec, config.disableTransitionTones);
    sharedAudioEngine.setVoiceoverEnabled(config.voiceoverEnabled);
    sharedAudioEngine.setVolumes(musicVol, sfxVol, muted, voiceVol);
    sharedAudioEngine.start(0);
    setIsPlaying(true);
  };

  const handleSeek = (targetTime: number, autoPlay = false) => {
    if (isExportingVideo) return;
    const clamped = Math.max(0, Math.min(durationSec, targetTime));
    setHasStartedOnce(true);
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);

    if (isPlaying || autoPlay) {
      playOriginTimeRef.current = clamped;
      playOriginPerfRef.current = performance.now();
      sharedAudioEngine.setConfig(config.soundtrack, durationSec, config.disableTransitionTones);
      sharedAudioEngine.setVoiceoverEnabled(config.voiceoverEnabled);
      sharedAudioEngine.setVolumes(musicVol, sfxVol, muted, voiceVol);
      sharedAudioEngine.start(clamped);
      setIsPlaying(true);
    } else {
      drawFrame(clamped);
    }
  };

  const handleSwitchCampaign = (campaign: CampaignId) => {
    if (isExportingVideo || campaign === config.campaign) return;
    if (isPlaying) {
      setIsPlaying(false);
      sharedAudioEngine.stop();
    }
    sharedAudioEngine.clearVoiceoverBuffer();
    voiceoverCacheKeyRef.current = '';
    setVoiceoverStatus('idle');
    setVoiceoverError(null);
    const preset = CAMPAIGN_PRESETS[campaign];
    setConfig((prev) => ({
      ...prev,
      ...preset,
    }));
    setHasStartedOnce(false);
    currentTimeRef.current = 0;
    setCurrentTime(0);
  };

  const handleSwitchSoundtrack = (id: SoundtrackId) => {
    if (sharedAudioEngine.hasCustomMusic()) {
      sharedAudioEngine.clearCustomMusic();
      setCustomMusicName(null);
      setCustomMusicError(null);
    }
    setConfig((prev) => ({ ...prev, soundtrack: id }));
    if (isPlaying) {
      sharedAudioEngine.setConfig(id, durationSec, config.disableTransitionTones);
      sharedAudioEngine.start(currentTimeRef.current);
    }
  };

  const handleUploadCustomMusic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCustomMusicError(null);
    try {
      await sharedAudioEngine.loadCustomMusicFile(file);
      setCustomMusicName(file.name);
      // Play uploaded track straight through with zero voiceover, synth tones, or SFX
      setConfig((prev) => ({
        ...prev,
        voiceoverEnabled: false,
        disableTransitionTones: true,
        customMusicPlayMode: 'continuous',
      }));
      sharedAudioEngine.setVoiceoverEnabled(false);
      sharedAudioEngine.setConfig(config.soundtrack, durationSec, true);
      sharedAudioEngine.setCustomMusicScenes(
        scenes,
        config.customMusicStarts,
        'continuous',
        config.customMusicContinuousStartSec,
      );
      if (isPlaying) {
        sharedAudioEngine.start(currentTimeRef.current);
      }
    } catch {
      setCustomMusicError('Could not decode this audio file. Try MP3, WAV, or M4A.');
    }
  };

  const handleClearCustomMusic = () => {
    sharedAudioEngine.clearCustomMusic();
    setCustomMusicName(null);
    setCustomMusicError(null);
    if (isPlaying) {
      sharedAudioEngine.setConfig(config.soundtrack, durationSec, config.disableTransitionTones);
      sharedAudioEngine.start(currentTimeRef.current);
    }
  };

  const handleToggleTransitionTones = () => {
    const nextDisabled = !config.disableTransitionTones;
    setConfig((prev) => ({ ...prev, disableTransitionTones: nextDisabled }));
    if (isPlaying) {
      sharedAudioEngine.setConfig(config.soundtrack, durationSec, nextDisabled);
      sharedAudioEngine.start(currentTimeRef.current);
    }
  };

  const handleSwitchCut = (cut: AdCut) => {
    const newDur = cut === '30s' ? 30 : 45;
    setConfig((prev) => ({ ...prev, cut }));
    if (isPlaying) {
      setIsPlaying(false);
      sharedAudioEngine.stop();
    }
    setCurrentTime((prev) => Math.min(prev, newDur));
  };

  const handleExportVideo = async () => {
    if (isExportingVideo) return;
    setExportError(null);
    if (isPlaying) {
      setIsPlaying(false);
      sharedAudioEngine.stop();
    }

    if (config.voiceoverEnabled && !isVoiceoverReady) {
      await generateVoiceover();
    }

    const controller = new AbortController();
    exportAbortRef.current = controller;
    setIsExportingVideo(true);
    setExportProgress({ progress: 0, elapsedSec: 0, totalSec: durationSec });

    try {
      const blob = await exportLaunchVideoWebM(
        config,
        assetsRef.current,
        musicVol,
        sfxVol,
        (prog) => setExportProgress(prog),
        controller.signal,
        voiceVol,
      );
      const ratioSlug = config.aspectRatio.replace(':', 'x');
      triggerBlobDownload(blob, `shuleni-${config.campaign}-${ratioSlug}-${config.cut}.webm`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Video export failed.';
      if (msg !== 'Export cancelled.') {
        setExportError(msg);
      }
    } finally {
      setIsExportingVideo(false);
      setExportProgress(null);
      exportAbortRef.current = null;
    }
  };

  const handleCancelExport = () => {
    exportAbortRef.current?.abort();
  };

  const handleExportWav = async () => {
    if (isExportingWav) return;
    setIsExportingWav(true);
    try {
      if (config.voiceoverEnabled && !isVoiceoverReady) {
        await generateVoiceover();
      }
      sharedAudioEngine.setCustomMusicScenes(
        scenes,
        config.customMusicStarts,
        config.customMusicPlayMode,
        config.customMusicContinuousStartSec,
      );
      const wavBlob = await sharedAudioEngine.renderOfflineWav(
        config.soundtrack,
        durationSec,
        musicVol,
        sfxVol,
        config.disableTransitionTones,
        voiceVol,
      );
      triggerBlobDownload(wavBlob, `shuleni-soundtrack-${config.soundtrack}-${config.cut}.wav`);
    } finally {
      setIsExportingWav(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E11] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="border-b border-white/[0.08] bg-[#0B0E11]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <a
            href="#launch-film"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-500 rounded"
          >
            shuleni.co.ke
          </a>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            <a
              href="#launch-film"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 underline-offset-4 hover:underline"
            >
              Launch Film
            </a>
            <a
              href="#scenes"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 underline-offset-4 hover:underline"
            >
              Scenes
            </a>
            <a
              href="#soundtrack"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 underline-offset-4 hover:underline"
            >
              Soundtrack
            </a>
            <a
              href="#customize"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 underline-offset-4 hover:underline"
            >
              Customize
            </a>
            <a
              href="#x-automation"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 underline-offset-4 hover:underline"
            >
              X Posts
            </a>
          </nav>

          {/* Zone 3: Install + primary CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={handleExportVideo}
              disabled={isExportingVideo}
              className="px-4 py-2 text-xs font-semibold text-emerald-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              {isExportingVideo ? 'Rendering Video...' : 'Export Video'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Screening Room Hero */}
      <main id="launch-film" className="flex-1">
        <section className="max-w-[1200px] mx-auto px-6 pt-8 pb-12">
          {/* Headline & Campaign Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-medium text-emerald-400 mb-2">
                {config.campaign === 'students-parents'
                  ? 'Students & Parents Campaign · Past Papers, Resources & AI Assistant'
                  : 'Schools & Principals Campaign · Fees, Smart Gate & CBC'}
              </p>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white text-balance">
                {config.campaign === 'students-parents'
                  ? 'Shuleni Student & Parent Ad'
                  : 'Shuleni School Launch Film'}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Campaign Segmented Control */}
              <div className="flex items-center gap-1 p-1 bg-[#12161C] border border-white/[0.08] rounded-lg">
                <button
                  type="button"
                  onClick={() => handleSwitchCampaign('students-parents')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.campaign === 'students-parents'
                      ? 'bg-emerald-500 text-emerald-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Students & Parents
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchCampaign('schools')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.campaign === 'schools'
                      ? 'bg-emerald-500 text-emerald-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Schools & Principals
                </button>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                <span>{ASPECT_DIMENSIONS[config.aspectRatio].label}</span>
                <span aria-hidden="true">·</span>
                <span>{config.disableTransitionTones ? 'Pure Music' : 'Music + SFX'}</span>
              </div>
            </div>
          </div>

          {/* Video Cinema Stage */}
          <div className="bg-[#12161C] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="relative bg-[#07090C] flex items-center justify-center p-4 md:p-6">
              <div
                className={`relative w-full overflow-hidden rounded-lg border border-white/[0.08] bg-black ${
                  config.aspectRatio === '16:9'
                    ? 'max-w-[1040px] aspect-video'
                    : config.aspectRatio === '9:16'
                    ? 'max-w-[340px] aspect-[9/16]'
                    : 'max-w-[540px] aspect-square'
                }`}
              >
                <canvas
                  ref={canvasRef}
                  width={dims.width}
                  height={dims.height}
                  onClick={handlePlayPause}
                  className="w-full h-full block cursor-pointer"
                />

                {/* Initial Play Overlay (unlocks Web Audio API cleanly on user gesture) */}
                {!isPlaying && !hasStartedOnce && !isExportingVideo && (
                  <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center p-6 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handlePlayPause()}
                        disabled={voiceoverStatus === 'loading'}
                        className="inline-flex items-center gap-3 px-6 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-80 text-emerald-950 font-semibold text-sm transition-transform active:scale-[0.98] cursor-pointer shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                      >
                        {voiceoverStatus === 'loading' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Generating AI Voiceover...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>Play Launch Film with Sound</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => musicUploadInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-3.5 rounded-lg bg-black/65 hover:bg-black/80 border border-white/25 text-white font-medium text-sm transition-colors cursor-pointer backdrop-blur-sm"
                      >
                        <Upload className="w-4 h-4 text-emerald-400" />
                        <span>{customMusicName ? 'Change Song' : 'Load Your MP3 / WAV'}</span>
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-slate-200 max-w-md">
                      {customMusicName
                        ? `${config.cut} Commercial · Exact Track: ${customMusicName} (Music Only)`
                        : `${config.cut} Commercial · ${SOUNDTRACKS.find((s) => s.id === config.soundtrack)?.name}${
                            config.voiceoverEnabled ? ` · ${config.voiceoverVoice} Voiceover` : ' · Music Only'
                          }`}
                    </p>
                  </div>
                )}

                {/* Export Progress Overlay */}
                {isExportingVideo && exportProgress && (
                  <div className="absolute inset-0 bg-[#07090C]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                    <Film className="w-7 h-7 text-emerald-400 mb-3" />
                    <p className="font-display text-lg font-semibold text-white">
                      Recording Launch Video & Synchronized Audio
                    </p>
                    <p className="mt-1 text-xs text-slate-400 font-mono-tabular">
                      {Math.round(exportProgress.progress * 100)}% · {formatTime(exportProgress.elapsedSec)} / {formatTime(exportProgress.totalSec)}
                    </p>
                    <div className="w-full max-w-xs h-1.5 bg-white/10 rounded-full overflow-hidden mt-4">
                      <div
                        className="h-full bg-emerald-500 transition-[width] duration-150"
                        style={{ width: `${Math.round(exportProgress.progress * 100)}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelExport}
                      className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/15 text-xs font-medium text-slate-300 hover:text-white hover:border-white/30 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel Export</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Transport, Timeline Scrubber & Audio Strip */}
            <div className="border-t border-white/[0.08] px-4 md:px-6 py-4 space-y-4">
              {/* Scrubber with Scene Markers */}
              <div className="space-y-1.5">
                <div className="relative h-6 flex items-center">
                  {/* Chapter divider ticks */}
                  <div className="absolute inset-x-0 h-1.5 bg-white/10 rounded-full overflow-hidden pointer-events-none">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(currentTime / durationSec) * 100}%` }}
                    />
                  </div>
                  {scenes.slice(1).map((scene) => (
                    <div
                      key={scene.id}
                      className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-[#0B0E11] pointer-events-none"
                      style={{ left: `${scene.startFrac * 100}%` }}
                    />
                  ))}
                  <input
                    type="range"
                    aria-label="Seek video timeline"
                    min={0}
                    max={durationSec}
                    step={0.05}
                    value={currentTime}
                    onChange={(e) => handleSeek(parseFloat(e.target.value), false)}
                    className="relative w-full h-6 opacity-0 cursor-pointer z-10"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Scene {activeScene.indexLabel} · <strong className="text-slate-200 font-medium">{activeScene.title}</strong>
                  </span>
                  <span className="font-mono-tabular">
                    {formatTime(currentTime)} / {formatTime(durationSec)}
                  </span>
                </div>
              </div>

              {/* Playback Controls + Spectrum + Format Switches */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handlePlayPause()}
                    disabled={isExportingVideo || voiceoverStatus === 'loading'}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-50 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {voiceoverStatus === 'loading' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>
                      {voiceoverStatus === 'loading'
                        ? 'Generating Voice...'
                        : isPlaying
                        ? 'Pause'
                        : currentTime >= durationSec - 0.15
                        ? 'Replay'
                        : 'Play'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleRestart()}
                    disabled={isExportingVideo || voiceoverStatus === 'loading'}
                    aria-label="Restart film"
                    className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:border-white/25 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                    className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:border-white/25 transition-colors cursor-pointer"
                  >
                    {muted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => musicUploadInputRef.current?.click()}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      customMusicName
                        ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300'
                        : 'border-white/10 text-slate-300 hover:text-white hover:border-white/25'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span className="max-w-[160px] truncate">
                      {customMusicName ? customMusicName : 'Use Exact Song'}
                    </span>
                  </button>

                  {/* Live Web Audio Spectrum Meter */}
                  <div className="hidden sm:flex items-end gap-1 h-5 px-2" aria-hidden="true">
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <div
                        key={idx}
                        ref={(el) => {
                          spectrumBarsRef.current[idx] = el;
                        }}
                        className="w-1 h-full bg-emerald-400/80 rounded-sm origin-bottom transition-transform duration-75"
                        style={{ transform: 'scaleY(0.18)' }}
                      />
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio & Cut Segmented Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 p-1 bg-[#0B0E11] border border-white/[0.08] rounded-lg">
                    {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, aspectRatio: ratio }))}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          config.aspectRatio === ratio
                            ? 'bg-white/12 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-[#0B0E11] border border-white/[0.08] rounded-lg">
                    {(['30s', '45s'] as AdCut[]).map((cut) => (
                      <button
                        key={cut}
                        type="button"
                        onClick={() => handleSwitchCut(cut)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          config.cut === cut
                            ? 'bg-white/12 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cut} Cut
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {exportError && (
                <p className="text-xs text-amber-400 pt-1">
                  Export notice: {exportError}
                </p>
              )}
              {voiceoverError && (
                <p className="text-xs text-amber-400 pt-1">
                  Voiceover notice: {voiceoverError}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Section 01: Storyboard Chapters */}
        <section id="scenes" className="border-t border-white/[0.07] py-14">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  01. Launch Storyboard
                </h2>
                <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
                  Six visual chapters across the commercial while your background music plays uninterrupted from start to finish.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono-tabular">
                6 Scenes · {durationSec}s Total Runtime
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenes.map((scene) => {
                const startSec = scene.startFrac * durationSec;
                const endSec = scene.endFrac * durationSec;
                const isCurrent = activeScene.id === scene.id;

                return (
                  <div
                    key={scene.id}
                    className={`rounded-xl p-5 border transition-colors flex flex-col justify-between gap-4 ${
                      isCurrent
                        ? 'bg-[#161C24] border-emerald-500/45'
                        : 'bg-[#11151B] border-white/[0.07] hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span className="font-mono-tabular text-emerald-400">
                          Scene {scene.indexLabel}
                        </span>
                        <span className="font-mono-tabular">
                          {formatTime(startSec)} – {formatTime(endSec)}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-white">
                        {scene.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
                        {scene.visualSummary}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleSeek(startSec + 0.05, true)}
                        className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer whitespace-nowrap"
                      >
                        Jump & Play
                      </button>

                      {customMusicName ? (
                        <span className="text-xs text-slate-500">Continuous Audio</span>
                      ) : config.disableTransitionTones ? (
                        <span className="text-xs text-slate-500">Pure Background Music</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sharedAudioEngine.previewSfx(scene.sfxCue)}
                          className="text-xs text-slate-400 hover:text-white cursor-pointer truncate"
                        >
                          SFX: {scene.sfxLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 02: Soundtrack & Sound Effects Mixer */}
        <section id="soundtrack" className="border-t border-white/[0.07] py-14 bg-[#0E1217]">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  02. Soundtrack & Sound Design
                </h2>
                <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
                  Real-time synthesized music score and scene-locked sound effects rendered directly alongside the video.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportWav}
                disabled={isExportingWav}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 hover:border-white/30 text-xs font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingWav ? 'Rendering WAV...' : 'Download Audio Track (.wav)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Soundtrack Selection */}
              <div className="lg:col-span-7 space-y-3">
                {SOUNDTRACKS.map((track) => {
                  const selected = !customMusicName && config.soundtrack === track.id;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => handleSwitchSoundtrack(track.id)}
                      className={`w-full text-left p-5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                        selected
                          ? 'bg-[#161E24] border-emerald-500/50'
                          : 'bg-[#12161C] border-white/[0.07] hover:border-white/20'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 text-xs text-slate-400">
                          <Music2 className={`w-3.5 h-3.5 ${selected ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <span>{track.mood}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{track.bpm} BPM</span>
                        </div>
                        <p className="font-display text-base font-semibold text-white">
                          {track.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {track.instrumentation}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                          selected ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {selected ? 'Active Score' : 'Select'}
                      </span>
                    </button>
                  );
                })}

                {/* Upload Exact Audio Track (Pure Original Audio) */}
                <div
                  className={`p-5 rounded-xl border transition-colors space-y-4 ${
                    customMusicName
                      ? 'bg-[#161E24] border-emerald-500/50'
                      : 'bg-[#12161C] border-dashed border-white/15'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="font-display text-sm font-semibold text-white truncate">
                        {customMusicName
                          ? `Exact Track Active: ${customMusicName}`
                          : 'Use Your Exact Song (MP3 / WAV / M4A)'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {customMusicError
                          ? customMusicError
                          : 'Plays your exact unedited song file in pure Music-Only mode (zero voiceover, zero synth tones, zero SFX).'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        ref={musicUploadInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={(e) => void handleUploadCustomMusic(e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => musicUploadInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-emerald-950 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{customMusicName ? 'Replace Audio' : 'Upload MP3 / WAV'}</span>
                      </button>
                      {customMusicName && (
                        <button
                          type="button"
                          onClick={handleClearCustomMusic}
                          className="px-3 py-2 rounded-lg border border-white/15 hover:border-white/30 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {customMusicName && (
                    <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-emerald-300/90">
                        Playing straight through uninterrupted across all scenes
                      </span>
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <span>Start song at</span>
                        <input
                          type="text"
                          defaultValue={formatMmSs(config.customMusicContinuousStartSec)}
                          key={`cont-${config.customMusicContinuousStartSec}`}
                          onBlur={(e) => {
                            const parsed = parseMmSs(e.target.value);
                            if (parsed !== null) {
                              setConfig((prev) => ({
                                ...prev,
                                customMusicContinuousStartSec: parsed,
                              }));
                              if (isPlaying) {
                                sharedAudioEngine.setCustomMusicScenes(
                                  scenes,
                                  config.customMusicStarts,
                                  'continuous',
                                  parsed,
                                );
                                sharedAudioEngine.start(currentTimeRef.current);
                              }
                            }
                          }}
                          className="w-16 px-2 py-1 rounded bg-[#0B0E11] border border-white/15 text-xs text-white font-mono-tabular text-center focus:border-emerald-500 focus:outline-none"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Mix Levels, AI Voiceover & Transition Tones Toggle */}
              <div className="lg:col-span-5 bg-[#12161C] border border-white/[0.07] rounded-xl p-6 space-y-6">
                {/* AI Voiceover Narration Controls */}
                <div className="space-y-4 pb-5 border-b border-white/[0.07]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white flex items-center gap-2">
                        <Mic className="w-3.5 h-3.5 text-emerald-400" />
                        <span>AI Keynote Voiceover</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        Automatically ducks background music while speaking
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={config.voiceoverEnabled}
                      onClick={() =>
                        setConfig((prev) => ({ ...prev, voiceoverEnabled: !prev.voiceoverEnabled }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        config.voiceoverEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-white/10 text-slate-400 border border-white/15'
                      }`}
                    >
                      {config.voiceoverEnabled ? 'Voiceover On' : 'Voiceover Off'}
                    </button>
                  </div>

                  {config.voiceoverEnabled && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label htmlFor="voice-select" className="sr-only">
                          Narrator Voice
                        </label>
                        <select
                          id="voice-select"
                          value={config.voiceoverVoice}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              voiceoverVoice: e.target.value as VoiceoverVoice,
                            }))
                          }
                          className="flex-1 px-3 py-2 rounded-lg bg-[#0B0E11] border border-white/10 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                        >
                          {VOICEOVER_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label} · {v.tone}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => void generateVoiceover()}
                          disabled={voiceoverStatus === 'loading'}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-60 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {voiceoverStatus === 'loading' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <span>{isVoiceoverReady ? 'Regenerate' : 'Generate Voice'}</span>
                          )}
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <label htmlFor="voice-vol" className="font-medium text-slate-300">
                            Voiceover Level
                          </label>
                          <span className="font-mono-tabular text-slate-400">
                            {Math.round(voiceVol * 100)}%
                          </span>
                        </div>
                        <input
                          id="voice-vol"
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={voiceVol}
                          onChange={(e) => setVoiceVol(parseFloat(e.target.value))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      <p className="text-[11px] text-slate-400">
                        {voiceoverStatus === 'loading'
                          ? 'Synthesizing studio narration...'
                          : isVoiceoverReady
                          ? `Ready · ${config.voiceoverVoice} narration synced to timeline`
                          : voiceoverError
                          ? voiceoverError
                          : 'Generated automatically on Play or via Generate Voice'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
                  <div>
                    <p className="text-sm font-medium text-white">Transition Tones & SFX</p>
                    <p className="text-xs text-slate-400">
                      {config.disableTransitionTones
                        ? 'Disabled — smooth background score only'
                        : 'Enabled — subtle swells and scene chimes'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!config.disableTransitionTones}
                    onClick={handleToggleTransitionTones}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      config.disableTransitionTones
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/10 text-white border border-white/20'
                    }`}
                  >
                    {config.disableTransitionTones ? 'Pure Music' : 'SFX On'}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="music-vol" className="font-medium text-slate-300">
                        Background Music Level
                      </label>
                      <span className="font-mono-tabular text-slate-400">{Math.round(musicVol * 100)}%</span>
                    </div>
                    <input
                      id="music-vol"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={musicVol}
                      onChange={(e) => setMusicVol(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {!config.disableTransitionTones && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label htmlFor="sfx-vol" className="font-medium text-slate-300">
                          Sound Effects Level
                        </label>
                        <span className="font-mono-tabular text-slate-400">{Math.round(sfxVol * 100)}%</span>
                      </div>
                      <input
                        id="sfx-vol"
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={sfxVol}
                        onChange={(e) => setSfxVol(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {!config.disableTransitionTones && (
                  <div className="pt-4 border-t border-white/[0.07]">
                    <p className="text-xs font-medium text-slate-300 mb-3">
                      Audition Scene Sound Effects
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {SFX_PADS.map((pad) => (
                        <button
                          key={pad.cue}
                          type="button"
                          onClick={() => sharedAudioEngine.previewSfx(pad.cue)}
                          className="text-left p-2.5 rounded-lg bg-[#0B0E11] border border-white/[0.08] hover:border-emerald-500/40 transition-colors cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-white truncate">{pad.label}</p>
                          <p className="text-[11px] text-slate-400 truncate">{pad.detail}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section 03: Launch Copy Customizer & Direct Export */}
        <section id="customize" className="border-t border-white/[0.07] py-14">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  03. Customize Launch Copy & Export
                </h2>
                <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
                  Tailor your shuleni.co.ke launch headline, campaign banner, and call-to-action before exporting.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 bg-[#12161C] border border-white/[0.07] rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label htmlFor="ad-headline" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Brand Reveal Headline
                  </label>
                  <input
                    id="ad-headline"
                    type="text"
                    value={config.headline}
                    onChange={(e) => setConfig((prev) => ({ ...prev, headline: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0E11] border border-white/10 focus:border-emerald-500 focus:outline-none text-sm text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="ad-subheadline" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Closing Value Proposition
                  </label>
                  <input
                    id="ad-subheadline"
                    type="text"
                    value={config.subheadline}
                    onChange={(e) => setConfig((prev) => ({ ...prev, subheadline: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0E11] border border-white/10 focus:border-emerald-500 focus:outline-none text-sm text-white"
                  />
                </div>

                <div>
                  <label htmlFor="ad-notice" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Launch Kicker
                  </label>
                  <input
                    id="ad-notice"
                    type="text"
                    value={config.launchNotice}
                    onChange={(e) => setConfig((prev) => ({ ...prev, launchNotice: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0E11] border border-white/10 focus:border-emerald-500 focus:outline-none text-sm text-white"
                  />
                </div>

                <div>
                  <label htmlFor="ad-cta" className="block text-xs font-medium text-slate-300 mb-1.5">
                    End-Card Button Text
                  </label>
                  <input
                    id="ad-cta"
                    type="text"
                    value={config.ctaLabel}
                    onChange={(e) => setConfig((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0E11] border border-white/10 focus:border-emerald-500 focus:outline-none text-sm text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="ad-voiceover-script" className="block text-xs font-medium text-slate-300">
                      AI Voiceover Script
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono-tabular">
                      {config.voiceoverScript.length} / 1500
                    </span>
                  </div>
                  <textarea
                    id="ad-voiceover-script"
                    rows={3}
                    maxLength={1500}
                    value={config.voiceoverScript}
                    onChange={(e) => setConfig((prev) => ({ ...prev, voiceoverScript: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0E11] border border-white/10 focus:border-emerald-500 focus:outline-none text-sm text-white leading-relaxed resize-y"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <div>
                    <p className="text-sm font-medium text-white">On-Screen Subtitles</p>
                    <p className="text-xs text-slate-400">
                      Display clean lower-third captions for muted WhatsApp and social feeds
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.showSubtitles}
                    onClick={() => setConfig((prev) => ({ ...prev, showSubtitles: !prev.showSubtitles }))}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      config.showSubtitles
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}
                  >
                    {config.showSubtitles ? 'Captions On' : 'Captions Off'}
                  </button>
                </div>
              </div>

              {/* Export Summary Panel */}
              <div className="lg:col-span-5 bg-[#12161C] border border-white/[0.07] rounded-xl p-6 space-y-5">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                  <span>Ready-to-Publish Launch Master</span>
                </div>

                <dl className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
                    <dt className="text-slate-400">Format & Resolution</dt>
                    <dd className="text-slate-200 font-mono-tabular">
                      {dims.width}×{dims.height} ({config.aspectRatio})
                    </dd>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
                    <dt className="text-slate-400">Duration</dt>
                    <dd className="text-slate-200 font-mono-tabular">{durationSec} Seconds</dd>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
                    <dt className="text-slate-400">Audio Track</dt>
                    <dd className="text-slate-200 text-right">
                      {customMusicName
                        ? `Exact Track: ${customMusicName}`
                        : SOUNDTRACKS.find((s) => s.id === config.soundtrack)?.name}{' '}
                      {config.voiceoverEnabled ? `· ${config.voiceoverVoice} Voiceover` : ''}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <dt className="text-slate-400">Target Domain</dt>
                    <dd className="text-emerald-400 font-medium">{config.ctaUrl}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={handleExportVideo}
                  disabled={isExportingVideo}
                  className="w-full py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-emerald-950 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {isExportingVideo
                      ? `Rendering ${Math.round((exportProgress?.progress ?? 0) * 100)}%...`
                      : `Export Launch Video (${config.aspectRatio} .webm)`}
                  </span>
                </button>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Renders the complete animation and synchronized stereo soundtrack in real time directly in your browser.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 04: X (Twitter) Automation & Performance Lab */}
        <XAutomationSection />
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.07] py-8">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span className="font-display font-semibold text-slate-300">shuleni.co.ke</span>
          <div className="flex items-center gap-5">
            <a href="#launch-film" className="hover:text-slate-300 transition-colors">Launch Film</a>
            <a href="#scenes" className="hover:text-slate-300 transition-colors">Scenes</a>
            <a href="#soundtrack" className="hover:text-slate-300 transition-colors">Soundtrack</a>
            <a href="#customize" className="hover:text-slate-300 transition-colors">Export</a>
            <a href="#x-automation" className="hover:text-slate-300 transition-colors">X Posts</a>
          </div>
        </div>
      </footer>
      <OfflineIndicator />
    </div>
  );
}
