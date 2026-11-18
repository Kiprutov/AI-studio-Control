import { SceneDefinition, SCHOOL_SCENES, SoundtrackId, SOUNDTRACKS } from '../types/ad';

export type SfxCue = 'whoosh' | 'chime' | 'mpesa-ding' | 'qr-beep' | 'sms-pop' | 'launch-boom';

interface ScoreNote {
  time: number;
  freq: number;
  duration: number;
  gain: number;
  instrument: 'marimba' | 'pad' | 'strings' | 'bass' | 'pluck' | 'piano' | 'rhodes';
  cutoff?: number;
  reverbSend?: number;
}

interface PercHit {
  time: number;
  type: 'kick' | 'shaker' | 'rim';
  gain: number;
}

interface SfxEvent {
  time: number;
  cue: SfxCue;
}

interface CustomSceneCue {
  id: string;
  startFrac: number;
  endFrac: number;
  songStartSec: number;
}

const SCALES: Record<SoundtrackId, { root: number; chords: number[][]; arp: number[]; bass: number[] }> = {
  'enchanted-wonder': {
    // Dreamy Ab major acoustic ballad progression: Abmaj9 -> Eb/G -> Dbadd9 -> Fm7/Eb
    root: 207.65,
    chords: [
      [207.65, 261.63, 311.13, 392.0, 466.16], // Abmaj9 (sparkling, warm & sweet)
      [196.0, 233.08, 311.13, 392.0, 466.16], // Eb/G (luminous pre-chorus lift)
      [138.59, 207.65, 277.18, 349.23, 415.3], // Dbadd9 (soaring chorus heart)
      [174.61, 207.65, 261.63, 311.13, 415.3], // Fm7 (tender emotional wonder)
    ],
    arp: [415.3, 466.16, 523.25, 622.25, 830.61, 622.25, 523.25, 466.16],
    bass: [103.83, 98.0, 69.3, 87.31],
  },
  'google-keynote-tension': {
    // Sweet, emotional & expectant keynote progression: Fmaj9 -> Csus4/E -> Dm9 -> Bbmaj9
    root: 174.61,
    chords: [
      [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9 (warm & hopeful)
      [164.81, 220.0, 261.63, 293.66, 392.0], // Csus4/E (expectant suspension)
      [146.83, 220.0, 261.63, 329.63, 392.0], // Dm9 (emotional depth)
      [174.61, 233.08, 261.63, 349.23, 440.0], // Bbmaj9 (sweet cinematic lift)
    ],
    arp: [349.23, 440.0, 523.25, 659.25, 783.99, 659.25, 523.25, 440.0],
    bass: [87.31, 82.41, 73.42, 58.27],
  },
  'study-horizon': {
    root: 174.61,
    chords: [
      [220.0, 261.63, 329.63, 392.0],
      [196.0, 246.94, 293.66, 349.23],
      [233.08, 293.66, 349.23, 440.0],
      [261.63, 329.63, 392.0, 440.0],
    ],
    arp: [440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 440.0, 392.0],
    bass: [87.31, 73.42, 116.54, 130.81],
  },
  'nairobi-dawn': {
    root: 185.0,
    chords: [
      [277.18, 369.99, 440.0, 554.37],
      [246.94, 329.63, 415.3, 493.88],
      [207.65, 277.18, 369.99, 440.0],
      [277.18, 329.63, 415.3, 554.37],
    ],
    arp: [554.37, 659.25, 739.99, 880.0, 739.99, 659.25, 554.37, 493.88],
    bass: [92.5, 123.47, 103.83, 138.59],
  },
  'tech-keynote': {
    root: 220.0,
    chords: [
      [220.0, 277.18, 329.63, 415.3],
      [246.94, 329.63, 369.99, 493.88],
      [185.0, 277.18, 329.63, 440.0],
      [196.0, 293.66, 369.99, 440.0],
    ],
    arp: [440.0, 554.37, 659.25, 880.0, 659.25, 554.37, 493.88, 659.25],
    bass: [110.0, 123.47, 92.5, 146.83],
  },
  'warm-acoustic': {
    root: 196.0,
    chords: [
      [246.94, 293.66, 369.99, 493.88],
      [220.0, 293.66, 329.63, 440.0],
      [196.0, 246.94, 329.63, 392.0],
      [220.0, 277.18, 329.63, 440.0],
    ],
    arp: [392.0, 493.88, 587.33, 739.99, 587.33, 493.88, 440.0, 493.88],
    bass: [98.0, 110.0, 82.41, 110.0],
  },
};

function buildGoogleKeynoteTensionScore(durationSec: number): {
  notes: ScoreNote[];
  perc: PercHit[];
  sfx: SfxEvent[];
} {
  const scale = SCALES['google-keynote-tension'];
  const notes: ScoreNote[] = [];
  const perc: PercHit[] = [];
  const sfx: SfxEvent[] = [];

  // Phase 1 (0% - 28%): Brisk, flowing 128 BPM opening — lyrical piano & acoustic harp motion
  // No ticking sounds: soft heartbeat kick + gentle brushed shaker + warm sustained strings
  const fastEnd = durationSec * 0.28;
  const fastStep = 60 / 128 / 2; // ~0.234s per eighth note
  let t = 0;
  let step = 0;

  // Sweet rising & cascading arpeggio patterns per chord
  const fastFlows = [
    [0, 1, 2, 3, 4, 3, 2, 1], // Fmaj9 ripple
    [0, 2, 3, 4, 3, 2, 1, 2], // Csus4/E lift
  ];

  while (t < fastEnd) {
    const bar = Math.floor(step / 8);
    const beatInBar = step % 8;
    const chordIdx = bar % 2;
    const chord = scale.chords[chordIdx];
    const phaseFrac = t / fastEnd;

    // Gentle human timing nuance (±3ms)
    const humanOffset = ((step % 3) - 1) * 0.003;
    const nt = Math.max(0, t + humanOffset);

    if (beatInBar === 0) {
      // Warm lush string ensemble swell
      chord.slice(0, 4).forEach((f) => {
        notes.push({
          time: nt,
          freq: f,
          duration: fastStep * 7.8,
          gain: 0.036,
          instrument: 'strings',
          cutoff: 920 + phaseFrac * 240,
          reverbSend: 0.55,
        });
      });

      // Warm upright/finger bass root
      notes.push({
        time: nt,
        freq: scale.bass[chordIdx],
        duration: fastStep * 4.5,
        gain: 0.21,
        instrument: 'bass',
        reverbSend: 0.1,
      });
    }

    if (beatInBar === 4) {
      // Passing warm bass fifth
      notes.push({
        time: nt,
        freq: scale.bass[chordIdx] * 1.5,
        duration: fastStep * 3.2,
        gain: 0.14,
        instrument: 'bass',
        reverbSend: 0.1,
      });
    }

    // Sweet flowing felt piano & acoustic harp ripple (no harsh sawtooths!)
    const flowNoteIdx = fastFlows[chordIdx][beatInBar];
    const melodyFreq = chord[flowNoteIdx % chord.length] * (flowNoteIdx >= 3 ? 2 : 1);
    const velCurve = beatInBar === 0 || beatInBar === 4 ? 1.0 : 0.78;
    notes.push({
      time: nt,
      freq: melodyFreq,
      duration: fastStep * 2.2,
      gain: 0.088 * velCurve,
      instrument: beatInBar % 2 === 0 ? 'piano' : 'pluck',
      reverbSend: 0.45,
    });

    // Soft warm kick on 1 & 3, subtle brushed shaker on off-beats (zero harsh ticks!)
    if (beatInBar === 0 || beatInBar === 4) {
      perc.push({ time: nt, type: 'kick', gain: beatInBar === 0 ? 0.2 : 0.14 });
    }
    if (beatInBar === 2 || beatInBar === 6) {
      perc.push({ time: nt, type: 'shaker', gain: 0.032 });
    }

    t += fastStep;
    step += 1;
  }

  // Phase 2 (28% - 86%): REDUCES PACE -> Half-time (64 BPM) Sweet, Expectant Cinematic Score
  // Warm breathing strings + expressive felt grand piano melody + tender Rhodes harmonies
  const slowEnd = durationSec * 0.86;
  const slowStep = 60 / 64 / 2; // Half-time: ~0.468s per step
  let sStep = 0;

  // Sweet questioning lyrical piano motif across the 4-bar expectant chord cycle
  const melodicPhrases: (number | null)[][] = [
    [659.25, null, 587.33, 523.25, 440.0, null, 523.25, null], // Bar 1 (Fmaj9): tender descending question
    [587.33, null, 523.25, 440.0, 392.0, null, 440.0, 523.25], // Bar 2 (Csus4): suspended anticipation
    [659.25, null, 587.33, null, 523.25, 440.0, 392.0, null], // Bar 3 (Dm9): warm emotional longing
    [587.33, null, 523.25, 659.25, 783.99, null, 659.25, null], // Bar 4 (Bbmaj9): hopeful upward swell
  ];

  while (t < slowEnd) {
    const bar = Math.floor(sStep / 8);
    const beatInBar = sStep % 8;
    const chordIdx = bar % scale.chords.length;
    const chord = scale.chords[chordIdx];
    const tensionFrac = (t - fastEnd) / Math.max(1, slowEnd - fastEnd);
    const nt = Math.max(0, t + ((sStep % 3) - 1) * 0.004);

    if (beatInBar === 0) {
      // Rich swelling orchestral string ensemble
      chord.slice(0, 4).forEach((f) => {
        notes.push({
          time: nt,
          freq: f,
          duration: slowStep * 8.2,
          gain: 0.042 + tensionFrac * 0.016,
          instrument: 'strings',
          cutoff: 780 + tensionFrac * 420,
          reverbSend: 0.65,
        });
      });

      // Warm sustained Rhodes chord bed
      chord.slice(1, 4).forEach((f, idx) => {
        notes.push({
          time: nt + idx * 0.045, // Gentle rolled Rhodes chord feel
          freq: f,
          duration: slowStep * 6.5,
          gain: 0.036,
          instrument: 'rhodes',
          reverbSend: 0.5,
        });
      });

      // Deep warm sustained bass
      notes.push({
        time: nt,
        freq: scale.bass[chordIdx],
        duration: slowStep * 7.2,
        gain: 0.22,
        instrument: 'bass',
        reverbSend: 0.12,
      });
    }

    // Gentle expressive felt grand piano melody
    const phrase = melodicPhrases[chordIdx];
    const mFreq = phrase[beatInBar];
    if (mFreq !== null) {
      notes.push({
        time: nt,
        freq: mFreq,
        duration: slowStep * 3.1,
        gain: beatInBar === 0 ? 0.105 : 0.085,
        instrument: 'piano',
        reverbSend: 0.58,
      });
    }

    // Subtle warm accompaniment arpeggio on beats 2 & 5 for gentle motion
    if (beatInBar === 2 || beatInBar === 5) {
      notes.push({
        time: nt,
        freq: chord[beatInBar === 2 ? 2 : 3],
        duration: slowStep * 2.4,
        gain: 0.048,
        instrument: 'rhodes',
        reverbSend: 0.52,
      });
    }

    // Soft, deep heartbeat thump only on bar downbeat (and gentle breath at beat 4 in later build)
    if (beatInBar === 0) {
      perc.push({ time: nt, type: 'kick', gain: 0.17 });
    } else if (tensionFrac > 0.5 && beatInBar === 4) {
      perc.push({ time: nt, type: 'kick', gain: 0.12 });
    }

    t += slowStep;
    sStep += 1;
  }

  // Phase 3 (86% - 100%): Sweet, Radiant Fmaj9 Resolution as shuleni.co.ke appears
  const remain = Math.max(2.0, durationSec - t - 0.15);
  const resolveChord = [174.61, 220.0, 261.63, 329.63, 392.0]; // Fmaj9
  resolveChord.slice(0, 4).forEach((f) => {
    notes.push({
      time: t,
      freq: f,
      duration: remain,
      gain: 0.05,
      instrument: 'strings',
      cutoff: 1250,
      reverbSend: 0.68,
    });
  });

  notes.push({
    time: t,
    freq: 87.31,
    duration: remain,
    gain: 0.22,
    instrument: 'bass',
    reverbSend: 0.12,
  });

  // Sweet ascending closing piano cadence (C5 -> F5 -> A5 -> G5)
  const closingNotes = [
    { offset: 0, freq: 523.25, dur: 2.2, gain: 0.11 },
    { offset: 0.36, freq: 698.46, dur: 2.2, gain: 0.105 },
    { offset: 0.72, freq: 880.0, dur: 2.4, gain: 0.11 },
    { offset: 1.15, freq: 783.99, dur: Math.max(1.5, remain - 1.2), gain: 0.095 },
  ];
  closingNotes.forEach((cn) => {
    if (t + cn.offset < durationSec - 0.2) {
      notes.push({
        time: t + cn.offset,
        freq: cn.freq,
        duration: cn.dur,
        gain: cn.gain,
        instrument: 'piano',
        reverbSend: 0.65,
      });
    }
  });
  perc.push({ time: t, type: 'kick', gain: 0.21 });

  return { notes, perc, sfx };
}

function buildEnchantedWonderScore(durationSec: number): {
  notes: ScoreNote[];
  perc: PercHit[];
  sfx: SfxEvent[];
} {
  const scale = SCALES['enchanted-wonder'];
  const notes: ScoreNote[] = [];
  const perc: PercHit[] = [];
  const sfx: SfxEvent[] = [];

  // 82 BPM dreamy acoustic pop ballad structured scene-by-scene to match the 6 Student & Parent scenes
  const stepDur = 60 / 82 / 2; // ~0.366s per eighth note
  const totalSteps = Math.floor(durationSec / stepDur);

  // Soaring chorus & verse melody notes (Ab major: Ab4=415.3, Bb4=466.16, C5=523.25, Eb5=622.25, F5=698.46, Ab5=830.61)
  const chorusMelody: (number | null)[] = [622.25, null, 523.25, 466.16, 415.3, null, 523.25, 622.25];
  const climaxMelody: (number | null)[] = [830.61, null, 698.46, 622.25, 523.25, null, 622.25, 830.61];
  const arpOrder = [0, 1, 2, 3, 2, 4, 3, 2];

  for (let step = 0; step < totalSteps; step++) {
    const t = step * stepDur;
    const frac = t / durationSec;
    const bar = Math.floor(step / 8);
    const beatInBar = step % 8;
    const chordIdx = bar % scale.chords.length;
    const chord = scale.chords[chordIdx];
    const nt = Math.max(0, t + ((step % 3) - 1) * 0.003);

    // Natural continuous 4-bar song structure (never cuts or jumps at visual scene boundaries)
    const barCycle = bar % 8;
    const isIntro = bar < 2; // Bars 0-1: gentle acoustic shimmer intro
    const isPreChorus = bar >= 2 && bar < 4; // Bars 2-3: strings enter warmly
    const isChorus = barCycle >= 4 && frac < 0.88; // Bars 4-7: soaring full chorus
    const isBridge = barCycle < 4 && bar >= 4 && frac < 0.88; // Steady warm groove
    const isClimax = bar >= 8 && barCycle >= 4 && frac < 0.88;
    const isOutro = frac >= 0.88; // Gentle closing resolve at end of video

    // 1. Sparkling Acoustic Guitar / Harp Arpeggio throughout (quiet in outro)
    if (!isOutro || beatInBar < 4) {
      const idx = arpOrder[beatInBar];
      const arpFreq = chord[idx % chord.length] * (isChorus || isClimax ? 2 : 1);
      notes.push({
        time: nt,
        freq: arpFreq,
        duration: stepDur * 2.5,
        gain: isIntro ? 0.068 : isChorus || isClimax ? 0.088 : 0.075,
        instrument: 'pluck',
        reverbSend: 0.55,
      });
    }

    // 2. Warm Strings & Bass on bar downbeat (builds from Scene 2 onward)
    if (beatInBar === 0) {
      if (!isIntro) {
        const stringGain = isClimax ? 0.056 : isChorus ? 0.048 : isPreChorus ? 0.036 : 0.042;
        chord.slice(0, 4).forEach((f) => {
          notes.push({
            time: nt,
            freq: f,
            duration: stepDur * 8.1,
            gain: stringGain,
            instrument: 'strings',
            cutoff: isClimax || isChorus ? 1280 : 920,
            reverbSend: 0.66,
          });
        });
      }

      notes.push({
        time: nt,
        freq: scale.bass[chordIdx],
        duration: stepDur * 6.5,
        gain: isIntro ? 0.13 : isChorus || isClimax ? 0.23 : 0.19,
        instrument: 'bass',
        reverbSend: 0.12,
      });
    }

    if (beatInBar === 4 && !isIntro && !isOutro) {
      notes.push({
        time: nt,
        freq: scale.bass[chordIdx] * 1.5,
        duration: stepDur * 3.4,
        gain: 0.14,
        instrument: 'bass',
        reverbSend: 0.1,
      });
    }

    // 3. Sweet Felt Piano / Shimmer Melody matched to visual energy
    if (isIntro && (beatInBar === 0 || beatInBar === 4)) {
      notes.push({
        time: nt,
        freq: chord[3] * 2,
        duration: stepDur * 3.2,
        gain: 0.068,
        instrument: 'rhodes',
        reverbSend: 0.65,
      });
    } else if (isPreChorus && (beatInBar === 0 || beatInBar === 3 || beatInBar === 6)) {
      notes.push({
        time: nt,
        freq: scale.arp[(beatInBar + 2) % scale.arp.length],
        duration: stepDur * 2.6,
        gain: 0.082,
        instrument: 'piano',
        reverbSend: 0.58,
      });
    } else if (isChorus || isClimax) {
      const mel = isClimax ? climaxMelody[beatInBar] : chorusMelody[beatInBar];
      if (mel !== null) {
        notes.push({
          time: nt,
          freq: mel,
          duration: stepDur * 2.8,
          gain: isClimax ? 0.105 : 0.095,
          instrument: 'piano',
          reverbSend: 0.6,
        });
      }
    } else if (isBridge && (beatInBar === 0 || beatInBar === 2 || beatInBar === 5)) {
      notes.push({
        time: nt,
        freq: chord[beatInBar === 0 ? 3 : 2] * 2,
        duration: stepDur * 2.4,
        gain: 0.068,
        instrument: 'rhodes',
        reverbSend: 0.55,
      });
    } else if (isOutro && beatInBar === 0) {
      // Lingering sweet Abmaj9 closing bell notes
      notes.push({
        time: nt,
        freq: 830.61,
        duration: stepDur * 6.5,
        gain: 0.095,
        instrument: 'piano',
        reverbSend: 0.72,
      });
      notes.push({
        time: nt + stepDur * 1.5,
        freq: 622.25,
        duration: stepDur * 5.5,
        gain: 0.08,
        instrument: 'piano',
        reverbSend: 0.72,
      });
    }

    // 4. Gentle heartfelt acoustic drum groove during Chorus, Bridge, and Climax (no ticking!)
    if (isChorus || isBridge || isClimax) {
      if (beatInBar === 0 || beatInBar === 4) {
        perc.push({ time: nt, type: 'kick', gain: isClimax ? 0.22 : 0.17 });
      }
      if (beatInBar === 2 || beatInBar === 6) {
        perc.push({ time: nt, type: 'shaker', gain: 0.038 });
      }
    } else if (isPreChorus && beatInBar === 0) {
      perc.push({ time: nt, type: 'kick', gain: 0.13 });
    }
  }

  return { notes, perc, sfx };
}

function buildScore(
  soundtrack: SoundtrackId,
  durationSec: number,
  disableTransitionTones: boolean,
): { notes: ScoreNote[]; perc: PercHit[]; sfx: SfxEvent[] } {
  if (soundtrack === 'enchanted-wonder') {
    const score = buildEnchantedWonderScore(durationSec);
    if (!disableTransitionTones) {
      score.sfx.push({ time: durationSec * 0.86 + 0.1, cue: 'chime' });
    }
    return score;
  }

  if (soundtrack === 'google-keynote-tension') {
    const score = buildGoogleKeynoteTensionScore(durationSec);
    if (!disableTransitionTones) {
      for (const scene of SCHOOL_SCENES) {
        const sceneTime = scene.startFrac * durationSec;
        if (scene.id === 'launch-cta') {
          score.sfx.push({ time: sceneTime + 0.1, cue: 'chime' });
        }
      }
    }
    return score;
  }

  const meta = SOUNDTRACKS.find((s) => s.id === soundtrack) ?? SOUNDTRACKS[0];
  const scale = SCALES[soundtrack];
  const stepDur = 60 / meta.bpm / 2;
  const totalSteps = Math.floor(durationSec / stepDur);

  const notes: ScoreNote[] = [];
  const perc: PercHit[] = [];
  const sfx: SfxEvent[] = [];

  for (let step = 0; step < totalSteps; step++) {
    const t = step * stepDur;
    const frac = t / durationSec;
    const bar = Math.floor(step / 8);
    const beatInBar = step % 8;
    const chordIdx = bar % scale.chords.length;
    const chord = scale.chords[chordIdx];

    const energy =
      frac < 0.15 ? 0.6 :
      frac < 0.34 ? 0.82 :
      frac < 0.85 ? 1.0 :
      0.9;

    if (beatInBar === 0) {
      for (const f of chord) {
        notes.push({
          time: t,
          freq: f,
          duration: stepDur * 7.8,
          gain: 0.044 * energy,
          instrument: soundtrack === 'study-horizon' ? 'strings' : 'pad',
          reverbSend: 0.5,
        });
      }
      notes.push({
        time: t,
        freq: scale.bass[chordIdx],
        duration: stepDur * 3.8,
        gain: 0.22 * energy,
        instrument: 'bass',
        reverbSend: 0.1,
      });
    }

    if (beatInBar === 5 && frac > 0.16) {
      notes.push({
        time: t,
        freq: scale.bass[chordIdx] * 1.5,
        duration: stepDur * 1.6,
        gain: 0.13 * energy,
        instrument: 'bass',
        reverbSend: 0.1,
      });
    }

    const arpPattern =
      soundtrack === 'study-horizon'
        ? [0, -1, 1, 2, -1, 4, 3, 2]
        : soundtrack === 'nairobi-dawn'
        ? [0, 2, 3, 2, 4, 5, 3, 7]
        : soundtrack === 'tech-keynote'
        ? [0, 1, 2, 3, 4, 3, 2, 1]
        : [0, -1, 2, 4, -1, 5, 3, -1];

    const idx = arpPattern[beatInBar];
    if (idx >= 0 && frac < 0.94) {
      const freq = scale.arp[idx % scale.arp.length];
      notes.push({
        time: t,
        freq,
        duration: stepDur * (soundtrack === 'study-horizon' ? 2.4 : 1.7),
        gain: (soundtrack === 'study-horizon' ? 0.1 : soundtrack === 'warm-acoustic' ? 0.115 : 0.1) * energy,
        instrument:
          soundtrack === 'tech-keynote'
            ? 'pluck'
            : soundtrack === 'study-horizon'
            ? 'rhodes'
            : 'marimba',
        reverbSend: 0.45,
      });
    }

    if (frac >= 0.1 && frac <= 0.94) {
      const isChill = soundtrack === 'study-horizon';
      if (beatInBar === 0 || (beatInBar === 4 && !isChill)) {
        perc.push({ time: t, type: 'kick', gain: isChill ? 0.18 : frac >= 0.34 ? 0.26 : 0.18 });
      }
      if (isChill && beatInBar === 5) {
        perc.push({ time: t, type: 'kick', gain: 0.12 });
      }
      if (beatInBar === 2 || beatInBar === 6) {
        perc.push({ time: t, type: 'rim', gain: (isChill ? 0.045 : 0.085) * energy });
      }
      if (beatInBar % 2 === 1 || soundtrack === 'nairobi-dawn') {
        perc.push({
          time: t,
          type: 'shaker',
          gain: (beatInBar % 2 === 1 ? (isChill ? 0.03 : 0.05) : 0.025) * energy,
        });
      }
    }
  }

  if (!disableTransitionTones) {
    for (const scene of SCHOOL_SCENES) {
      const sceneTime = scene.startFrac * durationSec;
      const swellLead = Math.max(0.05, sceneTime - 0.35);
      if (scene.id === 'brand-reveal') {
        sfx.push({ time: swellLead, cue: 'whoosh' });
        sfx.push({ time: sceneTime + 0.3, cue: 'chime' });
      } else if (scene.id === 'mpesa-fees') {
        sfx.push({ time: swellLead, cue: 'whoosh' });
        sfx.push({ time: sceneTime + 1.1, cue: 'mpesa-ding' });
      } else if (scene.id === 'smart-gate') {
        sfx.push({ time: swellLead, cue: 'whoosh' });
        sfx.push({ time: sceneTime + 1.0, cue: 'qr-beep' });
        sfx.push({ time: sceneTime + 2.2, cue: 'sms-pop' });
      } else if (scene.id === 'cbc-academics') {
        sfx.push({ time: swellLead, cue: 'whoosh' });
        sfx.push({ time: sceneTime + 1.2, cue: 'sms-pop' });
      } else if (scene.id === 'launch-cta') {
        sfx.push({ time: swellLead, cue: 'whoosh' });
        sfx.push({ time: sceneTime + 0.08, cue: 'launch-boom' });
        sfx.push({ time: sceneTime + 0.32, cue: 'chime' });
      }
    }
  }

  return { notes, perc, sfx };
}

function scheduleInstrumentNote(
  ctx: BaseAudioContext,
  dryDest: AudioNode,
  reverbDest: AudioNode | null,
  note: ScoreNote,
  absTime: number,
) {
  const connectOutput = (node: AudioNode) => {
    node.connect(dryDest);
    if (reverbDest && (note.reverbSend ?? 0.35) > 0) {
      const sendGain = ctx.createGain();
      sendGain.gain.setValueAtTime(note.reverbSend ?? 0.35, absTime);
      node.connect(sendGain);
      sendGain.connect(reverbDest);
    }
  };

  if (note.instrument === 'strings' || note.instrument === 'pad') {
    // Lush stereo-detuned warm string ensemble
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc1.type = note.instrument === 'strings' ? 'sawtooth' : 'triangle';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(note.freq, absTime);
    osc2.frequency.setValueAtTime(note.freq, absTime);
    osc1.detune.setValueAtTime(-6, absTime);
    osc2.detune.setValueAtTime(6, absTime);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(0.6, absTime);
    filter.frequency.setValueAtTime(note.cutoff ?? 880, absTime);

    const attack = note.instrument === 'strings' ? 0.52 : 0.35;
    const sustainEnd = Math.max(absTime + attack + 0.08, absTime + note.duration - 0.45);
    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(note.gain * 0.55, absTime + attack);
    g.gain.setValueAtTime(note.gain * 0.48, sustainEnd);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + note.duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    connectOutput(g);

    osc1.start(absTime);
    osc2.start(absTime);
    osc1.stop(absTime + note.duration + 0.06);
    osc2.stop(absTime + note.duration + 0.06);
  } else if (note.instrument === 'piano') {
    // Warm felt grand piano: pure fundamental + soft 2nd & 3rd harmonics + muted felt bloom
    const fund = ctx.createOscillator();
    const over2 = ctx.createOscillator();
    const over3 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    const g3 = ctx.createGain();

    fund.type = 'sine';
    fund.frequency.setValueAtTime(note.freq, absTime);
    over2.type = 'triangle';
    over2.frequency.setValueAtTime(note.freq * 2, absTime);
    over2.detune.setValueAtTime(2, absTime);
    over3.type = 'sine';
    over3.frequency.setValueAtTime(note.freq * 3, absTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1750, absTime);
    filter.frequency.exponentialRampToValueAtTime(520, absTime + Math.max(0.4, note.duration));

    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(note.gain, absTime + 0.018);
    g.gain.exponentialRampToValueAtTime(note.gain * 0.42, absTime + Math.min(0.45, note.duration * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + note.duration);

    g2.gain.setValueAtTime(0.0001, absTime);
    g2.gain.linearRampToValueAtTime(note.gain * 0.28, absTime + 0.012);
    g2.gain.exponentialRampToValueAtTime(0.0001, absTime + Math.min(0.8, note.duration * 0.65));

    g3.gain.setValueAtTime(0.0001, absTime);
    g3.gain.linearRampToValueAtTime(note.gain * 0.09, absTime + 0.008);
    g3.gain.exponentialRampToValueAtTime(0.0001, absTime + 0.28);

    fund.connect(filter);
    over2.connect(g2);
    g2.connect(filter);
    over3.connect(g3);
    g3.connect(filter);
    filter.connect(g);
    connectOutput(g);

    fund.start(absTime);
    over2.start(absTime);
    over3.start(absTime);
    fund.stop(absTime + note.duration + 0.06);
    over2.stop(absTime + note.duration + 0.06);
    over3.stop(absTime + 0.32);
  } else if (note.instrument === 'rhodes') {
    // Sweet warm Rhodes electric piano: creamy fundamental + soft bell tine chime
    const body = ctx.createOscillator();
    const warmth = ctx.createOscillator();
    const tine = ctx.createOscillator();
    const g = ctx.createGain();
    const wg = ctx.createGain();
    const tg = ctx.createGain();

    body.type = 'sine';
    body.frequency.setValueAtTime(note.freq, absTime);
    warmth.type = 'triangle';
    warmth.frequency.setValueAtTime(note.freq, absTime);
    warmth.detune.setValueAtTime(3.5, absTime);
    tine.type = 'sine';
    tine.frequency.setValueAtTime(note.freq * 4, absTime);

    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(note.gain, absTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + note.duration);

    wg.gain.setValueAtTime(0.18, absTime);
    tg.gain.setValueAtTime(0.0001, absTime);
    tg.gain.linearRampToValueAtTime(note.gain * 0.18, absTime + 0.006);
    tg.gain.exponentialRampToValueAtTime(0.0001, absTime + 0.14);

    body.connect(g);
    warmth.connect(wg);
    wg.connect(g);
    tine.connect(tg);
    tg.connect(g);
    connectOutput(g);

    body.start(absTime);
    warmth.start(absTime);
    tine.start(absTime);
    body.stop(absTime + note.duration + 0.05);
    warmth.stop(absTime + note.duration + 0.05);
    tine.stop(absTime + 0.18);
  } else if (note.instrument === 'marimba') {
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const g = ctx.createGain();
    const og = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, absTime);
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(note.freq * 4, absTime);

    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(note.gain, absTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + Math.min(0.48, note.duration));

    og.gain.setValueAtTime(0.0001, absTime);
    og.gain.linearRampToValueAtTime(note.gain * 0.16, absTime + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, absTime + 0.08);

    osc.connect(g);
    overtone.connect(og);
    og.connect(g);
    connectOutput(g);

    osc.start(absTime);
    overtone.start(absTime);
    osc.stop(absTime + 0.55);
    overtone.stop(absTime + 0.12);
  } else if (note.instrument === 'pluck') {
    // Warm nylon-string / concert harp pluck (soft & organic, no harsh sawtooth!)
    const osc = ctx.createOscillator();
    const oct = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const og = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note.freq, absTime);
    oct.type = 'sine';
    oct.frequency.setValueAtTime(note.freq * 2, absTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1450, absTime);
    filter.frequency.exponentialRampToValueAtTime(420, absTime + Math.min(0.35, note.duration));

    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(note.gain * 0.9, absTime + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + Math.max(0.28, note.duration));

    og.gain.setValueAtTime(0.0001, absTime);
    og.gain.linearRampToValueAtTime(note.gain * 0.25, absTime + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, absTime + 0.18);

    osc.connect(filter);
    oct.connect(og);
    og.connect(filter);
    filter.connect(g);
    connectOutput(g);

    osc.start(absTime);
    oct.start(absTime);
    osc.stop(absTime + Math.max(0.32, note.duration + 0.05));
    oct.stop(absTime + 0.22);
  } else if (note.instrument === 'bass') {
    // Warm upright/finger bass
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note.freq, absTime);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(note.freq, absTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, absTime);

    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(note.gain, absTime + 0.026);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + note.duration);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(g);
    connectOutput(g);

    osc.start(absTime);
    sub.start(absTime);
    osc.stop(absTime + note.duration + 0.05);
    sub.stop(absTime + note.duration + 0.05);
  }
}

