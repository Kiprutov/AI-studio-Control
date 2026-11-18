export type CampaignId = 'students-parents' | 'schools';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type AdCut = '30s' | '45s';
export type SoundtrackId =
  | 'enchanted-wonder'
  | 'google-keynote-tension'
  | 'study-horizon'
  | 'nairobi-dawn'
  | 'tech-keynote'
  | 'warm-acoustic';
export type VoiceoverVoice = 'Charon' | 'Kore' | 'Zephyr' | 'Puck' | 'Fenrir';

export interface AdConfig {
  campaign: CampaignId;
  aspectRatio: AspectRatio;
  cut: AdCut;
  soundtrack: SoundtrackId;
  disableTransitionTones: boolean;
  voiceoverEnabled: boolean;
  voiceoverVoice: VoiceoverVoice;
  voiceoverScript: string;
  customMusicStarts: Record<string, number>;
  customMusicPlayMode: 'sections' | 'continuous';
  customMusicContinuousStartSec: number;
  headline: string;
  subheadline: string;
  launchNotice: string;
  ctaUrl: string;
  ctaLabel: string;
  showSubtitles: boolean;
}

export interface SceneDefinition {
  id: string;
  indexLabel: string;
  title: string;
  subtitle: string;
  startFrac: number;
  endFrac: number;
  sfxCue: 'whoosh' | 'chime' | 'mpesa-ding' | 'qr-beep' | 'sms-pop' | 'launch-boom';
  sfxLabel: string;
  visualSummary: string;
  defaultSongStartSec: number;
  defaultSongSection: string;
}

export interface SoundtrackMeta {
  id: SoundtrackId;
  name: string;
  bpm: number;
  mood: string;
  instrumentation: string;
}

export const VOICEOVER_VOICES: { id: VoiceoverVoice; label: string; tone: string }[] = [
  { id: 'Charon', label: 'Charon', tone: 'Deep & Suspenseful Keynote' },
  { id: 'Kore', label: 'Kore', tone: 'Warm & Confident Narrator' },
  { id: 'Zephyr', label: 'Zephyr', tone: 'Crisp & Clear Studio Voice' },
  { id: 'Puck', label: 'Puck', tone: 'Bright & Energetic Launch' },
  { id: 'Fenrir', label: 'Fenrir', tone: 'Grounded & Authoritative' },
];

export const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number; label: string }> = {
  '16:9': { width: 1280, height: 720, label: '16:9 Widescreen' },
  '9:16': { width: 720, height: 1280, label: '9:16 Reels & Status' },
  '1:1': { width: 960, height: 960, label: '1:1 Social Square' },
};

export const SOUNDTRACKS: SoundtrackMeta[] = [
  {
    id: 'enchanted-wonder',
    name: 'Enchanted Wonder',
    bpm: 82,
    mood: 'Dreamy Acoustic Pop Ballad · Scene-Matched Arc',
    instrumentation: 'Sparkling acoustic guitar arpeggios, shimmering bells, warm strings & soaring piano chorus',
  },
  {
    id: 'google-keynote-tension',
    name: 'Keynote Anticipation',
    bpm: 128,
    mood: 'Sweet Piano & Strings · Fast Opening to Expectant Half-Time',
    instrumentation: 'Flowing acoustic piano & harp opening slowing into lush strings & warm Rhodes',
  },
  {
    id: 'study-horizon',
    name: 'Study Horizon',
    bpm: 96,
    mood: 'Calm & Uplifting Rhodes',
    instrumentation: 'Warm electric piano chords, gentle kalimba melody, soft bass',
  },
  {
    id: 'nairobi-dawn',
    name: 'Nairobi Dawn',
    bpm: 116,
    mood: 'Uplifting Afro-Tech Launch',
    instrumentation: 'Warm marimba arp, Rhodes pad, crisp shaker groove',
  },
  {
    id: 'tech-keynote',
    name: 'Keynote Pulse',
    bpm: 122,
    mood: 'Crisp Product Reveal',
    instrumentation: 'Plucked analog synth, fifth chords, soft pulse kick',
  },
  {
    id: 'warm-acoustic',
    name: 'Campus Warmth',
    bpm: 102,
    mood: 'Human & Trustworthy',
    instrumentation: 'Kalimba bell tones, gentle electric keys, brushed groove',
  },
];

