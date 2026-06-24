import { TestResult } from '../types';

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gapAfter?: number;
  indent?: number;
  keepWithNext?: number;
  pageBreakBefore?: boolean;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const FOOTER_Y = 34;
const CONTENT_WIDTH = 82;

function cleanFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'student';
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E\n]/g, '');
}

function wrapText(text: string, maxChars = CONTENT_WIDTH) {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

function lineHeight(size: number) {
  return Math.max(15, size + 5);
}

function addPageHeader(pageCommands: string[], pageNumber: number) {
  pageCommands.push(`0.94 0.97 1 rg 0 ${PAGE_HEIGHT - 92} ${PAGE_WIDTH} 92 re f`);
  pageCommands.push(`0.18 0.31 0.55 RG 0.8 w ${MARGIN} ${PAGE_HEIGHT - 105} m ${PAGE_WIDTH - MARGIN} ${PAGE_HEIGHT - 105} l S`);
  pageCommands.push(`BT /F2 9 Tf ${MARGIN} ${FOOTER_Y} Td (Tutor Diagnostic) Tj ET`);
  pageCommands.push(`BT /F1 9 Tf ${PAGE_WIDTH - MARGIN - 48} ${FOOTER_Y} Td (Page ${pageNumber}) Tj ET`);
}

function buildPdfFromPages(pages: string[][]) {
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);

  pages.forEach((pageCommands, i) => {
    const pageObjectId = 3 + i * 2;
    const contentObjectId = pageObjectId + 1;
    const stream = pageCommands.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function buildPdf(lines: PdfLine[]) {
  const pages: string[][] = [[]];
  addPageHeader(pages[0], 1);
  let y = PAGE_HEIGHT - MARGIN - 8;

  const addPage = () => {
    pages.push([]);
    addPageHeader(pages[pages.length - 1], pages.length);
    y = PAGE_HEIGHT - MARGIN - 8;
  };

  const remainingLineSlots = () => Math.floor((y - MARGIN) / 15);

  const addCommand = (command: string, currentLineHeight: number, gapAfter = 0) => {
    if (y < MARGIN + currentLineHeight) {
      addPage();
    }
    pages[pages.length - 1].push(command);
    y -= currentLineHeight + gapAfter;
  };

  lines.forEach((line, index) => {
    const font = line.bold ? 'F2' : 'F1';
    const size = line.size ?? 11;
    const indent = line.indent ?? 0;
    const maxChars = size >= 18 ? 48 : Math.max(48, CONTENT_WIDTH - Math.round(indent / 5));
    const wrapped = wrapText(line.text, maxChars);
    const currentLineHeight = lineHeight(size);
    const requiredSlots = wrapped.length + (line.keepWithNext ?? 0);

    if (line.pageBreakBefore || (requiredSlots <= 42 && remainingLineSlots() < requiredSlots)) {
      addPage();
    }

    if (!line.text.trim()) {
      y -= line.gapAfter ?? 8;
      return;
    }

    wrapped.forEach((textLine, wrappedIndex) => {
      const x = MARGIN + indent;
      const gapAfter = wrappedIndex === wrapped.length - 1 ? line.gapAfter ?? 0 : 0;
      addCommand(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(textLine)}) Tj ET`, currentLineHeight, gapAfter);
    });

    if (index < lines.length - 1 && line.size && line.size >= 15) {
      y -= 2;
    }
  });

  return buildPdfFromPages(pages);
}

function downloadPdf(filename: string, lines: PdfLine[]) {
  const blob = new Blob([buildPdf(lines)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadPdfFromPages(filename: string, pages: string[][]) {
  const blob = new Blob([buildPdfFromPages(pages)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function metadata(result: TestResult): PdfLine[] {
  return [
    { text: result.studentFullName, size: 20, bold: true, gapAfter: 4 },
    { text: `${result.testTitle} (${result.testLevel})`, size: 12, gapAfter: 4 },
    { text: `Completed: ${new Date(result.completedAt).toLocaleString()}`, size: 10, gapAfter: 10 },
    { text: `Score: ${result.score}/${result.totalQuestions} (${result.percentage}%)`, size: 13, bold: true, gapAfter: 10 },
  ];
}

function statusLabel(status: string) {
  if (status === 'secure') return 'Secure';
  if (status === 'developing') return 'Developing';
  return 'Needs support';
}

function reportOverview(result: TestResult) {
  if (result.percentage >= 80) {
    return `${result.studentFirstName} has shown secure understanding across much of this diagnostic. The result gives a useful snapshot of what is already working well and where we can now extend fluency, confidence, and problem-solving depth.`;
  }

  if (result.percentage >= 60) {
    return `${result.studentFirstName} has shown a developing understanding of the content assessed. The diagnostic gives a helpful picture of the skills that are becoming secure, as well as the areas where focused practice should make the biggest difference.`;
  }

  return `${result.studentFirstName} has completed the diagnostic, giving us a clear starting point for future lessons. This result should be seen as a baseline, helping us plan support carefully rather than as a final judgement of ability.`;
}

function scoreSnapshot(result: TestResult) {
  return `${result.score}/${result.totalQuestions} correct (${result.percentage}%). This shows which skills are currently secure and which topics need more guided practice before the next stage of learning.`;
}

function strongestTopics(result: TestResult) {
  const secure = result.topicBreakdown.filter(topic => topic.status === 'secure');
  const developing = result.topicBreakdown.filter(topic => topic.status === 'developing');

  if (secure.length) {
    return secure.map(topic => `${topic.topic}: ${topic.percentage}% (${topic.correct}/${topic.total}), showing this area is currently secure and can be revisited through mixed practice.`);
  }

  if (developing.length) {
    return developing.map(topic => `${topic.topic}: developing at ${topic.percentage}% (${topic.correct}/${topic.total}), showing useful foundations that can be strengthened with practice.`);
  }

  return ['Completing the diagnostic provides a useful baseline and identifies exactly where support should begin.'];
}

function focusTopics(result: TestResult) {
  const weak = result.topicBreakdown.filter(topic => topic.status === 'weak');
  const developing = result.topicBreakdown.filter(topic => topic.status === 'developing');
  const topics = [...weak, ...developing];

  if (topics.length) {
    return topics.map(topic => `${topic.topic}: ${statusLabel(topic.status)} (${topic.percentage}%, ${topic.correct}/${topic.total}). This should be prioritised so the underlying method becomes more confident and reliable.`);
  }

  return ['No major weak areas were identified in this diagnostic. Continue with extension, mixed practice, and fluency checks.'];
}

function bullet(text: string): PdfLine {
  return { text: `- ${text}`, indent: 12, gapAfter: 3 };
}

function rgb(hex: string) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function fillRect(commands: string[], x: number, y: number, width: number, height: number, color: string) {
  commands.push(`${rgb(color)} rg ${x} ${y} ${width} ${height} re f`);
}

function strokeRect(commands: string[], x: number, y: number, width: number, height: number, color = '#d6dee5', lineWidth = 1) {
  commands.push(`${rgb(color)} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S`);
}

function drawText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  options: { size?: number; bold?: boolean; color?: string } = {}
) {
  const size = options.size ?? 10;
  const font = options.bold ? 'F2' : 'F1';
  const color = options.color ?? '#172033';
  commands.push(`${rgb(color)} rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`);
}

function drawWrappedText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  maxChars: number,
  options: { size?: number; bold?: boolean; color?: string; leading?: number; maxLines?: number } = {}
) {
  const size = options.size ?? 9;
  const leading = options.leading ?? 13;
  const wrapped = wrapText(text, maxChars).slice(0, options.maxLines ?? 20);
  wrapped.forEach((line, index) => drawText(commands, line, x, y - index * leading, { ...options, size }));
  return y - wrapped.length * leading;
}

function drawSection(
  commands: string[],
  title: string,
  body: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  options: { maxLinesPerItem?: number; itemLimit?: number; fontSize?: number; leading?: number } = {}
) {
  fillRect(commands, x, y - height, width, height, '#f4f8f8');
  strokeRect(commands, x, y - height, width, height, '#dce7e7');
  drawText(commands, title, x + 12, y - 20, { size: 10, bold: true, color: '#172033' });
  commands.push(`${rgb('#c8d5d5')} RG 0.8 w ${x + 12} ${y - 28} m ${x + width - 12} ${y - 28} l S`);
  let textY = y - 44;
  const maxLines = options.maxLinesPerItem ?? 2;
  const fontSize = options.fontSize ?? 7.6;
  const leading = options.leading ?? 9.4;
  const bottomLimit = y - height + 18;

  body.slice(0, options.itemLimit ?? body.length).forEach(item => {
    if (textY < bottomLimit + leading) return;
    drawText(commands, '-', x + 13, textY, { size: 8, bold: true, color: '#0f6b73' });
    textY = drawWrappedText(commands, item, x + 24, textY, Math.max(26, Math.floor(width / 6.1)), { size: fontSize, leading, maxLines });
    textY -= 4;
  });
}

function drawMetricCard(commands: string[], label: string, value: string, x: number, y: number, width: number, height: number) {
  fillRect(commands, x, y - height, width, height, '#eef6f5');
  strokeRect(commands, x, y - height, width, height, '#dce7e7');
  fillRect(commands, x + 10, y - 35, 26, 26, '#126b73');
  drawText(commands, label, x + 44, y - 22, { size: 8, color: '#334155' });
  drawText(commands, value, x + 44, y - 42, { size: 15, bold: true, color: '#0f172a' });
}

function drawCompactMetric(commands: string[], label: string, value: string, x: number, y: number, width: number) {
  fillRect(commands, x, y - 42, width, 42, '#f7fbfb');
  strokeRect(commands, x, y - 42, width, 42, '#cfdada');
  drawText(commands, label, x + 12, y - 15, { size: 7.5, color: '#64748b' });
  drawText(commands, value, x + 12, y - 31, { size: 13, bold: true, color: '#172033' });
}

function drawTopicPerformance(commands: string[], result: TestResult, x: number, y: number, width: number, height: number) {
  fillRect(commands, x, y - height, width, height, '#f4f8f8');
  strokeRect(commands, x, y - height, width, height, '#dce7e7');
  drawText(commands, 'Topic performance', x + 12, y - 20, { size: 10, bold: true, color: '#172033' });
  commands.push(`${rgb('#c8d5d5')} RG 0.8 w ${x + 12} ${y - 28} m ${x + width - 12} ${y - 28} l S`);

  const topics = [...result.topicBreakdown]
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 5);

  let rowY = y - 48;
  topics.forEach(topic => {
    const label = topic.topic.length > 24 ? `${topic.topic.slice(0, 22)}...` : topic.topic;
    const barWidth = width - 126;
    const filled = Math.max(4, (barWidth * topic.percentage) / 100);
    const color = topic.status === 'secure' ? '#2f9e75' : topic.status === 'developing' ? '#d89b2b' : '#c94a4a';
    drawText(commands, label, x + 12, rowY, { size: 7.5, color: '#334155' });
    fillRect(commands, x + 96, rowY - 6, barWidth, 7, '#dde7e7');
    fillRect(commands, x + 96, rowY - 6, filled, 7, color);
    drawText(commands, `${topic.percentage}%`, x + width - 32, rowY, { size: 7.5, bold: true, color });
    rowY -= 18;
  });
}

function drawMiniDonut(commands: string[], result: TestResult, cx: number, cy: number) {
  const secure = result.topicBreakdown.filter(topic => topic.status === 'secure').length;
  const developing = result.topicBreakdown.filter(topic => topic.status === 'developing').length;
  const weak = result.topicBreakdown.filter(topic => topic.status === 'weak').length;
  const total = Math.max(1, secure + developing + weak);
  const sizes = [
    { label: 'Secure', value: secure, color: '#2f9e75' },
    { label: 'Developing', value: developing, color: '#d89b2b' },
    { label: 'Support', value: weak, color: '#c94a4a' },
  ];
  let currentX = cx - 58;
  sizes.forEach(item => {
    const width = Math.max(10, (116 * item.value) / total);
    fillRect(commands, currentX, cy, width, 10, item.color);
    currentX += width;
  });
  strokeRect(commands, cx - 58, cy, 116, 10, '#ffffff', 0.5);
  sizes.forEach((item, index) => {
    const legendX = cx - 58 + index * 44;
    fillRect(commands, legendX, cy - 17, 6, 6, item.color);
    drawText(commands, `${item.value}`, legendX + 9, cy - 12, { size: 7, bold: true, color: '#334155' });
  });
}

function drawTargetsBox(
  commands: string[],
  title: string,
  targets: string[],
  startIndex: number,
  x: number,
  y: number,
  width: number,
  height: number
) {
  fillRect(commands, x, y - height, width, height, '#f4f8f8');
  strokeRect(commands, x, y - height, width, height, '#dce7e7');
  drawText(commands, title, x + 12, y - 20, { size: 10, bold: true, color: '#172033' });
  commands.push(`${rgb('#c8d5d5')} RG 0.8 w ${x + 12} ${y - 28} m ${x + width - 12} ${y - 28} l S`);

  let textY = y - 48;
  let index = startIndex;
  const bottomLimit = y - height + 20;

  while (index < targets.length && textY > bottomLimit + 18) {
    drawText(commands, `${index + 1}.`, x + 14, textY, { size: 8.5, bold: true, color: '#126b73' });
    const nextY = drawWrappedText(commands, targets[index], x + 36, textY, 72, {
      size: 7.8,
      leading: 9.5,
      maxLines: 2,
    });
    textY = nextY - 8;
    index += 1;
  }

  return index;
}

function dashboardFooter(commands: string[], pageNumber: number) {
  drawText(commands, 'Tutor Diagnostic', 32, 28, { size: 8, bold: true, color: '#64748b' });
  drawText(commands, `Page ${pageNumber}`, PAGE_WIDTH - 72, 28, { size: 8, color: '#64748b' });
}

function buildDiagnosticReportDashboardPdf(result: TestResult) {
  const pages: string[][] = [[]];
  const page = pages[0];
  const strengths = strongestTopics(result).slice(0, 3);
  const focusAreas = focusTopics(result).slice(0, 3);
  const targets = result.suggestedTargets.length ? result.suggestedTargets : ['No major targets identified.'];
  const secureCount = result.topicBreakdown.filter(topic => topic.status === 'secure').length;
  const developingCount = result.topicBreakdown.filter(topic => topic.status === 'developing').length;
  const weakCount = result.topicBreakdown.filter(topic => topic.status === 'weak').length;

  fillRect(page, 24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48, '#fbfcfd');
  strokeRect(page, 24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48, '#d8dee6', 1.2);
  fillRect(page, 24, PAGE_HEIGHT - 136, PAGE_WIDTH - 48, 112, '#173d62');
  fillRect(page, 24, PAGE_HEIGHT - 136, PAGE_WIDTH - 48, 8, '#126b73');
  fillRect(page, 462, PAGE_HEIGHT - 106, 38, 48, '#eef6f5');
  drawText(page, 'TD', 474, 756, { size: 12, bold: true, color: '#173d62' });

  drawText(page, 'Diagnostic report', 56, 758, { size: 24, bold: true, color: '#ffffff' });
  drawText(page, 'Performance summary and lesson targets', 56, 734, { size: 10, color: '#d9f3f3' });
  drawText(page, result.studentFullName, 318, 760, { size: 13, bold: true, color: '#ffffff' });
  drawText(page, result.testLevel, 318, 742, { size: 9, bold: true, color: '#d9f3f3' });
  drawText(page, result.testTitle, 318, 728, { size: 8, color: '#d9f3f3' });
  drawText(page, new Date(result.completedAt).toLocaleDateString(), 318, 716, { size: 8, color: '#ffffff' });

  drawCompactMetric(page, 'Score', `${result.score}/${result.totalQuestions}`, 56, 674, 96);
  drawCompactMetric(page, 'Percentage', `${result.percentage}%`, 164, 674, 96);
  drawCompactMetric(page, 'Secure', `${secureCount}`, 272, 674, 70);
  drawCompactMetric(page, 'Developing', `${developingCount}`, 354, 674, 70);
  drawCompactMetric(page, 'Support', `${weakCount}`, 436, 674, 64);

  drawSection(page, 'Strengths', strengths, 56, 606, 444, 122, {
    itemLimit: 3,
    maxLinesPerItem: 2,
    fontSize: 7.8,
    leading: 9.8,
  });
  let nextTargetIndex = drawTargetsBox(page, 'Targets', targets, 0, 56, 462, 444, 344);
  dashboardFooter(page, 1);

  while (nextTargetIndex < targets.length) {
    const secondPage: string[] = [];
    pages.push(secondPage);
    fillRect(secondPage, 24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48, '#ffffff');
    strokeRect(secondPage, 24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48, '#d8dee6', 1.2);
    fillRect(secondPage, 24, PAGE_HEIGHT - 132, PAGE_WIDTH - 48, 108, '#126b73');
    drawText(secondPage, 'Targets continued', 56, 742, { size: 24, bold: true, color: '#ffffff' });
    drawText(secondPage, 'Full target list for planning future lessons', 56, 712, { size: 10, color: '#d9f3f3' });
    nextTargetIndex = drawTargetsBox(secondPage, 'Targets', targets, nextTargetIndex, 56, 660, 444, 560);
    dashboardFooter(secondPage, pages.length);
  }

  return pages;
}

export function downloadDiagnosticReportPdf(result: TestResult) {
  downloadPdfFromPages(
    `${cleanFilename(result.studentFullName)}-diagnostic-report.pdf`,
    buildDiagnosticReportDashboardPdf(result)
  );
}

function drawLearningHeader(commands: string[], result: TestResult, title: string, subtitle: string) {
  fillRect(commands, 24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48, '#fbfcfd');
  strokeRect(commands, 24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48, '#d8dee6', 1.2);
  fillRect(commands, 24, PAGE_HEIGHT - 136, PAGE_WIDTH - 48, 112, '#173d62');
  fillRect(commands, 24, PAGE_HEIGHT - 136, PAGE_WIDTH - 48, 8, '#126b73');
  fillRect(commands, 462, PAGE_HEIGHT - 106, 38, 48, '#eef6f5');
  drawText(commands, 'TD', 474, 756, { size: 12, bold: true, color: '#173d62' });
  drawText(commands, title, 56, 758, { size: 24, bold: true, color: '#ffffff' });
  drawText(commands, subtitle, 56, 734, { size: 10, color: '#d9f3f3' });
  drawText(commands, result.studentFullName, 318, 760, { size: 13, bold: true, color: '#ffffff' });
  drawText(commands, result.testLevel, 318, 742, { size: 9, bold: true, color: '#d9f3f3' });
  drawText(commands, result.testTitle, 318, 728, { size: 8, color: '#d9f3f3' });
  drawText(commands, new Date(result.completedAt).toLocaleDateString(), 318, 716, { size: 8, color: '#ffffff' });
}

function drawLessonCard(commands: string[], lessonNumber: number, title: string, revision: string, focus: string, x: number, y: number, width: number) {
  const height = 86;
  fillRect(commands, x, y - height, width, height, '#f4f8f8');
  strokeRect(commands, x, y - height, width, height, '#dce7e7');
  fillRect(commands, x, y - height, 44, height, '#eef6f5');
  drawText(commands, `${lessonNumber}`, x + 16, y - 35, { size: 18, bold: true, color: '#126b73' });
  drawWrappedText(commands, title, x + 58, y - 18, 62, { size: 9.2, bold: true, leading: 11, maxLines: 2 });
  drawText(commands, 'Revision', x + 58, y - 45, { size: 7.2, bold: true, color: '#126b73' });
  drawWrappedText(commands, revision, x + 104, y - 45, 58, { size: 7.2, leading: 9, maxLines: 1 });
  drawText(commands, 'Focus', x + 58, y - 63, { size: 7.2, bold: true, color: '#126b73' });
  drawWrappedText(commands, focus, x + 104, y - 63, 58, { size: 7.2, leading: 9, maxLines: 2 });
  return y - height - 14;
}

function buildLearningPlanDashboardPdf(result: TestResult) {
  const priorityTargets = result.suggestedTargets.length
    ? result.suggestedTargets
    : ['Maintain fluency and confidence across the topics covered in this diagnostic.'];
  const mainFocusAreas = result.weakTopics.length
    ? result.weakTopics.slice(0, 3)
    : result.topicBreakdown
      .filter(topic => topic.status !== 'secure')
      .map(topic => topic.topic)
      .slice(0, 3);
  const totalLessons = priorityTargets.length + 1;
  const pages: string[][] = [[]];
  let page = pages[0];
  let y = 674;

  const revisionForLesson = (index: number) => {
    if (index === 0) return 'Key basics from the diagnostic.';
    return `Previous focus: ${priorityTargets[index - 1]}`;
  };

  const addPage = () => {
    dashboardFooter(page, pages.length);
    page = [];
    pages.push(page);
    drawLearningHeader(page, result, 'Learning plan', 'Lesson sequence and revision focus');
    y = 674;
  };

  drawLearningHeader(page, result, 'Learning plan', 'Lesson sequence and revision focus');
  drawCompactMetric(page, 'Lessons', `${totalLessons}`, 56, 674, 96);
  drawCompactMetric(page, 'Targets', `${priorityTargets.length}`, 164, 674, 96);
  drawCompactMetric(page, 'Final step', 'Re-test', 272, 674, 96);
  drawSection(page, 'Plan overview', [
    mainFocusAreas.length
      ? `The main areas of focus are ${mainFocusAreas.join(', ')}. These will shape the order of lessons and revision.`
      : 'The diagnostic did not identify major weak areas, so lessons will focus on consolidation, fluency, and extension.',
    'Each lesson includes revision before the new focus, and the final lesson uses another test or short diagnostic to check progress.',
  ], 56, 610, 444, 78, { maxLinesPerItem: 2, fontSize: 7.6, leading: 9.5 });

  y = 508;
  priorityTargets.forEach((target, index) => {
    if (y < 140) addPage();
    y = drawLessonCard(
      page,
      index + 1,
      target,
      revisionForLesson(index),
      `We will cover this target through examples, guided practice, and independent questions.`,
      56,
      y,
      444
    );
  });

  if (y < 140) addPage();
  drawLessonCard(
    page,
    totalLessons,
    'Reassessment and next steps',
    'Main targets from the plan.',
    'Complete another test or short diagnostic and decide the next priorities.',
    56,
    y,
    444
  );
  dashboardFooter(page, pages.length);
  return pages;
}

export function downloadLearningPlanPdf(result: TestResult) {
  downloadPdfFromPages(
    `${cleanFilename(result.studentFullName)}-learning-plan.pdf`,
    buildLearningPlanDashboardPdf(result)
  );
}