function schedulePercHit(
  ctx: BaseAudioContext,
  dest: AudioNode,
  noiseBuffer: AudioBuffer,
  hit: PercHit,
  absTime: number,
) {
  if (hit.type === 'kick') {
    // Soft felt orchestral/studio kick — warm low heartbeat, never clicky
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(92, absTime);
    osc.frequency.exponentialRampToValueAtTime(42, absTime + 0.12);

    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(hit.gain, absTime + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + 0.26);

    osc.connect(g);
    g.connect(dest);
    osc.start(absTime);
    osc.stop(absTime + 0.28);
  } else if (hit.type === 'shaker') {
    // Gentle warm studio brush sweep
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(0.9, absTime);
    bp.frequency.setValueAtTime(2600, absTime);
    const g = ctx.createGain();

    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(hit.gain, absTime + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + 0.095);

    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(absTime);
    src.stop(absTime + 0.11);
  } else if (hit.type === 'rim') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, absTime);
    osc.frequency.exponentialRampToValueAtTime(240, absTime + 0.045);

    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(hit.gain * 0.75, absTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + 0.075);

    osc.connect(g);
    g.connect(dest);
    osc.start(absTime);
    osc.stop(absTime + 0.085);
  }
}

export function scheduleSfxCue(
  ctx: BaseAudioContext,
  dest: AudioNode,
  noiseBuffer: AudioBuffer,
  cue: SfxCue,
  absTime: number,
) {
  if (cue === 'whoosh') {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.setValueAtTime(0.7, absTime);
    lp.frequency.setValueAtTime(160, absTime);
    lp.frequency.exponentialRampToValueAtTime(520, absTime + 0.45);
    lp.frequency.exponentialRampToValueAtTime(180, absTime + 0.95);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(0.085, absTime + 0.42);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + 0.95);

    src.connect(lp);
    lp.connect(g);
    g.connect(dest);
    src.start(absTime);
    src.stop(absTime + 0.98);
  } else if (cue === 'chime') {
    const freqs = [554.37, 830.61, 1108.73, 1318.51];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = absTime + i * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);

      osc.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + 1.1);
    });
  } else if (cue === 'mpesa-ding') {
    [659.25, 987.77].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = absTime + i * 0.1;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);

      osc.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + 0.56);
    });
  } else if (cue === 'qr-beep') {
    [783.99, 1046.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = absTime + i * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);

      osc.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  } else if (cue === 'sms-pop') {
    [523.25, 783.99].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = absTime + i * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);

      osc.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  } else if (cue === 'launch-boom') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(98, absTime);
    osc.frequency.exponentialRampToValueAtTime(42, absTime + 0.9);

    g.gain.setValueAtTime(0.0001, absTime);
    g.gain.linearRampToValueAtTime(0.28, absTime + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, absTime + 1.25);

    osc.connect(g);
    g.connect(dest);
    osc.start(absTime);
    osc.stop(absTime + 1.3);
  }
}