export const STUDENT_PARENT_SCENES: SceneDefinition[] = [
  {
    id: 'sp-study-prep',
    indexLabel: '01',
    title: 'Past Papers & Study Hub',
    subtitle: 'KCSE, KJSEA, KCPE & CBC resources with verified marking schemes.',
    startFrac: 0,
    endFrac: 0.16,
    sfxCue: 'whoosh',
    sfxLabel: 'Pure Music Only',
    visualSummary: 'Bold Past Papers header with staggered reveal of KCSE, KJSEA, KCPE & CBC resources.',
    defaultSongStartSec: 0,
    defaultSongSection: 'Intro · Sparkling Acoustic Hush (0:00)',
  },
  {
    id: 'sp-brand-reveal',
    indexLabel: '02',
    title: 'Meet Shuleni Learning',
    subtitle: 'Past papers, school resources, and your 24/7 AI study assistant.',
    startFrac: 0.16,
    endFrac: 0.33,
    sfxCue: 'chime',
    sfxLabel: 'Pure Music Only',
    visualSummary: 'Geometric Shuleni emblem reveal and kinetic shuleni.co.ke student & parent tagline.',
    defaultSongStartSec: 55,
    defaultSongSection: 'Pre-Chorus Build · Rising Wonder (0:55)',
  },
  {
    id: 'sp-past-papers',
    indexLabel: '03',
    title: 'Verified Past Papers',
    subtitle: 'KCSE, KJSEA, and CBC past papers with complete marking schemes.',
    startFrac: 0.33,
    endFrac: 0.52,
    sfxCue: 'mpesa-ding',
    sfxLabel: 'Pure Music Only',
    visualSummary: 'Searchable library of Mathematics, Sciences, and CBC papers with verified marking schemes.',
    defaultSongStartSec: 70,
    defaultSongSection: 'Chorus Lift · Soaring & Bright (1:10)',
  },
  {
    id: 'sp-resources',
    indexLabel: '04',
    title: 'School Study Resources',
    subtitle: 'Organized topic notes, revision guides, and parent study tools.',
    startFrac: 0.52,
    endFrac: 0.69,
    sfxCue: 'qr-beep',
    sfxLabel: 'Pure Music Only',
    visualSummary: 'Sunlit classroom backdrop paired with structured topical notes and CBC revision packs.',
    defaultSongStartSec: 145,
    defaultSongSection: 'Warm Verse Groove · Steady Flow (2:25)',
  },
  {
    id: 'sp-ai-assistant',
    indexLabel: '05',
    title: 'AI Study Assistant',
    subtitle: 'Step-by-step explanations and exam coaching whenever you get stuck.',
    startFrac: 0.69,
    endFrac: 0.86,
    sfxCue: 'sms-pop',
    sfxLabel: 'Pure Music Only',
    visualSummary: 'Live Shuleni AI Assistant breaking down a Form 3 Maths question with marking-scheme steps.',
    defaultSongStartSec: 255,
    defaultSongSection: 'Final Chorus Peak · Breakthrough (4:15)',
  },
  {
    id: 'sp-launch-cta',
    indexLabel: '06',
    title: 'Start Learning Today',
    subtitle: 'Revise smarter with past papers and AI support at shuleni.co.ke.',
    startFrac: 0.86,
    endFrac: 1.0,
    sfxCue: 'launch-boom',
    sfxLabel: 'Pure Music Only',
    visualSummary: 'Clean emerald closing card inviting students and parents to shuleni.co.ke.',
    defaultSongStartSec: 310,
    defaultSongSection: 'Dreamy Outro · Sweet Finale (5:10)',
  },
];

