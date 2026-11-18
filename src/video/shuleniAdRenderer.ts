import { AdConfig, ASPECT_DIMENSIONS, getScenesForCampaign } from '../types/ad';

export interface LoadedAdAssets {
  campusDawn: HTMLImageElement | null;
  classroomTech: HTMLImageElement | null;
  parentMobile: HTMLImageElement | null;
  studentStudy: HTMLImageElement | null;
}

const IMAGE_PATHS = {
  campusDawn: '/src/assets/images/shuleni_campus_dawn_1795014899325.jpg',
  classroomTech: '/src/assets/images/shuleni_classroom_tech_1795014900542.jpg',
  parentMobile: '/src/assets/images/shuleni_parent_mobile_1795014901545.jpg',
  studentStudy: '/src/assets/images/shuleni_student_study_1795016251316.jpg',
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function preloadAdAssets(): Promise<LoadedAdAssets> {
  const [campusDawn, classroomTech, parentMobile, studentStudy] = await Promise.all([
    loadImage(IMAGE_PATHS.campusDawn),
    loadImage(IMAGE_PATHS.classroomTech),
    loadImage(IMAGE_PATHS.parentMobile),
    loadImage(IMAGE_PATHS.studentStudy),
  ]);
  return { campusDawn, classroomTech, parentMobile, studentStudy };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutExpo(t: number): number {
  const x = clamp01(t);
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (!img || !img.naturalWidth) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#0E1714');
    g.addColorStop(1, '#090D11');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = w / h;
  let drawW = w;
  let drawH = h;
  if (imgRatio > canvasRatio) {
    drawH = h * zoom;
    drawW = drawH * imgRatio;
  } else {
    drawW = w * zoom;
    drawH = drawW / imgRatio;
  }
  const x = (w - drawW) * 0.5 + panX * (drawW - w) * 0.35;
  const y = (h - drawH) * 0.5 + panY * (drawH - h) * 0.35;
  ctx.drawImage(img, x, y, drawW, drawH);
  ctx.restore();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawMaskedSlideText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  progress: number,
  slidePx = fontSize * 0.58,
) {
  const p = easeOutExpo(progress);
  if (p <= 0.005) return;
  const textW = ctx.measureText(text).width;
  ctx.save();
  const clipTop = y - fontSize * 0.25;
  const clipH = fontSize * 1.56;
  ctx.beginPath();
  ctx.rect(x - 36, clipTop, textW + 72, clipH);
  ctx.clip();
  ctx.globalAlpha *= clamp01(p * 1.35);
  ctx.fillText(text, x, y + (1 - p) * slidePx);
  ctx.restore();
}

interface StaggerToken {
  text: string;
  color: string;
}

function drawStaggeredTokenLines(
  ctx: CanvasRenderingContext2D,
  tokens: StaggerToken[],
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  localT: number,
  startT: number,
  staggerStep: number,
  tokenDur: number,
): number {
  const spaceW = ctx.measureText(' ').width;
  const lines: { token: StaggerToken; offsetX: number }[][] = [[]];
  let curLineIdx = 0;
  let curX = 0;

  for (const tok of tokens) {
    const tw = ctx.measureText(tok.text).width;
    if (curX > 0 && curX + spaceW + tw > maxWidth) {
      curLineIdx += 1;
      lines[curLineIdx] = [];
      curX = 0;
    }
    const drawOffsetX = curX > 0 ? curX + spaceW : 0;
    lines[curLineIdx].push({ token: tok, offsetX: drawOffsetX });
    curX = drawOffsetX + tw;
  }

  let globalTokenIndex = 0;
  lines.forEach((lineTokens, li) => {
    const lineY = y + li * lineHeight;
    lineTokens.forEach(({ token, offsetX }) => {
      const tokT = (localT - startT - globalTokenIndex * staggerStep) / tokenDur;
      ctx.save();
      ctx.fillStyle = token.color;
      drawMaskedSlideText(ctx, token.text, x + offsetX, lineY, fontSize, tokT, fontSize * 0.52);
      ctx.restore();
      globalTokenIndex += 1;
    });
  });

  return lines.length;
}

function drawShuleniMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  progress: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  const scale = size / 100;
  ctx.scale(scale, scale);

  const p = easeOutExpo(progress);
  ctx.globalAlpha = clamp01(progress * 2);

  // Outer shield with rounded architectural geometry
  const grad = ctx.createLinearGradient(-44, -48, 44, 48);
  grad.addColorStop(0, '#10B981');
  grad.addColorStop(1, '#059669');

  ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.bezierCurveTo(22, -44, 38, -36, 38, -22);
  ctx.lineTo(38, 6);
  ctx.bezierCurveTo(38, 28, 18, 40, 0, 48);
  ctx.bezierCurveTo(-18, 40, -38, 28, -38, 6);
  ctx.lineTo(-38, -22);
  ctx.bezierCurveTo(-38, -36, -22, -44, 0, -44);
  ctx.closePath();
  ctx.fill();

  ctx.setLineDash([280]);
  ctx.lineDashOffset = 280 * (1 - p);
  ctx.stroke();
  ctx.setLineDash([]);

  // Open book / upward chevron motif inside shield
  const innerP = easeOutCubic((progress - 0.25) / 0.75);
  if (innerP > 0) {
    ctx.globalAlpha = innerP;
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 4.2;

    // Left page arc
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.quadraticCurveTo(-11, 10, -22, 13);
    ctx.lineTo(-22, -13);
    ctx.quadraticCurveTo(-11, -16, 0, -8);
    ctx.stroke();

    // Right page arc
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.quadraticCurveTo(11, 10, 22, 13);
    ctx.lineTo(22, -13);
    ctx.quadraticCurveTo(11, -16, 0, -8);
    ctx.stroke();

    // Center spine + rising sun node
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 18);
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, -21, 5.2 * innerP, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSubtleGrid(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = 1;
  const step = Math.round(Math.min(w, h) / 14);
  for (let x = step; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

let cachedScratchCanvas: HTMLCanvasElement | null = null;

function getScratchCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (!cachedScratchCanvas) {
    cachedScratchCanvas = document.createElement('canvas');
  }
  if (cachedScratchCanvas.width !== w || cachedScratchCanvas.height !== h) {
    cachedScratchCanvas.width = w;
    cachedScratchCanvas.height = h;
  }
  return cachedScratchCanvas;
}

function renderSceneContent(
  ctx: CanvasRenderingContext2D,
  sceneId: string,
  localT: number,
  w: number,
  h: number,
  config: AdConfig,
  assets: LoadedAdAssets,
) {
  const isVertical = config.aspectRatio === '9:16';
  const isSquare = config.aspectRatio === '1:1';
  const unit = Math.min(w, h);

  // Solid base for clean NLE cross-dissolve compositing
  ctx.fillStyle = '#090D11';
  ctx.fillRect(0, 0, w, h);

  // =========================================================================
  // SCENE 1: THE MORNING RUSH
  // =========================================================================
  if (sceneId === 'morning-rush') {
    const introFade = easeOutCubic(clamp01(localT / 0.14));
    drawCoverImage(ctx, assets.campusDawn, w, h, 1.05 + localT * 0.08, -localT * 0.45, 0, 0.44 * introFade);
    const scrim = ctx.createLinearGradient(0, 0, 0, h);
    scrim.addColorStop(0, 'rgba(6, 9, 13, 0.85)');
    scrim.addColorStop(0.55, 'rgba(6, 9, 13, 0.78)');
    scrim.addColorStop(1, 'rgba(6, 9, 13, 0.96)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    const enter = easeOutExpo(localT / 0.34);
    ctx.save();
    ctx.globalAlpha = enter;
    const padX = w * 0.08;
    const titleSize = isVertical ? unit * 0.084 : unit * 0.074;
    const startY = isVertical ? h * 0.2 : h * 0.19;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 3;
    ctx.font = `700 ${titleSize}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';

    const lines = wrapLines(ctx, 'Term opening shouldn’t feel like paperwork.', w - padX * 2);
    lines.forEach((line, idx) => {
      const yOffset = (1 - easeOutExpo((localT - idx * 0.05) / 0.38)) * 20;
      ctx.fillText(line, padX, startY + idx * titleSize * 1.15 + yOffset);
    });
    ctx.restore();

    const frictions = [
      'Manual fee receipt books & delayed bank slips',
      'Unlogged visitor and student gate entries',
      'Parents waiting days for term progress updates',
    ];
    const listY = startY + lines.length * titleSize * 1.15 + unit * 0.05;
    const rowW = Math.min(w - padX * 2, unit * 0.92);
    const rowH = unit * 0.056;
    ctx.font = `600 ${unit * 0.028}px "Plus Jakarta Sans", sans-serif`;

    frictions.forEach((item, i) => {
      const itemAppear = easeOutCubic((localT - 0.14 - i * 0.08) / 0.25);
      const slide = (1 - itemAppear) * 20;
      const y = listY + i * (unit * 0.072);
      ctx.save();
      ctx.globalAlpha = itemAppear;

      roundRectPath(ctx, padX + slide, y, rowW, rowH, 10);
      ctx.fillStyle = 'rgba(8, 12, 18, 0.94)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.48)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FBBF24';
      ctx.fillText('—', padX + slide + unit * 0.024, y + rowH * 0.5);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(item, padX + slide + unit * 0.058, y + rowH * 0.5, rowW - unit * 0.082);
      ctx.restore();
    });
    ctx.restore();
  }

  // =========================================================================
  // SCENE 2: BRAND REVEAL — MEET SHULENI
  // =========================================================================
  else if (sceneId === 'brand-reveal') {
    drawCoverImage(ctx, assets.campusDawn, w, h, 1.14 - localT * 0.05, 0.25, -0.15, 0.18);
    drawSubtleGrid(ctx, w, h, 0.045);

    const aura = ctx.createRadialGradient(w * 0.5, h * 0.44, 10, w * 0.5, h * 0.44, unit * 0.68);
    aura.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
    aura.addColorStop(0.55, 'rgba(16, 185, 129, 0.06)');
    aura.addColorStop(1, 'rgba(9, 13, 17, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);

    const markSize = unit * 0.19;
    const markY = isVertical ? h * 0.34 : h * 0.33;
    drawShuleniMark(ctx, w * 0.5, markY, markSize, localT / 0.5);

    const wordT = easeOutExpo((localT - 0.14) / 0.42);
    ctx.save();
    ctx.globalAlpha = wordT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const brandSize = isVertical ? unit * 0.115 : unit * 0.11;
    ctx.font = `700 ${brandSize}px "Bricolage Grotesque", sans-serif`;
    const brandY = markY + markSize * 0.64 + (1 - wordT) * 20;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(config.ctaUrl, w * 0.5, brandY);

    const lineW = Math.min(w * 0.42, unit * 0.42) * easeOutExpo((localT - 0.26) / 0.38);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(w * 0.5 - lineW * 0.5, brandY + brandSize * 1.12, lineW, 3);

    const tagT = easeOutCubic((localT - 0.3) / 0.38);
    ctx.globalAlpha = tagT;
    const tagSize = isVertical ? unit * 0.044 : unit * 0.038;
    ctx.font = `500 ${tagSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#CBD5E1';
    const tagLines = wrapLines(ctx, config.headline, w * 0.78);
    tagLines.forEach((line, i) => {
      ctx.fillText(line, w * 0.5, brandY + brandSize * 1.28 + i * tagSize * 1.3);
    });
    ctx.restore();
  }

  // =========================================================================
  // SCENE 3: INSTANT M-PESA & FEE AUTOMATION
  // =========================================================================
  else if (sceneId === 'mpesa-fees') {
    drawSubtleGrid(ctx, w, h, 0.045);
    const glow = ctx.createRadialGradient(w * 0.72, h * 0.38, 10, w * 0.72, h * 0.38, unit * 0.7);
    glow.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
    glow.addColorStop(1, 'rgba(9, 13, 17, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const padX = w * 0.075;
    const enter = easeOutExpo(localT / 0.32);

    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textBaseline = 'top';

    const kickerY = isVertical ? h * 0.13 : h * 0.16;
    ctx.font = `500 ${unit * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#10B981';
    ctx.fillText('01  AUTOMATED FEE RECONCILIATION', padX, kickerY);

    const headingSize = isVertical ? unit * 0.075 : unit * 0.064;
    ctx.font = `700 ${headingSize}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    const maxCopyW = isVertical ? w - padX * 2 : w * 0.42;
    const hLines = wrapLines(ctx, 'M-Pesa fees settled in real time.', maxCopyW);
    hLines.forEach((line, i) => {
      ctx.fillText(line, padX, kickerY + unit * 0.045 + i * headingSize * 1.12);
    });

    const bodyY = kickerY + unit * 0.045 + hLines.length * headingSize * 1.12 + unit * 0.028;
    ctx.font = `400 ${unit * 0.028}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#94A3B8';
    const bLines = wrapLines(
      ctx,
      'Every Paybill transaction matches the student ledger automatically—zero manual receipts.',
      maxCopyW,
    );
    bLines.forEach((line, i) => {
      ctx.fillText(line, padX, bodyY + i * unit * 0.04);
    });

    const cardW = isVertical ? w - padX * 2 : w * 0.42;
    const cardH = isVertical ? h * 0.36 : h * 0.62;
    const cardX = isVertical ? padX : w * 0.51;
    const cardY = isVertical ? h * 0.44 : h * 0.19;
    const cardSlide = (1 - easeOutExpo(localT / 0.42)) * 28;

    roundRectPath(ctx, cardX, cardY + cardSlide, cardW, cardH, 18);
    ctx.fillStyle = '#121820';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const innerPad = cardW * 0.07;
    const cx = cardX + innerPad;
    const cy = cardY + cardSlide + innerPad;

    ctx.font = `500 ${unit * 0.022}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('PAYBILL 522533 · TERM COLLECTION', cx, cy);

    const progressPct = 64 + 32.4 * easeOutCubic((localT - 0.1) / 0.65);
    const kesCollected = Math.round(2840000 + 1420000 * easeOutCubic((localT - 0.1) / 0.65));

    ctx.font = `700 ${unit * 0.062}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(`KES ${kesCollected.toLocaleString()}`, cx, cy + unit * 0.042);

    ctx.font = `500 ${unit * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#10B981';
    ctx.fillText(`${progressPct.toFixed(1)}% of Term 1 Target Reconciled`, cx, cy + unit * 0.118);

    const barY = cy + unit * 0.162;
    const barW = cardW - innerPad * 2;
    roundRectPath(ctx, cx, barY, barW, 10, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();

    roundRectPath(ctx, cx, barY, barW * (progressPct / 100), 10, 5);
    ctx.fillStyle = '#10B981';
    ctx.fill();

    const txAppear = easeOutExpo((localT - 0.24) / 0.35);
    if (txAppear > 0) {
      ctx.save();
      ctx.globalAlpha = txAppear;
      const txY = barY + unit * 0.042;
      const txH = unit * 0.145;
      roundRectPath(ctx, cx, txY, barW, txH, 12);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.11)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.38)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.font = `600 ${unit * 0.026}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#ECFDF5';
      ctx.fillText('M-Pesa Confirmed · SHL-88412K', cx + unit * 0.024, txY + unit * 0.024);

      ctx.font = `500 ${unit * 0.024}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#A7F3D0';
      ctx.fillText('Amani Wanjiku · Grade 7 East', cx + unit * 0.024, txY + unit * 0.064);

      ctx.font = `500 ${unit * 0.022}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#10B981';
      ctx.fillText('+ KES 28,500 · Synced in 0.4s', cx + unit * 0.024, txY + unit * 0.102);
      ctx.restore();
    }
    ctx.restore();
  }

  // =========================================================================
  // SCENE 4: SMART GATE & PARENT SMS
  // =========================================================================
  else if (sceneId === 'smart-gate') {
    drawCoverImage(ctx, assets.parentMobile, w, h, 1.05 + localT * 0.06, 0.25, -0.1, 0.44);
    const scrim = ctx.createLinearGradient(0, 0, w, 0);
    scrim.addColorStop(0, 'rgba(6, 9, 13, 0.94)');
    scrim.addColorStop(0.55, 'rgba(6, 9, 13, 0.78)');
    scrim.addColorStop(1, 'rgba(6, 9, 13, 0.55)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    const padX = w * 0.075;
    const enter = easeOutExpo(localT / 0.32);

    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textBaseline = 'top';

    const topY = isVertical ? h * 0.11 : h * 0.16;
    ctx.font = `500 ${unit * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#FBBF24';
    ctx.fillText('02  SMART ID GATE SECURITY', padX, topY);

    const titleSize = isVertical ? unit * 0.074 : unit * 0.062;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
    ctx.font = `700 ${titleSize}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    const maxCopyW = isVertical ? w - padX * 2 : w * 0.45;
    const lines = wrapLines(ctx, 'Scanned at the gate. Parents notified instantly.', maxCopyW);
    lines.forEach((line, i) => {
      ctx.fillText(line, padX, topY + unit * 0.045 + i * titleSize * 1.12);
    });
    ctx.restore();

    const cardW = isVertical ? w - padX * 2 : isSquare ? w * 0.44 : w * 0.38;
    const cardH = unit * 0.31;
    const cardX = padX;
    const cardY = isVertical ? h * 0.42 : topY + unit * 0.06 + lines.length * titleSize * 1.12 + unit * 0.04;

    roundRectPath(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = 'rgba(17, 24, 32, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const qrSize = cardH * 0.64;
    const qrX = cardX + unit * 0.032;
    const qrY = cardY + (cardH - qrSize) * 0.5;
    roundRectPath(ctx, qrX, qrY, qrSize, qrSize, 10);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();

    const cell = qrSize / 7;
    ctx.fillStyle = '#0F172A';
    const pattern = [
      [1, 1, 1, 0, 1, 1, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 1, 1, 0, 1, 1, 1],
      [0, 1, 0, 1, 0, 1, 0],
      [1, 1, 1, 1, 0, 1, 1],
      [1, 0, 1, 0, 1, 0, 1],
      [1, 1, 1, 0, 1, 1, 1],
    ];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (pattern[r][c]) {
          ctx.fillRect(qrX + c * cell + 3, qrY + r * cell + 3, cell - 4, cell - 4);
        }
      }
    }

    const scanFrac = (Math.sin(localT * Math.PI * 2.2) + 1) * 0.5;
    const laserY = qrY + 6 + scanFrac * (qrSize - 12);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(qrX - 4, laserY);
    ctx.lineTo(qrX + qrSize + 4, laserY);
    ctx.stroke();

    const infoX = qrX + qrSize + unit * 0.032;
    ctx.font = `700 ${unit * 0.032}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText('Amani Wanjiku', infoX, qrY + unit * 0.01);

    ctx.font = `500 ${unit * 0.023}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('ID: SHL-2026-0418 · Grade 7', infoX, qrY + unit * 0.055);

    const verifiedT = easeOutCubic((localT - 0.3) / 0.25);
    ctx.font = `600 ${unit * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = verifiedT > 0.5 ? '#10B981' : '#F59E0B';
    ctx.fillText(
      verifiedT > 0.5 ? 'VERIFIED · MAIN GATE 07:42 AM' : 'SCANNING SMART ID...',
      infoX,
      qrY + unit * 0.11,
    );

    const smsAppear = easeOutExpo((localT - 0.38) / 0.3);
    if (smsAppear > 0) {
      ctx.save();
      ctx.globalAlpha = smsAppear;
      const smsW = isVertical ? w - padX * 2 : unit * 0.62;
      const smsH = unit * 0.15;
      const smsX = isVertical ? padX : w - smsW - padX;
      const smsY = isVertical ? cardY + cardH + unit * 0.04 : h * 0.66 + (1 - smsAppear) * 20;

      roundRectPath(ctx, smsX, smsY, smsW, smsH, 14);
      ctx.fillStyle = 'rgba(13, 24, 21, 0.94)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = `600 ${unit * 0.021}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#10B981';
      ctx.fillText('SHULENI SMS · JUST NOW', smsX + unit * 0.028, smsY + unit * 0.024);

      ctx.font = `500 ${unit * 0.025}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#F1F5F9';
      const smsLines = wrapLines(
        ctx,
        'Good morning Mrs. Wanjiku, Amani arrived safely at school (07:42 AM).',
        smsW - unit * 0.056,
      );
      smsLines.forEach((l, i) => {
        ctx.fillText(l, smsX + unit * 0.028, smsY + unit * 0.06 + i * unit * 0.034);
      });
      ctx.restore();
    }

    ctx.restore();
  }

  // =========================================================================
  // SCENE 5: CBC & ACADEMIC MASTERY
  // =========================================================================
  else if (sceneId === 'cbc-academics') {
    drawCoverImage(ctx, assets.classroomTech, w, h, 1.06 + localT * 0.05, -0.2, 0.1, 0.4);
    const scrim = ctx.createLinearGradient(0, 0, w, 0);
    scrim.addColorStop(0, 'rgba(6, 9, 13, 0.94)');
    scrim.addColorStop(0.6, 'rgba(6, 9, 13, 0.82)');
    scrim.addColorStop(1, 'rgba(6, 9, 13, 0.6)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    const padX = w * 0.075;
    const enter = easeOutExpo(localT / 0.32);

    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textBaseline = 'top';

    const topY = isVertical ? h * 0.12 : h * 0.16;
    ctx.font = `500 ${unit * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#34D399';
    ctx.fillText('03  CBC & 8-4-4 ACADEMICS', padX, topY);

    const titleSize = isVertical ? unit * 0.072 : unit * 0.062;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
    ctx.font = `700 ${titleSize}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    const maxCopyW = isVertical ? w - padX * 2 : w * 0.43;
    const lines = wrapLines(ctx, 'Report cards & CBC rubrics in one click.', maxCopyW);
    lines.forEach((line, i) => {
      ctx.fillText(line, padX, topY + unit * 0.045 + i * titleSize * 1.12);
    });
    ctx.restore();

    const cardW = isVertical ? w - padX * 2 : w * 0.41;
    const cardH = isVertical ? h * 0.38 : h * 0.56;
    const cardX = isVertical ? padX : w * 0.52;
    const cardY = isVertical ? h * 0.42 : h * 0.22;

    roundRectPath(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = 'rgba(15, 21, 28, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const cPad = cardW * 0.075;
    const cx = cardX + cPad;
    const cy = cardY + cPad;

    ctx.font = `600 ${unit * 0.026}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText('Term 1 Competency Summary', cx, cy);

    const subjects = [
      { name: 'Mathematics', level: 'Exceeding · 94%', pct: 0.94, color: '#10B981' },
      { name: 'Integrated Science', level: 'Exceeding · 89%', pct: 0.89, color: '#10B981' },
      { name: 'English & Kiswahili', level: 'Meeting · 84%', pct: 0.84, color: '#F59E0B' },
    ];

    subjects.forEach((sub, idx) => {
      const sy = cy + unit * 0.072 + idx * unit * 0.115;
      const barProgress = easeOutExpo((localT - 0.1 - idx * 0.08) / 0.5);
      const bw = cardW - cPad * 2;

      ctx.font = `500 ${unit * 0.024}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(sub.name, cx, sy);

      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = `500 ${unit * 0.022}px "JetBrains Mono", monospace`;
      ctx.fillStyle = sub.color;
      ctx.fillText(sub.level, cx + bw, sy + 2);
      ctx.restore();

      roundRectPath(ctx, cx, sy + unit * 0.042, bw, 10, 5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();

      roundRectPath(ctx, cx, sy + unit * 0.042, bw * sub.pct * barProgress, 10, 5);
      ctx.fillStyle = sub.color;
      ctx.fill();
    });

    const pubT = easeOutCubic((localT - 0.46) / 0.35);
    ctx.globalAlpha = pubT;
    ctx.font = `500 ${unit * 0.022}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#10B981';
    ctx.fillText('480 DIGITAL TRANSCRIPTS PUBLISHED TO PARENTS', cx, cardY + cardH - cPad - unit * 0.025);

    ctx.restore();
  }

  // =========================================================================
  // STUDENTS & PARENTS SCENE 1: PAST PAPERS & KCSE / KJSEA / KCPE / CBC RESOURCES
  // =========================================================================
  else if (sceneId === 'sp-study-prep') {
    const introFade = easeOutCubic(clamp01(localT / 0.14));
    drawCoverImage(ctx, assets.studentStudy, w, h, 1.05 + localT * 0.08, -localT * 0.3, 0, 0.44 * introFade);
    const scrim = ctx.createLinearGradient(0, 0, 0, h);
    scrim.addColorStop(0, 'rgba(6, 9, 13, 0.86)');
    scrim.addColorStop(0.55, 'rgba(6, 9, 13, 0.78)');
    scrim.addColorStop(1, 'rgba(6, 9, 13, 0.96)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.textBaseline = 'top';
    const padX = w * 0.08;
    const topY = h * 0.14;
    const contentW = w - padX * 2;

    // 1. Subtle Kicker Reveal
    const kickerT = easeOutExpo(localT / 0.18);
    ctx.save();
    ctx.globalAlpha = kickerT;
    ctx.font = `600 ${unit * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#34D399';
    ctx.fillText('SHULENI.CO.KE  ·  REVISION HUB', padX, topY + (1 - kickerT) * 10);
    ctx.restore();

    // 2. Hero Header: Staggered word-by-word masked reveal ("Past" -> "Papers")
    const headerSize = isVertical ? unit * 0.13 : isSquare ? unit * 0.106 : unit * 0.116;
    const headerY = topY + unit * 0.046;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 3;
    ctx.font = `700 ${headerSize}px "Bricolage Grotesque", sans-serif`;
    drawStaggeredTokenLines(
      ctx,
      [
        { text: 'Past', color: '#FFFFFF' },
        { text: 'Papers', color: '#FFFFFF' },
      ],
      padX,
      headerY,
      contentW,
      headerSize,
      headerSize * 1.1,
      localT,
      0.04,
      0.08,
      0.24,
    );
    ctx.restore();

    // 3. Staggered Token Reveal for 'KCSE, KJSEA, KCPE & CBC Resources'
    const subSize = isVertical ? unit * 0.052 : isSquare ? unit * 0.041 : unit * 0.046;
    const subY = headerY + headerSize * 1.1;
    const subTokens: StaggerToken[] = [
      { text: 'KCSE,', color: '#FFFFFF' },
      { text: 'KJSEA,', color: '#FFFFFF' },
      { text: 'KCPE', color: '#FFFFFF' },
      { text: '&', color: '#6EE7B7' },
      { text: 'CBC', color: '#FFFFFF' },
      { text: 'Resources', color: '#A7F3D0' },
    ];
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
    ctx.shadowBlur = 14;
    ctx.font = `700 ${subSize}px "Bricolage Grotesque", sans-serif`;
    const subLineCount = drawStaggeredTokenLines(
      ctx,
      subTokens,
      padX,
      subY,
      contentW,
      subSize,
      subSize * 1.2,
      localT,
      0.16,
      0.055,
      0.22,
    );
    ctx.restore();

    // 4. Staggered Line-by-Line Description Reveal
    const descSize = isVertical ? unit * 0.031 : unit * 0.027;
    const descY = subY + subLineCount * subSize * 1.2 + unit * 0.018;
    ctx.font = `400 ${descSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#E2E8F0';
    const descLines = wrapLines(
      ctx,
      'Verified exam papers, official marking schemes & structured school notes.',
      contentW,
    );
    descLines.forEach((line, idx) => {
      drawMaskedSlideText(
        ctx,
        line,
        padX,
        descY + idx * descSize * 1.32,
        descSize,
        (localT - 0.34 - idx * 0.07) / 0.24,
        descSize * 0.65,
      );
    });

    // 5. Staggered Showcase Cards with Internal Micro-Staggered Text Reveal
    const cards = [
      {
        code: 'KCSE',
        detail: 'National Past Papers & Marking Schemes',
        accent: '#10B981',
      },
      {
        code: 'KJSEA & KCPE',
        detail: 'Primary & Junior School Revision Sets',
        accent: '#F59E0B',
      },
      {
        code: 'CBC',
        detail: 'Grades 1–9 Notes & Study Guides',
        accent: '#34D399',
      },
    ];

    const gridY = descY + descLines.length * descSize * 1.32 + unit * 0.04;

    if (isVertical) {
      const cardH = unit * 0.132;
      const gapY = unit * 0.024;
      cards.forEach((card, i) => {
        const cardDelay = 0.38 + i * 0.1;
        const cardT = easeOutExpo((localT - cardDelay) / 0.28);
        if (cardT <= 0.005) return;
        const slideY = (1 - cardT) * 20;
        const cy = gridY + i * (cardH + gapY) + slideY;

        ctx.save();
        ctx.globalAlpha = cardT;
        roundRectPath(ctx, padX, cy, contentW, cardH, 14);
        ctx.fillStyle = 'rgba(10, 15, 22, 0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        const barH = (cardH - unit * 0.044) * easeOutExpo((localT - cardDelay - 0.04) / 0.22);
        ctx.fillStyle = card.accent;
        ctx.fillRect(padX + unit * 0.024, cy + unit * 0.022, 4, barH);

        ctx.font = `700 ${unit * 0.042}px "Bricolage Grotesque", sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        drawMaskedSlideText(
          ctx,
          card.code,
          padX + unit * 0.05,
          cy + unit * 0.024,
          unit * 0.042,
          (localT - cardDelay - 0.06) / 0.22,
        );

        ctx.font = `500 ${unit * 0.025}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = '#CBD5E1';
        drawMaskedSlideText(
          ctx,
          card.detail,
          padX + unit * 0.05,
          cy + unit * 0.078,
          unit * 0.025,
          (localT - cardDelay - 0.12) / 0.22,
        );
        ctx.restore();
      });
    } else {
      const gapX = unit * 0.026;
      const cardW = (contentW - gapX * 2) / 3;
      const cardH = isSquare ? unit * 0.19 : unit * 0.215;

      cards.forEach((card, i) => {
        const cardDelay = 0.38 + i * 0.1;
        const cardT = easeOutExpo((localT - cardDelay) / 0.28);
        if (cardT <= 0.005) return;
        const slideY = (1 - cardT) * 22;
        const cx = padX + i * (cardW + gapX);
        const cy = gridY + slideY;

        ctx.save();
        ctx.globalAlpha = cardT;
        roundRectPath(ctx, cx, cy, cardW, cardH, 14);
        ctx.fillStyle = 'rgba(10, 15, 22, 0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        const innerPad = cardW * 0.095;
        const accentW = cardW * 0.28 * easeOutExpo((localT - cardDelay - 0.04) / 0.22);
        ctx.fillStyle = card.accent;
        ctx.fillRect(cx + innerPad, cy + innerPad * 0.72, accentW, 3.5);

        const codeSize = card.code.length > 6 ? unit * 0.038 : unit * 0.045;
        ctx.font = `700 ${codeSize}px "Bricolage Grotesque", sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        drawMaskedSlideText(
          ctx,
          card.code,
          cx + innerPad,
          cy + innerPad * 0.72 + unit * 0.022,
          codeSize,
          (localT - cardDelay - 0.06) / 0.22,
        );

        const detailSize = unit * 0.023;
        ctx.font = `500 ${detailSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = '#CBD5E1';
        const dLines = wrapLines(ctx, card.detail, cardW - innerPad * 2);
        dLines.forEach((dl, li) => {
          drawMaskedSlideText(
            ctx,
            dl,
            cx + innerPad,
            cy + innerPad * 0.72 + unit * 0.082 + li * unit * 0.032,
            detailSize,
            (localT - cardDelay - 0.12 - li * 0.05) / 0.22,
          );
        });
        ctx.restore();
      });
    }

    ctx.restore();
  }

  // =========================================================================
  // STUDENTS & PARENTS SCENE 2: BRAND REVEAL
  // =========================================================================
  else if (sceneId === 'sp-brand-reveal') {
    drawCoverImage(ctx, assets.studentStudy, w, h, 1.14 - localT * 0.05, 0.2, -0.1, 0.18);
    drawSubtleGrid(ctx, w, h, 0.045);

    const aura = ctx.createRadialGradient(w * 0.5, h * 0.44, 10, w * 0.5, h * 0.44, unit * 0.68);
    aura.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
    aura.addColorStop(0.55, 'rgba(16, 185, 129, 0.06)');
    aura.addColorStop(1, 'rgba(9, 13, 17, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);

    const markSize = unit * 0.19;
    const markY = isVertical ? h * 0.34 : h * 0.33;
    drawShuleniMark(ctx, w * 0.5, markY, markSize, localT / 0.5);

    const wordT = easeOutExpo((localT - 0.14) / 0.42);
    ctx.save();
    ctx.globalAlpha = wordT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const brandSize = isVertical ? unit * 0.115 : unit * 0.11;
    ctx.font = `700 ${brandSize}px "Bricolage Grotesque", sans-serif`;
    const brandY = markY + markSize * 0.64 + (1 - wordT) * 20;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(config.ctaUrl, w * 0.5, brandY);

    const lineW = Math.min(w * 0.42, unit * 0.42) * easeOutExpo((localT - 0.26) / 0.38);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(w * 0.5 - lineW * 0.5, brandY + brandSize * 1.12, lineW, 3);

    const tagT = easeOutCubic((localT - 0.3) / 0.38);
    ctx.globalAlpha = tagT;
    const tagSize = isVertical ? unit * 0.044 : unit * 0.038;
    ctx.font = `500 ${tagSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#CBD5E1';
    const tagLines = wrapLines(ctx, config.headline, w * 0.78);
    tagLines.forEach((line, i) => {
      ctx.fillText(line, w * 0.5, brandY + brandSize * 1.28 + i * tagSize * 1.3);
    });
    ctx.restore();
  }

  // =========================================================================
  // STUDENTS & PARENTS SCENE 3: VERIFIED PAST PAPERS LIBRARY
  // =========================================================================
  else if (sceneId === 'sp-past-papers') {
    drawSubtleGrid(ctx, w, h, 0.045);
    const glow = ctx.createRadialGradient(w * 0.72, h * 0.38, 10, w * 0.72, h * 0.38, unit * 0.7);
    glow.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
    glow.addColorStop(1, 'rgba(9, 13, 17, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const padX = w * 0.075;
    const enter = easeOutExpo(localT / 0.32);

    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textBaseline = 'top';

    const kickerY = isVertical ? h * 0.12 : h * 0.16;
    ctx.font = `500 ${unit * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#10B981';
    ctx.fillText('01  KCSE · KJSEA · CBC ARCHIVE', padX, kickerY);

    const headingSize = isVertical ? unit * 0.074 : unit * 0.062;
    ctx.font = `700 ${headingSize}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    const maxCopyW = isVertical ? w - padX * 2 : w * 0.42;
    const hLines = wrapLines(ctx, 'Thousands of past papers, ready to revise.', maxCopyW);
    hLines.forEach((line, i) => {
      ctx.fillText(line, padX, kickerY + unit * 0.045 + i * headingSize * 1.12);
    });

    const bodyY = kickerY + unit * 0.045 + hLines.length * headingSize * 1.12 + unit * 0.028;
    ctx.font = `400 ${unit * 0.028}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#94A3B8';
    const bLines = wrapLines(
      ctx,
      'Download national exams, mock series, and step-by-step marking schemes sorted by grade and subject.',
      maxCopyW,
    );
    bLines.forEach((line, i) => {
      ctx.fillText(line, padX, bodyY + i * unit * 0.04);
    });

    // Animated Past Papers Library Card
    const cardW = isVertical ? w - padX * 2 : w * 0.43;
    const cardH = isVertical ? h * 0.38 : h * 0.62;
    const cardX = isVertical ? padX : w * 0.51;
    const cardY = isVertical ? h * 0.43 : h * 0.19;
    const cardSlide = (1 - easeOutExpo(localT / 0.42)) * 28;

    roundRectPath(ctx, cardX, cardY + cardSlide, cardW, cardH, 18);
    ctx.fillStyle = '#121820';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const innerPad = cardW * 0.07;
    const cx = cardX + innerPad;
    const cy = cardY + cardSlide + innerPad;
    const bw = cardW - innerPad * 2;

    ctx.font = `500 ${unit * 0.022}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('VERIFIED PAST PAPERS & MARKING SCHEMES', cx, cy);

    const paperCount = Math.round(1200 + 2640 * easeOutCubic((localT - 0.08) / 0.55));
    ctx.font = `700 ${unit * 0.056}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(`${paperCount.toLocaleString()}+ Exam Sets`, cx, cy + unit * 0.04);

    const papers = [
      { title: 'KCSE Mathematics Paper 1', meta: '2024 · With Marking Scheme' },
      { title: 'Biology & Chemistry Practicals', meta: 'Form 3–4 · Step-by-Step Guide' },
      { title: 'Grade 8 CBC Integrated Science', meta: 'Term 1–3 · Assessment Rubrics' },
    ];

    papers.forEach((p, idx) => {
      const itemT = easeOutExpo((localT - 0.18 - idx * 0.12) / 0.34);
      if (itemT <= 0) return;
      const py = cy + unit * 0.135 + idx * unit * 0.122 + (1 - itemT) * 18;
      ctx.save();
      ctx.globalAlpha = itemT;
      roundRectPath(ctx, cx, py, bw, unit * 0.1, 12);
      ctx.fillStyle = idx === 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = idx === 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.font = `600 ${unit * 0.025}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(p.title, cx + unit * 0.024, py + unit * 0.018);

      ctx.font = `500 ${unit * 0.021}px "JetBrains Mono", monospace`;
      ctx.fillStyle = idx === 0 ? '#10B981' : '#94A3B8';
      ctx.fillText(p.meta, cx + unit * 0.024, py + unit * 0.058);
      ctx.restore();
    });

    ctx.restore();
  }

  // =========================================================================
  // STUDENTS & PARENTS SCENE 4: SCHOOL STUDY RESOURCES
  // =========================================================================
  else if (sceneId === 'sp-resources') {
    drawCoverImage(ctx, assets.classroomTech, w, h, 1.05 + localT * 0.06, -0.2, 0.05, 0.4);
    const scrim = ctx.createLinearGradient(0, 0, w, 0);
    scrim.addColorStop(0, 'rgba(6, 9, 13, 0.95)');
    scrim.addColorStop(0.58, 'rgba(6, 9, 13, 0.82)');
    scrim.addColorStop(1, 'rgba(6, 9, 13, 0.56)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    const padX = w * 0.075;
    const enter = easeOutExpo(localT / 0.32);

    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textBaseline = 'top';

    const topY = isVertical ? h * 0.12 : h * 0.16;
    ctx.font = `500 ${unit * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#FBBF24';
    ctx.fillText('02  CURATED SCHOOL RESOURCES', padX, topY);

    const titleSize = isVertical ? unit * 0.072 : unit * 0.062;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
    ctx.font = `700 ${titleSize}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    const maxCopyW = isVertical ? w - padX * 2 : w * 0.44;
    const lines = wrapLines(ctx, 'Structured notes & revision kits for every grade.', maxCopyW);
    lines.forEach((line, i) => {
      ctx.fillText(line, padX, topY + unit * 0.045 + i * titleSize * 1.12);
    });
    ctx.restore();

    const cardW = isVertical ? w - padX * 2 : w * 0.41;
    const cardH = isVertical ? h * 0.38 : h * 0.56;
    const cardX = isVertical ? padX : w * 0.52;
    const cardY = isVertical ? h * 0.42 : h * 0.22;

    roundRectPath(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = 'rgba(15, 21, 28, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const cPad = cardW * 0.075;
    const cx = cardX + cPad;
    const cy = cardY + cPad;
    const bw = cardW - cPad * 2;

    ctx.font = `600 ${unit * 0.026}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText('Student & Parent Resource Pack', cx, cy);

    const packs = [
      { label: 'Topic Summaries & Formulas', count: '4,200+ Guides', pct: 0.92, color: '#10B981' },
      { label: 'CBC Holiday & Home Projects', count: 'Grades 1–9', pct: 0.86, color: '#F59E0B' },
      { label: 'Topical Practice Quizzes', count: 'Instant Feedback', pct: 0.95, color: '#10B981' },
    ];

    packs.forEach((pk, idx) => {
      const sy = cy + unit * 0.072 + idx * unit * 0.115;
      const barP = easeOutExpo((localT - 0.12 - idx * 0.08) / 0.48);

      ctx.font = `500 ${unit * 0.024}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(pk.label, cx, sy);

      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = `500 ${unit * 0.021}px "JetBrains Mono", monospace`;
      ctx.fillStyle = pk.color;
      ctx.fillText(pk.count, cx + bw, sy + 2);
      ctx.restore();

      roundRectPath(ctx, cx, sy + unit * 0.042, bw, 10, 5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();

      roundRectPath(ctx, cx, sy + unit * 0.042, bw * pk.pct * barP, 10, 5);
      ctx.fillStyle = pk.color;
      ctx.fill();
    });

    const readyT = easeOutCubic((localT - 0.45) / 0.35);
    ctx.globalAlpha = readyT;
    ctx.font = `500 ${unit * 0.021}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#10B981';
    ctx.fillText('SYNCED FOR PHONE, TABLET & HOME REVISION', cx, cardY + cardH - cPad - unit * 0.025);

    ctx.restore();
  }

  // =========================================================================
  // STUDENTS & PARENTS SCENE 5: 24/7 SHULENI AI STUDY ASSISTANT
  // =========================================================================
  else if (sceneId === 'sp-ai-assistant') {
    drawCoverImage(ctx, assets.parentMobile, w, h, 1.05 + localT * 0.06, 0.25, -0.1, 0.38);
    const scrim = ctx.createLinearGradient(0, 0, w, 0);
    scrim.addColorStop(0, 'rgba(6, 9, 13, 0.95)');
    scrim.addColorStop(0.6, 'rgba(6, 9, 13, 0.85)');
    scrim.addColorStop(1, 'rgba(6, 9, 13, 0.6)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    const padX = w * 0.075;
    const enter = easeOutExpo(localT / 0.32);

    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textBaseline = 'top';

    const topY = isVertical ? h * 0.11 : h * 0.16;
    ctx.font = `500 ${unit * 0.024}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#34D399';
    ctx.fillText('03  SHULENI AI STUDY ASSISTANT', padX, topY);

    const titleSize = isVertical ? unit * 0.072 : unit * 0.06;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
    ctx.font = `700 ${titleSize}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    const maxCopyW = isVertical ? w - padX * 2 : w * 0.41;
    const lines = wrapLines(ctx, 'Stuck on a past paper? Ask Shuleni AI.', maxCopyW);
    lines.forEach((line, i) => {
      ctx.fillText(line, padX, topY + unit * 0.045 + i * titleSize * 1.12);
    });
    ctx.restore();

    const subY = topY + unit * 0.045 + lines.length * titleSize * 1.12 + unit * 0.025;
    ctx.font = `400 ${unit * 0.027}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#CBD5E1';
    const bLines = wrapLines(
      ctx,
      'Clear step-by-step explanations aligned to Kenyan marking schemes—anytime you revise.',
      maxCopyW,
    );
    bLines.forEach((line, i) => {
      ctx.fillText(line, padX, subY + i * unit * 0.038);
    });

    // Animated AI Assistant Chat Card
    const cardW = isVertical ? w - padX * 2 : w * 0.44;
    const cardH = isVertical ? h * 0.41 : h * 0.64;
    const cardX = isVertical ? padX : w * 0.50;
    const cardY = isVertical ? h * 0.42 : h * 0.18;

    roundRectPath(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fillStyle = 'rgba(15, 22, 29, 0.94)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const cPad = cardW * 0.065;
    const cx = cardX + cPad;
    const cy = cardY + cPad;
    const bw = cardW - cPad * 2;

    ctx.font = `600 ${unit * 0.022}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#10B981';
    ctx.fillText('SHULENI AI TUTOR · FORM 3 MATHEMATICS', cx, cy);

    // Student prompt bubble
    const qAppear = easeOutExpo((localT - 0.08) / 0.25);
    if (qAppear > 0) {
      ctx.save();
      ctx.globalAlpha = qAppear;
      const qy = cy + unit * 0.045;
      const qh = unit * 0.11;
      roundRectPath(ctx, cx, qy, bw, qh, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.fill();

      ctx.font = `500 ${unit * 0.024}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#F8FAFC';
      const qLines = wrapLines(
        ctx,
        '“How do I solve x² + 6x − 7 = 0 using the marking scheme steps?”',
        bw - unit * 0.04,
      );
      qLines.forEach((l, i) => {
        ctx.fillText(l, cx + unit * 0.02, qy + unit * 0.018 + i * unit * 0.034);
      });
      ctx.restore();
    }

    // AI Response Steps revealing sequentially
    const steps = [
      'Step 1 (M1): Move constant → x² + 6x = 7',
      'Step 2 (M1): Add (6/2)² = 9 → (x + 3)² = 16',
      'Step 3 (A1): x = −3 ± 4 → x = 1 or x = −7',
    ];
    const respY = cy + unit * 0.185;
    roundRectPath(ctx, cx, respY, bw, cardH - cPad * 2 - unit * 0.185, 12);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.09)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    steps.forEach((stepText, idx) => {
      const st = easeOutCubic((localT - 0.28 - idx * 0.14) / 0.26);
      if (st <= 0) return;
      ctx.save();
      ctx.globalAlpha = st;
      ctx.font = `500 ${unit * 0.023}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = idx === 2 ? '#A7F3D0' : '#ECFDF5';
      ctx.fillText(stepText, cx + unit * 0.022, respY + unit * 0.026 + idx * unit * 0.056);
      ctx.restore();
    });

    ctx.restore();
  }

  // =========================================================================
  // SCENE 6: LAUNCH CALL TO ACTION (SHARED CLEAN END CARD)
  // =========================================================================
  else {
    drawSubtleGrid(ctx, w, h, 0.045);

    const ringAlpha = easeOutExpo(localT / 0.45);
    const centerY = h * 0.46;
    [0.28, 0.44, 0.62].forEach((rFrac, i) => {
      ctx.save();
      ctx.strokeStyle = `rgba(16, 185, 129, ${(0.22 - i * 0.05) * ringAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(w * 0.5, centerY, unit * rFrac * (0.9 + localT * 0.12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    const glow = ctx.createRadialGradient(w * 0.5, centerY, 10, w * 0.5, centerY, unit * 0.65);
    glow.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
    glow.addColorStop(1, 'rgba(9, 13, 17, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const enter = easeOutExpo(localT / 0.4);
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const markSize = unit * 0.14;
    const markY = isVertical ? h * 0.25 : h * 0.22;
    drawShuleniMark(ctx, w * 0.5, markY, markSize, 1);

    ctx.font = `500 ${unit * 0.025}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(config.launchNotice.toUpperCase(), w * 0.5, markY + markSize * 0.64);

    const urlSize = isVertical ? unit * 0.115 : unit * 0.115;
    ctx.font = `700 ${urlSize}px "Bricolage Grotesque", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    const urlY = markY + markSize * 0.64 + unit * 0.048;
    ctx.fillText(config.ctaUrl, w * 0.5, urlY);

    const subSize = isVertical ? unit * 0.036 : unit * 0.032;
    ctx.font = `400 ${subSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#CBD5E1';
    const subLines = wrapLines(ctx, config.subheadline, w * 0.76);
    const subY = urlY + urlSize * 1.18;
    subLines.forEach((line, i) => {
      ctx.fillText(line, w * 0.5, subY + i * subSize * 1.35);
    });

    const ctaT = easeOutExpo((localT - 0.18) / 0.38);
    const btnW = Math.min(w * 0.7, unit * 0.58);
    const btnH = unit * 0.085;
    const btnX = w * 0.5 - btnW * 0.5;
    const btnY = subY + subLines.length * subSize * 1.35 + unit * 0.045 + (1 - ctaT) * 14;

    roundRectPath(ctx, btnX, btnY, btnW, btnH, 12);
    ctx.fillStyle = '#10B981';
    ctx.fill();

    ctx.font = `700 ${unit * 0.029}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#052E16';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.ctaLabel, w * 0.5, btnY + btnH * 0.5);

    ctx.restore();
  }
}

export function renderAdFrame(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  config: AdConfig,
  assets: LoadedAdAssets,
) {
  const { width: w, height: h } = ASPECT_DIMENSIONS[config.aspectRatio];
  const durationSec = config.cut === '30s' ? 30 : 45;
  const frac = clamp01(timeSec / durationSec);
  const isVertical = config.aspectRatio === '9:16';
  const unit = Math.min(w, h);
  const scenes = getScenesForCampaign(config.campaign);

  ctx.clearRect(0, 0, w, h);

  const activeIndex = Math.max(
    0,
    scenes.findIndex((s) => frac >= s.startFrac && frac < s.endFrac),
  );
  const currentIdx = frac >= 1 ? scenes.length - 1 : activeIndex;
  const activeScene = scenes[currentIdx];

  // Smooth cross-dissolve half-window around every scene boundary (~1.2s total blend)
  const halfOverlap = 0.022;

  let baseSceneIdx = currentIdx;
  let nextSceneIdx: number | null = null;
  let crossProgress = 0;

  if (currentIdx < scenes.length - 1 && frac > activeScene.endFrac - halfOverlap) {
    baseSceneIdx = currentIdx;
    nextSceneIdx = currentIdx + 1;
    crossProgress = easeInOutCubic((frac - (activeScene.endFrac - halfOverlap)) / (halfOverlap * 2));
  } else if (currentIdx > 0 && frac < activeScene.startFrac + halfOverlap) {
    baseSceneIdx = currentIdx - 1;
    nextSceneIdx = currentIdx;
    crossProgress = easeInOutCubic((frac - (activeScene.startFrac - halfOverlap)) / (halfOverlap * 2));
  }

  const baseScene = scenes[baseSceneIdx];
  const baseSpan = baseScene.endFrac - baseScene.startFrac;
  const baseLocalT = clamp01((frac - baseScene.startFrac) / baseSpan);

  // Draw base scene directly onto main canvas
  renderSceneContent(ctx, baseScene.id, baseLocalT, w, h, config, assets);

  const isEndCard = (id: string) => id === 'launch-cta' || id === 'sp-launch-cta';

  // During cross-dissolve window, composite the incoming scene smoothly via scratch canvas
  let subtitleText = activeScene.subtitle;
  let subtitleAlpha = 1;
  let showSub = config.showSubtitles && !isEndCard(activeScene.id);

  if (nextSceneIdx !== null && crossProgress > 0.001) {
    const incoming = scenes[nextSceneIdx];
    const incSpan = incoming.endFrac - incoming.startFrac;
    const incLocalT = clamp01((frac - incoming.startFrac) / incSpan);
    const scratch = getScratchCanvas(w, h);
    const sCtx = scratch?.getContext('2d');

    if (scratch && sCtx) {
      sCtx.clearRect(0, 0, w, h);
      renderSceneContent(sCtx, incoming.id, incLocalT, w, h, config, assets);

      ctx.save();
      ctx.globalAlpha = crossProgress;
      const scale = 1.02 - 0.02 * crossProgress;
      const dx = w * (1 - scale) * 0.5;
      const dy = h * (1 - scale) * 0.5;
      ctx.drawImage(scratch, dx, dy, w * scale, h * scale);
      ctx.restore();
    }

    if (crossProgress < 0.5) {
      subtitleText = baseScene.subtitle;
      subtitleAlpha = 1 - crossProgress * 2;
      showSub = config.showSubtitles && !isEndCard(baseScene.id);
    } else {
      subtitleText = incoming.subtitle;
      subtitleAlpha = (crossProgress - 0.5) * 2;
      showSub = config.showSubtitles && !isEndCard(incoming.id);
    }
  }

  if (showSub && subtitleAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha = subtitleAlpha;
    const fontSize = isVertical ? unit * 0.03 : unit * 0.025;
    ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    const maxBoxW = w * 0.88;
    const subLines = wrapLines(ctx, subtitleText, maxBoxW - unit * 0.06);
    const maxLineW = Math.max(...subLines.map((l) => ctx.measureText(l).width));
    const boxW = Math.min(maxBoxW, maxLineW + unit * 0.06);
    const lineH = fontSize * 1.38;
    const boxH = subLines.length * lineH + fontSize * 0.85;
    const px = w * 0.5 - boxW * 0.5;
    const py = h - boxH - unit * 0.04;

    roundRectPath(ctx, px, py, boxW, boxH, 10);
    ctx.fillStyle = 'rgba(6, 9, 13, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    const firstY = py + boxH * 0.5 - ((subLines.length - 1) * lineH) * 0.5;
    subLines.forEach((l, i) => {
      ctx.fillText(l, w * 0.5, firstY + i * lineH);
    });
    ctx.restore();
  }
}