function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 1.1);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.06 * white) / 1.06;
    data[i] = lastOut * 3.2;
  }
  return buffer;
}

function createWarmHallImpulse(ctx: BaseAudioContext): AudioBuffer {
  // 1.85-second warm stereo studio hall impulse response for lush acoustic space
  const duration = 1.85;
  const length = Math.floor(ctx.sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Exponential room decay with soft initial pre-delay fade-in
      const env = Math.min(1, i / (ctx.sampleRate * 0.025)) * Math.pow(1 - t, 2.8);
      const white = Math.random() * 2 - 1;
      // Warm velvet high-frequency damping
      lp = lp * 0.72 + white * 0.28;
      data[i] = lp * env * 0.55;
    }
  }
  return impulse;
}

function createWarmthChain(ctx: BaseAudioContext, destination: AudioNode): {
  dryBus: GainNode;
  reverbBus: GainNode;
} {
  const now = ctx.currentTime;
  const dryBus = ctx.createGain();
  const reverbBus = ctx.createGain();

  const convolver = ctx.createConvolver();
  convolver.buffer = createWarmHallImpulse(ctx);

  const reverbReturn = ctx.createGain();
  reverbReturn.gain.setValueAtTime(0.42, now);

  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.setValueAtTime(160, now);
  lowShelf.gain.setValueAtTime(2.2, now);

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.setValueAtTime(5200, now);
  highShelf.gain.setValueAtTime(-2.5, now);

  dryBus.connect(lowShelf);
  reverbBus.connect(convolver);
  convolver.connect(reverbReturn);
  reverbReturn.connect(lowShelf);

  lowShelf.connect(highShelf);
  highShelf.connect(destination);

  return { dryBus, reverbBus };
}