export const SCHOOL_SCENES: SceneDefinition[] = [
  {
    id: 'morning-rush',
    indexLabel: '01',
    title: 'The Morning Rush',
    subtitle: 'Term opening shouldn’t feel like paperwork.',
    startFrac: 0,
    endFrac: 0.16,
    sfxCue: 'whoosh',
    sfxLabel: 'Warm Crossfade Swell',
    visualSummary: 'Sunlit Kenyan campus courtyard transitioning from manual ledgers and scattered gate logs.',
    defaultSongStartSec: 0,
    defaultSongSection: 'Opening Pulse (0:00)',
  },
  {
    id: 'brand-reveal',
    indexLabel: '02',
    title: 'Meet Shuleni',
    subtitle: 'One connected operating system for Kenyan schools.',
    startFrac: 0.16,
    endFrac: 0.34,
    sfxCue: 'chime',
    sfxLabel: 'Brand Crest Harmonic Chime',
    visualSummary: 'Geometric Shuleni shield-book emblem stroke reveal and kinetic wordmark lockup.',
    defaultSongStartSec: 22,
    defaultSongSection: 'Brand Reveal Lift (0:22)',
  },
  {
    id: 'mpesa-fees',
    indexLabel: '03',
    title: 'Instant M-Pesa & Fees',
    subtitle: 'Paybill tuition payments reconciled in real time.',
    startFrac: 0.34,
    endFrac: 0.52,
    sfxCue: 'mpesa-ding',
    sfxLabel: 'M-Pesa Receipt Confirmation Ding',
    visualSummary: 'Live Paybill 522533 KES settlement feed and term fee collection climbing to 96.4%.',
    defaultSongStartSec: 45,
    defaultSongSection: 'Main Groove (0:45)',
  },
  {
    id: 'smart-gate',
    indexLabel: '04',
    title: 'Smart Gate & Parent SMS',
    subtitle: 'QR check-in at the gate notifies parents immediately.',
    startFrac: 0.52,
    endFrac: 0.70,
    sfxCue: 'qr-beep',
    sfxLabel: 'QR Gate Scan + SMS Alert Pop',
    visualSummary: 'Student Smart ID laser scan paired with a smiling parent receiving an arrival SMS.',
    defaultSongStartSec: 65,
    defaultSongSection: 'Mid Section (1:05)',
  },
  {
    id: 'cbc-academics',
    indexLabel: '05',
    title: 'CBC & Academic Mastery',
    subtitle: 'Digital rubrics and one-click report cards.',
    startFrac: 0.70,
    endFrac: 0.85,
    sfxCue: 'sms-pop',
    sfxLabel: 'Report Publish Shimmer',
    visualSummary: 'Kenyan teacher reviewing CBC competency bars and publishing 480 digital transcripts.',
    defaultSongStartSec: 90,
    defaultSongSection: 'Climax Build (1:30)',
  },
  {
    id: 'launch-cta',
    indexLabel: '06',
    title: 'Launch Call to Action',
    subtitle: 'Launching now for schools across Kenya at shuleni.co.ke.',
    startFrac: 0.85,
    endFrac: 1.0,
    sfxCue: 'launch-boom',
    sfxLabel: 'Sub Impact & Final Brand Chord',
    visualSummary: 'Emerald-and-obsidian architectural end card inviting schools to book a live demo.',
    defaultSongStartSec: 120,
    defaultSongSection: 'Outro Resolve (2:00)',
  },
];

export function getScenesForCampaign(campaign: CampaignId): SceneDefinition[] {
  return campaign === 'students-parents' ? STUDENT_PARENT_SCENES : SCHOOL_SCENES;
}

export function getDefaultCustomStarts(campaign: CampaignId): Record<string, number> {
  const map: Record<string, number> = {};
  for (const scene of getScenesForCampaign(campaign)) {
    map[scene.id] = scene.defaultSongStartSec;
  }
  return map;
}

export const CAMPAIGN_PRESETS: Record<
  CampaignId,
  Omit<AdConfig, 'aspectRatio' | 'cut' | 'ctaUrl' | 'showSubtitles'>
> = {
  'students-parents': {
    campaign: 'students-parents',
    soundtrack: 'enchanted-wonder',
    disableTransitionTones: true,
    voiceoverEnabled: false,
    voiceoverVoice: 'Charon',
    voiceoverScript:
      "Late nights. Scattered notes. Missing marking schemes... Revision shouldn't feel like guesswork. Meet Shuleni. Verified KCSE and CBC past papers, structured school resources, and your twenty-four-seven AI study assistant—all in one place. Get ready for what's next... at shuleni.co.ke.",
    customMusicStarts: getDefaultCustomStarts('students-parents'),
    customMusicPlayMode: 'continuous',
    customMusicContinuousStartSec: 0,
    headline: 'Past papers, notes & your AI tutor.',
    subheadline:
      'Verified KCSE & CBC past papers, curated school resources, and 24/7 AI study help for Kenyan families.',
    launchNotice: 'For Students & Parents · Revision Hub Live',
    ctaLabel: 'Explore Past Papers & AI Tutor',
  },
  schools: {
    campaign: 'schools',
    soundtrack: 'google-keynote-tension',
    disableTransitionTones: true,
    voiceoverEnabled: true,
    voiceoverVoice: 'Charon',
    voiceoverScript:
      "Term opening mornings move fast. Paper registers, manual ledgers, delayed parent updates... It's time for a calmer standard. Meet Shuleni. Instant M-Pesa fee reconciliation, smart QR gate security, and one-click CBC reports. See what's next for Kenyan schools... at shuleni.co.ke.",
    customMusicStarts: getDefaultCustomStarts('schools'),
    customMusicPlayMode: 'continuous',
    customMusicContinuousStartSec: 0,
    headline: 'Every Kenyan school, connected.',
    subheadline: 'M-Pesa fee automation, smart QR gate security, and CBC reports in one calm platform.',
    launchNotice: 'Launching Now · Term Onboarding Open',
    ctaLabel: 'Book Your School Demo',
  },
};

export const DEFAULT_AD_CONFIG: AdConfig = {
  aspectRatio: '16:9',
  cut: '30s',
  ctaUrl: 'shuleni.co.ke',
  showSubtitles: true,
  ...CAMPAIGN_PRESETS['students-parents'],
};