const VOICEOVER_LEAD_SEC = 0.45;

export class ShuleniAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private customMusicGain: GainNode | null = null;
  private musicDryBus: GainNode | null = null;
  private musicReverbBus: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private exportDest: MediaStreamAudioDestinationNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private schedulerTimer: number | null = null;
  private playOriginCtxTime = 0;
  private playOriginVideoTime = 0;
  private scheduledUntilVideoTime = -1;
  private soundtrack: SoundtrackId = 'google-keynote-tension';
  private durationSec = 30;
  private disableTransitionTones = true;
  private score: ReturnType<typeof buildScore> | null = null;

  private voiceoverBuffer: AudioBuffer | null = null;
  private voiceoverEnabled = true;
  private activeVoiceSource: AudioBufferSourceNode | null = null;

  private customMusicBuffer: AudioBuffer | null = null;
  private activeCustomMusicSources: AudioBufferSourceNode[] = [];
  private customSceneCues: CustomSceneCue[] = [];
  private customMusicPlayMode: 'sections' | 'continuous' = 'continuous';
  private customMusicContinuousStartSec = 0;

  private musicVolume = 0.72;
  private sfxVolume = 0.85;
  private voiceVolume = 0.95;
  private muted = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(3.5, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.008, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.22, this.ctx.currentTime);

      // Transparent safety limiter for mastered user-uploaded tracks
      const customLimiter = this.ctx.createDynamicsCompressor();
      customLimiter.threshold.setValueAtTime(-1.5, this.ctx.currentTime);
      customLimiter.knee.setValueAtTime(6, this.ctx.currentTime);
      customLimiter.ratio.setValueAtTime(2.0, this.ctx.currentTime);
      customLimiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
      customLimiter.release.setValueAtTime(0.12, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.customMusicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.78;

      this.exportDest = this.ctx.createMediaStreamDestination();
      this.noiseBuffer = createNoiseBuffer(this.ctx);

      const warmth = createWarmthChain(this.ctx, this.musicGain);
      this.musicDryBus = warmth.dryBus;
      this.musicReverbBus = warmth.reverbBus;

      this.musicGain.connect(compressor);
      this.sfxGain.connect(compressor);
      this.voiceGain.connect(compressor);
      compressor.connect(this.masterGain);

      this.customMusicGain.connect(customLimiter);
      customLimiter.connect(this.masterGain);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.masterGain.connect(this.exportDest);

      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private getEffectiveMusicLevel(): number {
    const hasVoice = this.voiceoverEnabled && this.voiceoverBuffer !== null;
    return hasVoice ? this.musicVolume * 0.44 : this.musicVolume;
  }

  private applyVolumes() {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain || !this.voiceGain) return;
    const t = this.ctx.currentTime;
    const effectiveMusic = this.getEffectiveMusicLevel();
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
    this.musicGain.gain.setTargetAtTime(effectiveMusic, t, 0.04);
    this.customMusicGain?.gain.setTargetAtTime(effectiveMusic, t, 0.04);
    this.sfxGain.gain.setTargetAtTime(this.disableTransitionTones ? 0 : this.sfxVolume, t, 0.02);
    this.voiceGain.gain.setTargetAtTime(this.voiceoverEnabled ? this.voiceVolume : 0, t, 0.02);
  }

  public setConfig(soundtrack: SoundtrackId, durationSec: number, disableTransitionTones = true) {
    const changed =
      this.soundtrack !== soundtrack ||
      this.durationSec !== durationSec ||
      this.disableTransitionTones !== disableTransitionTones;
    this.soundtrack = soundtrack;
    this.durationSec = durationSec;
    this.disableTransitionTones = disableTransitionTones;
    if (changed || !this.score) {
      this.score = buildScore(soundtrack, durationSec, disableTransitionTones);
    }
    this.applyVolumes();
  }

  public setVolumes(musicVol: number, sfxVol: number, muted: boolean, voiceVol = this.voiceVolume) {
    this.musicVolume = musicVol;
    this.sfxVolume = sfxVol;
    this.voiceVolume = voiceVol;
    this.muted = muted;
    this.applyVolumes();
  }

  public setVoiceoverEnabled(enabled: boolean) {
    this.voiceoverEnabled = enabled;
    if (!enabled && this.activeVoiceSource) {
      try {
        this.activeVoiceSource.stop();
      } catch {
        // ignore if already stopped
      }
      this.activeVoiceSource = null;
    }
    this.applyVolumes();
  }

  public async decodeBase64Voiceover(base64Audio: string): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0));
    this.voiceoverBuffer = decoded;
    this.applyVolumes();
    return decoded;
  }

  public clearVoiceoverBuffer() {
    this.voiceoverBuffer = null;
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.stop();
      } catch {
        // ignore
      }
      this.activeVoiceSource = null;
    }
    this.applyVolumes();
  }

  public hasVoiceoverBuffer(): boolean {
    return this.voiceoverBuffer !== null;
  }

  public setCustomMusicScenes(
    scenes: SceneDefinition[],
    customStarts: Record<string, number>,
    playMode: 'sections' | 'continuous' = 'continuous',
    continuousStartSec = 0,
  ) {
    this.customSceneCues = scenes.map((s) => ({
      id: s.id,
      startFrac: s.startFrac,
      endFrac: s.endFrac,
      songStartSec: Math.max(0, customStarts[s.id] ?? s.defaultSongStartSec ?? 0),
    }));
    this.customMusicPlayMode = playMode;
    this.customMusicContinuousStartSec = Math.max(0, continuousStartSec);
  }

  public async loadCustomMusicFile(file: File): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    this.customMusicBuffer = decoded;
    return decoded;
  }

  public clearCustomMusic() {
    this.customMusicBuffer = null;
    this.stopActiveCustomMusic();
  }

  public hasCustomMusic(): boolean {
    return this.customMusicBuffer !== null;
  }

  public getCustomMusicDuration(): number {
    return this.customMusicBuffer?.duration ?? 0;
  }

  private scheduleCustomMusicSegments(
    ctx: BaseAudioContext,
    dest: AudioNode,
    originCtxTime: number,
    videoTime: number,
    durationSec: number,
    collectSources?: AudioBufferSourceNode[],
  ) {
    if (!this.customMusicBuffer) return;
    const buffer = this.customMusicBuffer;
    const bufDur = Math.max(0.2, buffer.duration);

    if (this.customMusicPlayMode === 'continuous' || this.customSceneCues.length === 0) {
      const mSrc = ctx.createBufferSource();
      mSrc.buffer = buffer;
      mSrc.loop = true;

      const segGain = ctx.createGain();
      mSrc.connect(segGain);
      segGain.connect(dest);

      const startOffset = (this.customMusicContinuousStartSec + videoTime) % bufDur;
      const remaining = Math.max(0.1, durationSec - videoTime);
      const endCtx = originCtxTime + remaining;

      // Smooth perceptual cosine-squared fade-out over the final ~3.2 seconds
      const fadeOutTotal = Math.min(3.2, durationSec * 0.25);
      const fadeStartVideoTime = Math.max(0, durationSec - fadeOutTotal);
      const fadeEndVideoTime = Math.max(fadeStartVideoTime + 0.1, durationSec - 0.08);
      const fadeInDur = Math.min(0.03, remaining * 0.1);
      const fadeInEndCtx = originCtxTime + fadeInDur;

      const startProgress =
        videoTime > fadeStartVideoTime
          ? Math.min(1, (videoTime - fadeStartVideoTime) / Math.max(0.01, fadeEndVideoTime - fadeStartVideoTime))
          : 0;
      const startGain = Math.max(0.0001, Math.pow(Math.cos(startProgress * Math.PI * 0.5), 2));

      segGain.gain.setValueAtTime(0.0001, originCtxTime);
      segGain.gain.linearRampToValueAtTime(startGain, fadeInEndCtx);

      if (videoTime < fadeEndVideoTime - 0.05) {
        const curveStartCtx = Math.max(
          fadeInEndCtx + 0.005,
          originCtxTime + Math.max(0, fadeStartVideoTime - videoTime),
        );
        const curveEndCtx = originCtxTime + (fadeEndVideoTime - videoTime);
        const curveDur = Math.max(0.04, curveEndCtx - curveStartCtx);

        const steps = 64;
        const curve = new Float32Array(steps);
        for (let i = 0; i < steps; i++) {
          const frac = startProgress + (1 - startProgress) * (i / (steps - 1));
          const val = Math.pow(Math.cos(frac * Math.PI * 0.5), 2);
          curve[i] = Math.max(0.0001, val);
        }
        curve[steps - 1] = 0;
        segGain.gain.setValueCurveAtTime(curve, curveStartCtx, curveDur);
      } else {
        segGain.gain.linearRampToValueAtTime(0, endCtx - 0.02);
      }

      mSrc.start(originCtxTime, startOffset);
      mSrc.stop(endCtx + 0.05);
      collectSources?.push(mSrc);
      return;
    }

    const fadeSec = 0.42;
    const halfFade = fadeSec * 0.5;

    this.customSceneCues.forEach((cue, idx) => {
      const rawStart = cue.startFrac * durationSec;
      const rawEnd = cue.endFrac * durationSec;
      const segStart = idx === 0 ? 0 : Math.max(0, rawStart - halfFade);
      const segEnd = idx === this.customSceneCues.length - 1 ? durationSec : Math.min(durationSec, rawEnd + halfFade);

      if (segEnd <= videoTime + 0.02) return;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const segGain = ctx.createGain();
      src.connect(segGain);
      segGain.connect(dest);

      const startInVideo = Math.max(videoTime, segStart);
      const whenCtx = originCtxTime + (startInVideo - videoTime);
      const endCtx = originCtxTime + (segEnd - videoTime);
      const elapsedIntoSeg = Math.max(0, startInVideo - segStart);
      const bufferOffset = (cue.songStartSec + elapsedIntoSeg) % bufDur;

      // Crossfade envelope between matched song sections
      if (elapsedIntoSeg < 0.05) {
        const inDur = idx === 0 ? 0.14 : Math.min(fadeSec, (segEnd - startInVideo) * 0.4);
        segGain.gain.setValueAtTime(0.0001, whenCtx);
        segGain.gain.linearRampToValueAtTime(1, whenCtx + inDur);
      } else {
        segGain.gain.setValueAtTime(1, whenCtx);
      }

      const outDur = Math.min(idx === this.customSceneCues.length - 1 ? 0.6 : fadeSec, (endCtx - whenCtx) * 0.45);
      const fadeOutStart = Math.max(whenCtx + 0.02, endCtx - outDur);
      segGain.gain.setValueAtTime(1, fadeOutStart);
      segGain.gain.linearRampToValueAtTime(0.0001, endCtx);

      src.start(whenCtx, bufferOffset);
      src.stop(endCtx + 0.04);
      collectSources?.push(src);
    });
  }

  public start(videoTime: number) {
    const ctx = this.ensureContext();
    if (!this.score) {
      this.score = buildScore(this.soundtrack, this.durationSec, this.disableTransitionTones);
    }

    this.stopSchedulerOnly();
    this.stopActiveVoiceover();
    this.stopActiveCustomMusic();
    this.isPlaying = true;
    this.playOriginCtxTime = ctx.currentTime + 0.04;
    this.playOriginVideoTime = videoTime;
    this.scheduledUntilVideoTime = videoTime - 0.001;
    this.applyVolumes();

    if (this.customMusicBuffer && this.customMusicGain) {
      this.scheduleCustomMusicSegments(
        ctx,
        this.customMusicGain,
        this.playOriginCtxTime,
        videoTime,
        this.durationSec,
        this.activeCustomMusicSources,
      );
    }

    if (this.voiceoverEnabled && this.voiceoverBuffer && this.voiceGain) {
      const voDuration = this.voiceoverBuffer.duration;
      const offsetInBuffer = videoTime - VOICEOVER_LEAD_SEC;
      if (offsetInBuffer < voDuration) {
        const src = ctx.createBufferSource();
        src.buffer = this.voiceoverBuffer;
        src.connect(this.voiceGain);
        if (offsetInBuffer < 0) {
          src.start(this.playOriginCtxTime + Math.abs(offsetInBuffer), 0);
        } else {
          src.start(this.playOriginCtxTime, offsetInBuffer);
        }
        this.activeVoiceSource = src;

        const remainingVo = Math.max(0, voDuration - Math.max(0, offsetInBuffer));
        const voEndCtxTime =
          this.playOriginCtxTime + (offsetInBuffer < 0 ? Math.abs(offsetInBuffer) : 0) + remainingVo;
        this.musicGain?.gain.setTargetAtTime(this.musicVolume, voEndCtxTime + 0.15, 0.35);
        this.customMusicGain?.gain.setTargetAtTime(this.musicVolume, voEndCtxTime + 0.15, 0.35);
      }
    }

    this.tickScheduler();
    this.schedulerTimer = window.setInterval(() => this.tickScheduler(), 80);
  }

  public stop() {
    this.isPlaying = false;
    this.stopSchedulerOnly();
    this.stopActiveVoiceover();
    this.stopActiveCustomMusic();
    if (this.ctx && this.masterGain) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      window.setTimeout(() => {
        if (!this.isPlaying && this.ctx && this.masterGain) {
          this.applyVolumes();
        }
      }, 110);
    }
  }

  private stopActiveCustomMusic() {
    for (const src of this.activeCustomMusicSources) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    this.activeCustomMusicSources = [];
  }

  private stopActiveVoiceover() {
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.stop();
      } catch {
        // ignore
      }
      this.activeVoiceSource = null;
    }
  }

  private stopSchedulerOnly() {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private tickScheduler() {
    if (
      !this.isPlaying ||
      !this.ctx ||
      !this.score ||
      !this.musicDryBus ||
      !this.sfxGain ||
      !this.noiseBuffer
    ) {
      return;
    }
    const nowCtx = this.ctx.currentTime;
    const elapsedSinceOrigin = nowCtx - this.playOriginCtxTime;
    const currentVideoTime = this.playOriginVideoTime + elapsedSinceOrigin;
    const lookaheadEnd = currentVideoTime + 0.32;

    const windowStart = Math.max(this.scheduledUntilVideoTime, currentVideoTime - 0.02);
    if (lookaheadEnd <= windowStart) return;

    if (!this.customMusicBuffer) {
      for (const note of this.score.notes) {
        if (note.time > windowStart && note.time <= lookaheadEnd) {
          const absTime = this.playOriginCtxTime + (note.time - this.playOriginVideoTime);
          if (absTime >= nowCtx - 0.02) {
            scheduleInstrumentNote(
              this.ctx,
              this.musicDryBus,
              this.musicReverbBus,
              note,
              Math.max(nowCtx, absTime),
            );
          }
        }
      }

      for (const hit of this.score.perc) {
        if (hit.time > windowStart && hit.time <= lookaheadEnd) {
          const absTime = this.playOriginCtxTime + (hit.time - this.playOriginVideoTime);
          if (absTime >= nowCtx - 0.02) {
            schedulePercHit(this.ctx, this.musicDryBus, this.noiseBuffer, hit, Math.max(nowCtx, absTime));
          }
        }
      }
    }

    for (const ev of this.score.sfx) {
      if (ev.time > windowStart && ev.time <= lookaheadEnd) {
        const absTime = this.playOriginCtxTime + (ev.time - this.playOriginVideoTime);
        if (absTime >= nowCtx - 0.02) {
          scheduleSfxCue(this.ctx, this.sfxGain, this.noiseBuffer, ev.cue, Math.max(nowCtx, absTime));
        }
      }
    }

    this.scheduledUntilVideoTime = lookaheadEnd;
  }

  public previewSfx(cue: SfxCue) {
    const ctx = this.ensureContext();
    if (!this.sfxGain || !this.noiseBuffer) return;
    this.applyVolumes();
    scheduleSfxCue(ctx, this.sfxGain, this.noiseBuffer, cue, ctx.currentTime + 0.01);
  }

  public getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser || !this.isPlaying) {
      target.fill(0);
      return false;
    }
    this.analyser.getByteFrequencyData(target);
    return true;
  }

  public getExportAudioStream(): MediaStream | null {
    this.ensureContext();
    return this.exportDest ? this.exportDest.stream : null;
  }

  public async renderOfflineWav(
    soundtrack: SoundtrackId,
    durationSec: number,
    musicVol: number,
    sfxVol: number,
    disableTransitionTones = true,
    voiceVol = this.voiceVolume,
  ): Promise<Blob> {
    const sampleRate = 44100;
    const totalSamples = Math.ceil(sampleRate * durationSec);
    const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

    const compressor = offline.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, 0);
    compressor.ratio.setValueAtTime(3.5, 0);

    const hasVoice = this.voiceoverEnabled && this.voiceoverBuffer !== null;
    const musicGain = offline.createGain();
    musicGain.gain.setValueAtTime(hasVoice ? musicVol * 0.44 : musicVol, 0);
    const customMusicGain = offline.createGain();
    customMusicGain.gain.setValueAtTime(hasVoice ? musicVol * 0.44 : musicVol, 0);
    const sfxGain = offline.createGain();
    sfxGain.gain.setValueAtTime(disableTransitionTones ? 0 : sfxVol, 0);
    const voiceGain = offline.createGain();
    voiceGain.gain.setValueAtTime(hasVoice ? voiceVol : 0, 0);

    const customLimiter = offline.createDynamicsCompressor();
    customLimiter.threshold.setValueAtTime(-1.5, 0);
    customLimiter.knee.setValueAtTime(6, 0);
    customLimiter.ratio.setValueAtTime(2.0, 0);

    const warmth = createWarmthChain(offline, musicGain);

    musicGain.connect(compressor);
    sfxGain.connect(compressor);
    voiceGain.connect(compressor);
    compressor.connect(offline.destination);

    customMusicGain.connect(customLimiter);
    customLimiter.connect(offline.destination);

    const noiseBuffer = createNoiseBuffer(offline);
    const score = buildScore(soundtrack, durationSec, disableTransitionTones);

    if (this.customMusicBuffer) {
      this.scheduleCustomMusicSegments(offline, customMusicGain, 0, 0, durationSec);
    } else {
      for (const note of score.notes) {
        if (note.time < durationSec) {
          scheduleInstrumentNote(offline, warmth.dryBus, warmth.reverbBus, note, note.time);
        }
      }
      for (const hit of score.perc) {
        if (hit.time < durationSec) {
          schedulePercHit(offline, warmth.dryBus, noiseBuffer, hit, hit.time);
        }
      }
    }
    if (!disableTransitionTones) {
      for (const ev of score.sfx) {
        if (ev.time < durationSec) {
          scheduleSfxCue(offline, sfxGain, noiseBuffer, ev.cue, ev.time);
        }
      }
    }

    if (hasVoice && this.voiceoverBuffer) {
      const voSrc = offline.createBufferSource();
      voSrc.buffer = this.voiceoverBuffer;
      voSrc.connect(voiceGain);
      voSrc.start(VOICEOVER_LEAD_SEC);
      const voEnd = VOICEOVER_LEAD_SEC + this.voiceoverBuffer.duration;
      if (voEnd < durationSec) {
        musicGain.gain.setTargetAtTime(musicVol, voEnd + 0.15, 0.35);
        customMusicGain.gain.setTargetAtTime(musicVol, voEnd + 0.15, 0.35);
      }
    }

    const rendered = await offline.startRendering();
    return audioBufferToWavBlob(rendered);
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const numFrames = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export const sharedAudioEngine = new ShuleniAudioEngine();
