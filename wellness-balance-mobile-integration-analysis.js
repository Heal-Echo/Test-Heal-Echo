const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak } = require('docx');
const fs = require('fs');

// ── 공통 설정 ──
const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 9360

const COLORS = {
  primary: "1B4F72",
  secondary: "2E86C1",
  accent: "E74C3C",
  warning: "F39C12",
  success: "27AE60",
  lightBg: "EBF5FB",
  headerBg: "1B4F72",
  headerText: "FFFFFF",
  border: "BDC3C7",
  text: "2C3E50",
  muted: "7F8C8D",
};

const FONT = "Arial";

// ── 스타일 정의 ──
const styles = {
  default: {
    document: {
      run: { font: FONT, size: 22, color: COLORS.text },
      paragraph: { spacing: { after: 120, line: 276 } },
    },
  },
  paragraphStyles: [
    {
      id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 36, bold: true, font: FONT, color: COLORS.primary },
      paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
    },
    {
      id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 30, bold: true, font: FONT, color: COLORS.secondary },
      paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 },
    },
    {
      id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 26, bold: true, font: FONT, color: COLORS.primary },
      paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 },
    },
  ],
};

// ── 넘버링 정의 ──
const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
    {
      reference: "bullets2",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
      }],
    },
    {
      reference: "numbers",
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
    {
      reference: "priorities",
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "P%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
  ],
};

// ── 헬퍼 함수 ──
const border = { style: BorderStyle.SINGLE, size: 1, color: COLORS.border };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: COLORS.headerText, font: FONT, size: 20 })],
    })],
  });
}

function cell(text, width, opts = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text, font: FONT, size: 20, ...(opts.runOpts || {}) })];
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: runs,
    })],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 260 },
    children: [new TextRun({ text, font: FONT, size: 22 })],
  });
}

function bulletBold(boldText, normalText, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 260 },
    children: [
      new TextRun({ text: boldText, bold: true, font: FONT, size: 22 }),
      new TextRun({ text: normalText, font: FONT, size: 22 }),
    ],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after || 120, line: 276 },
    children: [new TextRun({ text, font: FONT, size: 22, ...opts })],
  });
}

function heading(text, level) {
  return new Paragraph({
    heading: level,
    children: [new TextRun(text)],
  });
}

function spacer(height = 120) {
  return new Paragraph({ spacing: { after: height }, children: [] });
}

function priorityBadge(level) {
  const colors = {
    "Critical": COLORS.accent,
    "High": COLORS.warning,
    "Medium": COLORS.secondary,
    "Low": COLORS.success,
  };
  return new TextRun({
    text: `[${level}]`,
    bold: true,
    color: colors[level] || COLORS.text,
    font: FONT,
    size: 20,
  });
}

// ── 문서 구성 ──
const children = [];

// 표지
children.push(spacer(2000));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "Heal Echo", font: FONT, size: 28, color: COLORS.secondary })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
  children: [new TextRun({ text: "Wellness/Balance \uBAA8\uBC14\uC77C \uC5F0\uB3D9 \uBD84\uC11D \uBCF4\uACE0\uC11C", font: FONT, size: 48, bold: true, color: COLORS.primary })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 60 },
  children: [new TextRun({ text: "Local Storage & AWS \uAD00\uC810 \uBB38\uC81C \uBD84\uC11D \uBC0F \uC6B0\uC120\uC21C\uC704 \uB85C\uB4DC\uB9F5", font: FONT, size: 24, color: COLORS.muted })],
}));
children.push(spacer(400));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "2026\uB144 3\uC6D4 24\uC77C", font: FONT, size: 22, color: COLORS.muted })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "\uBB38\uC11C \uBC84\uC804: v1.0 | \uCF54\uB4DC \uBCC0\uACBD \uC5C6\uC74C (\uBD84\uC11D\uB9CC)", font: FONT, size: 20, color: COLORS.muted })],
}));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================================
// 1. 현재 아키텍처 요약
// ========================================
children.push(heading("1. \uD604\uC7AC \uC544\uD0A4\uD14D\uCC98 \uC694\uC57D", HeadingLevel.HEADING_1));

children.push(para("\uD604\uC7AC Heal Echo\uB294 Next.js 14 \uAE30\uBC18 \uC6F9 \uC560\uD50C\uB9AC\uCF00\uC774\uC158\uC73C\uB85C, \uBAA8\uBC14\uC77C \uC6F9 \uBC0F \uB124\uC774\uD2F0\uBE0C \uC571\uC73C\uB85C\uC758 \uD655\uC7A5\uC744 \uACE0\uB824\uD558\uC5EC \uC2A4\uD1A0\uB9AC\uC9C0 \uCD94\uC0C1\uD654 \uB808\uC774\uC5B4(storage.ts)\uB97C \uC774\uBBF8 \uAD6C\uCD95\uD574 \uB450\uC5C8\uC2B5\uB2C8\uB2E4. \uADF8\uB7EC\uB098 \uC2E4\uC81C \uBAA8\uBC14\uC77C \uD658\uACBD \uC5F0\uB3D9 \uC2DC \uC5EC\uB7EC \uAD6C\uC870\uC801 \uBB38\uC81C\uAC00 \uC874\uC7AC\uD569\uB2C8\uB2E4."));

children.push(heading("1.1 \uB370\uC774\uD130 \uD750\uB984 \uAD6C\uC870", HeadingLevel.HEADING_3));

const archColWidths = [2200, 3580, 3580];
children.push(new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: archColWidths,
  rows: [
    new TableRow({ children: [
      headerCell("\uAD6C\uBD84", archColWidths[0]),
      headerCell("\uD604\uC7AC \uC0C1\uD0DC", archColWidths[1]),
      headerCell("\uBAA8\uBC14\uC77C \uC5F0\uB3D9 \uC2DC", archColWidths[2]),
    ]}),
    new TableRow({ children: [
      cell("\uAD6C\uB3C5 \uC0C1\uD0DC", archColWidths[0], { runOpts: { bold: true } }),
      cell("API \u2192 DynamoDB (+ localStorage \uCE90\uC2DC)", archColWidths[1]),
      cell("\uB3D9\uC77C \uD328\uD134 \uC720\uC9C0 \uAC00\uB2A5", archColWidths[2]),
    ]}),
    new TableRow({ children: [
      cell("\uC2DC\uCCAD \uAE30\uB85D", archColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("localStorage\uB9CC \uC0AC\uC6A9 (\uC11C\uBC84 \uBBF8\uC5F0\uB3D9)", archColWidths[1], { shading: "F8F9FA" }),
      cell("\uC11C\uBC84 \uB3D9\uAE30\uD654 \uD544\uC218", archColWidths[2], { shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("\uC120\uBB3C \uC0AC\uC774\uD074", archColWidths[0], { runOpts: { bold: true } }),
      cell("localStorage\uB9CC \uC0AC\uC6A9 (\uC11C\uBC84 \uBBF8\uC5F0\uB3D9)", archColWidths[1]),
      cell("\uC11C\uBC84 \uB3D9\uAE30\uD654 \uD544\uC218", archColWidths[2]),
    ]}),
    new TableRow({ children: [
      cell("\uC778\uC99D \uD1A0\uD070", archColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("Cognito SDK + localStorage", archColWidths[1], { shading: "F8F9FA" }),
      cell("WebView/\uC571 \uBE0C\uB9BF\uC9C0 \uD544\uC694", archColWidths[2], { shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("\uC601\uC0C1 \uC7AC\uC0DD", archColWidths[0], { runOpts: { bold: true } }),
      cell("CloudFront CDN \uC9C1\uC811 \uC7AC\uC0DD", archColWidths[1]),
      cell("\uC571 \uB0B4 \uD50C\uB808\uC774\uC5B4 \uCC98\uB9AC \uD544\uC694", archColWidths[2]),
    ]}),
  ],
}));
children.push(spacer());

// ========================================
// 2. Local Storage 관점 문제 분석
// ========================================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("2. Local Storage \uAD00\uC810 \uBB38\uC81C \uBD84\uC11D", HeadingLevel.HEADING_1));

// 문제 1
children.push(heading("2.1 \uB370\uC774\uD130 \uC720\uC2E4 \uC704\uD5D8 (WatchRecord, GiftCycle)", HeadingLevel.HEADING_2));
children.push(para("\uD604\uC7AC \uC2DC\uCCAD \uAE30\uB85D(WatchRecord)\uACFC \uC120\uBB3C \uC0AC\uC774\uD074(GiftCycle)\uC740 localStorage\uC5D0\uB9CC \uC800\uC7A5\uB418\uACE0 \uC788\uC73C\uBA70, \uC11C\uBC84\uC5D0 \uB3D9\uAE30\uD654\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC774\uB294 \uBAA8\uBC14\uC77C \uD658\uACBD\uC5D0\uC11C \uB2E4\uC74C\uACFC \uAC19\uC740 \uC2EC\uAC01\uD55C \uBB38\uC81C\uB97C \uC77C\uC73C\uD0B5\uB2C8\uB2E4."));

children.push(bulletBold("\uBE0C\uB77C\uC6B0\uC800 \uCE90\uC2DC \uCD08\uAE30\uD654: ", "\uC0AC\uC6A9\uC790\uAC00 \uBE0C\uB77C\uC6B0\uC800 \uCE90\uC2DC\uB97C \uC0AD\uC81C\uD558\uBA74 \uBAA8\uB4E0 \uC2DC\uCCAD \uAE30\uB85D\uACFC \uC120\uBB3C \uC9C4\uD589\uB3C4\uAC00 \uC601\uAD6C \uC0AC\uB77C\uC9D1\uB2C8\uB2E4."));
children.push(bulletBold("\uAE30\uAE30 \uAC04 \uBD88\uC77C\uCE58: ", "\uBAA8\uBC14\uC77C \uC6F9\uACFC \uB124\uC774\uD2F0\uBE0C \uC571\uC5D0\uC11C \uAC01\uAC01 \uB2E4\uB978 localStorage\uB97C \uC0AC\uC6A9\uD558\uBBC0\uB85C \uC2DC\uCCAD \uAE30\uB85D\uC774 \uB3D9\uAE30\uD654\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
children.push(bulletBold("InApp Browser \uBB38\uC81C: ", "iOS Safari\uC640 \uC571 \uB0B4 WebView\uC758 localStorage\uAC00 \uBD84\uB9AC\uB418\uC5B4 \uB370\uC774\uD130\uAC00 \uACF5\uC720\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
children.push(bulletBold("iOS ITP \uC81C\uD55C: ", "Safari\uC758 Intelligent Tracking Prevention\uC774 7\uC77C \uD6C4 localStorage \uB370\uC774\uD130\uB97C \uC0AD\uC81C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."));

children.push(spacer());

// 영향도 테이블
const impactColWidths = [2000, 2500, 2500, 2360];
children.push(new Paragraph({
  spacing: { after: 80 },
  children: [new TextRun({ text: "\u25B6 \uC601\uD5A5\uB3C4 \uBD84\uC11D", bold: true, font: FONT, size: 22, color: COLORS.primary })],
}));
children.push(new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: impactColWidths,
  rows: [
    new TableRow({ children: [
      headerCell("\uB370\uC774\uD130", impactColWidths[0]),
      headerCell("\uC720\uC2E4 \uC2DC \uC601\uD5A5", impactColWidths[1]),
      headerCell("\uC0AC\uC6A9\uC790 \uCCB4\uAC10", impactColWidths[2]),
      headerCell("\uC2EC\uAC01\uB3C4", impactColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("WatchRecord", impactColWidths[0], { runOpts: { bold: true } }),
      cell("\uC8FC\uCC28 \uC7A0\uAE08 \uC54C\uACE0\uB9AC\uC998 \uC624\uB3D9\uC791", impactColWidths[1]),
      cell("\uC2DC\uCCAD\uD55C \uC601\uC0C1\uC774 \uB2E4\uC2DC \uC7A0\uAE40", impactColWidths[2]),
      cell([priorityBadge("Critical")], impactColWidths[3], { align: AlignmentType.CENTER }),
    ]}),
    new TableRow({ children: [
      cell("GiftCycle", impactColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("\uC120\uBB3C \uC9C4\uD589\uB3C4 \uCD08\uAE30\uD654", impactColWidths[1], { shading: "F8F9FA" }),
      cell("4\uC8FC \uB178\uB825\uC774 \uC0AC\uB77C\uC9D0", impactColWidths[2], { shading: "F8F9FA" }),
      cell([priorityBadge("Critical")], impactColWidths[3], { align: AlignmentType.CENTER, shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("PlayEvent\uB4F1", impactColWidths[0], { runOpts: { bold: true } }),
      cell("balanceBrain \uACC4\uC0B0 \uC624\uB958", impactColWidths[1]),
      cell("\uC8FC\uCC28 \uC624\uD508 \uB85C\uC9C1 \uBD88\uC77C\uCE58", impactColWidths[2]),
      cell([priorityBadge("High")], impactColWidths[3], { align: AlignmentType.CENTER }),
    ]}),
  ],
}));
children.push(spacer());

// 문제 2
children.push(heading("2.2 \uC571 \uD658\uACBD\uC5D0\uC11C\uC758 Storage API \uBE44\uD638\uD658\uC131", HeadingLevel.HEADING_2));
children.push(para("\uD604\uC7AC storage.ts\uB294 localStorage/sessionStorage\uB97C \uC9C1\uC811 \uC0AC\uC6A9\uD558\uACE0 \uC788\uC73C\uBA70, \uCD94\uC0C1\uD654 \uB808\uC774\uC5B4 \uC8FC\uC11D\uC5D0 \"\uD5A5\uD6C4 AsyncStorage\uB85C \uAD50\uCCB4 \uAC00\uB2A5\"\uC774\uB77C\uACE0 \uBA85\uC2DC\uB418\uC5B4 \uC788\uC9C0\uB9CC, \uC2E4\uC81C\uB85C\uB294 \uAD50\uCCB4 \uC2DC \uB2E4\uC74C \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD569\uB2C8\uB2E4."));

children.push(bulletBold("\uB3D9\uAE30/\uBE44\uB3D9\uAE30 API \uBD88\uC77C\uCE58: ", "localStorage\uB294 \uB3D9\uAE30(synchronous) API\uC774\uC9C0\uB9CC, React Native\uC758 AsyncStorage\uB294 \uBE44\uB3D9\uAE30(async/await)\uC785\uB2C8\uB2E4. \uD604\uC7AC getSubscriptionSync() \uAC19\uC740 \uB3D9\uAE30 \uD568\uC218\uB4E4\uC774 AsyncStorage\uC5D0\uC11C\uB294 \uC791\uB3D9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
children.push(bulletBold("sessionStorage \uBD80\uC7AC: ", "React Native\uC5D0\uB294 sessionStorage \uAC1C\uB150\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. OAuth state \uAC80\uC99D, \uB9AC\uB2E4\uC774\uB809\uD2B8 \uACBD\uB85C \uC800\uC7A5 \uB4F1 sessionStorage\uB97C \uC0AC\uC6A9\uD558\uB294 \uBAA8\uB4E0 \uB85C\uC9C1\uC744 \uB300\uCCB4\uD574\uC57C \uD569\uB2C8\uB2E4."));
children.push(bulletBold("Cookie \uC811\uADFC \uBD88\uAC00: ", "React Native\uC5D0\uC11C\uB294 document.cookie\uC5D0 \uC811\uADFC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC18C\uC15C \uB85C\uADF8\uC778 \uCF5C\uBC31\uC5D0\uC11C \uCFE0\uD0A4\uB85C \uD1A0\uD070\uC744 \uC804\uB2EC\uD558\uB294 \uD604\uC7AC \uD328\uD134\uC744 deep link \uBC29\uC2DD\uC73C\uB85C \uBCC0\uACBD\uD574\uC57C \uD569\uB2C8\uB2E4."));

children.push(spacer());

// 문제 3
children.push(heading("2.3 Cognito SDK Storage Adapter \uD638\uD658\uC131", HeadingLevel.HEADING_2));
children.push(para("cognitoStorageAdapter\uB294 localStorage\uB97C \uAC10\uC2F8\uB294 \uB3D9\uAE30 \uC778\uD130\uD398\uC774\uC2A4\uB97C \uAD6C\uD604\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4. amazon-cognito-identity-js SDK\uB294 \uB0B4\uBD80\uC801\uC73C\uB85C \uB3D9\uAE30 \uC2A4\uD1A0\uB9AC\uC9C0\uB97C \uAE30\uB300\uD558\uBBC0\uB85C, AsyncStorage\uB85C \uB2E8\uC21C \uAD50\uCCB4\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."));

children.push(bulletBold("\uD574\uACB0 \uBC29\uD5A5 A: ", "React Native\uC5D0\uC11C\uB294 AWS Amplify\uC758 Auth \uBAA8\uB4C8\uC744 \uC0AC\uC6A9\uD558\uC5EC Cognito \uC778\uC99D\uC744 \uCC98\uB9AC\uD569\uB2C8\uB2E4. Amplify\uB294 AsyncStorage\uB97C \uB0B4\uC7A5 \uC9C0\uC6D0\uD569\uB2C8\uB2E4."));
children.push(bulletBold("\uD574\uACB0 \uBC29\uD5A5 B: ", "WebView \uBC29\uC2DD\uC77C \uACBD\uC6B0, \uC6F9\uC758 \uAE30\uC874 Cognito \uD50C\uB85C\uC6B0\uB97C \uADF8\uB300\uB85C \uC0AC\uC6A9\uD558\uACE0, \uD1A0\uD070\uC744 \uC571 \u2194 WebView \uAC04 \uBE0C\uB9BF\uC9C0\uB85C \uC804\uB2EC\uD569\uB2C8\uB2E4."));

children.push(spacer());

// 문제 4
children.push(heading("2.4 \uD074\uB77C\uC774\uC5B8\uD2B8 \uC0AC\uC774\uB4DC \uBE44\uC988\uB2C8\uC2A4 \uB85C\uC9C1 \uC758\uC874\uC131", HeadingLevel.HEADING_2));
children.push(para("balanceBrain.ts\uC758 \uC8FC\uCC28\uBCC4 \uC7A0\uAE08/\uC624\uD508 \uC54C\uACE0\uB9AC\uC998\uC774 \uD074\uB77C\uC774\uC5B8\uD2B8\uC5D0\uC11C \uC2E4\uD589\uB418\uBA70, PlayEvent \uB370\uC774\uD130\uB97C localStorage\uC5D0\uC11C \uC9C1\uC811 \uC77D\uC2B5\uB2C8\uB2E4. \uC774\uB294 \uB450 \uAC00\uC9C0 \uBB38\uC81C\uB97C \uBC1C\uC0DD\uC2DC\uD0B5\uB2C8\uB2E4."));

children.push(bulletBold("\uBCF4\uC548 \uCDE8\uC57D\uC810: ", "localStorage\uB294 \uC0AC\uC6A9\uC790\uAC00 \uC9C1\uC811 \uC870\uC791\uD560 \uC218 \uC788\uC5B4, \uC2DC\uCCAD \uAE30\uB85D\uC744 \uC704\uC870\uD558\uC5EC \uC720\uB8CC \uCF58\uD150\uCE20 \uC7A0\uAE08\uC744 \uC6B0\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."));
children.push(bulletBold("\uC77C\uAD00\uC131 \uBB38\uC81C: ", "\uAE30\uAE30\uBCC4\uB85C \uB2E4\uB978 \uACC4\uC0B0 \uACB0\uACFC\uAC00 \uB098\uC62C \uC218 \uC788\uC73C\uBA70, \uC11C\uBC84 \uCE21\uC5D0\uC11C \uAD8C\uD55C \uAC80\uC99D\uC744 \uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================================
// 3. AWS 관점 문제 분석
// ========================================
children.push(heading("3. AWS \uAD00\uC810 \uBB38\uC81C \uBD84\uC11D", HeadingLevel.HEADING_1));

// 문제 1
children.push(heading("3.1 WatchRecord/GiftCycle \uC11C\uBC84 \uB3D9\uAE30\uD654 \uBD80\uC7AC", HeadingLevel.HEADING_2));
children.push(para("\uD604\uC7AC DynamoDB\uC5D0 \uC800\uC7A5\uB418\uB294 \uB370\uC774\uD130\uB294 UserSubscription\uBFD0\uC774\uBA70, WatchRecord\uC640 GiftCycle\uC740 \uC11C\uBC84\uC5D0 \uC800\uC7A5\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBAA8\uBC14\uC77C \uC5F0\uB3D9\uC744 \uC704\uD574\uC11C\uB294 \uBC18\uB4DC\uC2DC API Gateway + Lambda + DynamoDB \uD30C\uC774\uD504\uB77C\uC778\uC744 \uAD6C\uCD95\uD574\uC57C \uD569\uB2C8\uB2E4."));

children.push(new Paragraph({
  spacing: { after: 80 },
  children: [new TextRun({ text: "\u25B6 \uD544\uC694\uD55C AWS \uB9AC\uC18C\uC2A4 \uCD94\uAC00", bold: true, font: FONT, size: 22, color: COLORS.primary })],
}));

const awsColWidths = [2200, 2800, 2200, 2160];
children.push(new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: awsColWidths,
  rows: [
    new TableRow({ children: [
      headerCell("AWS \uC11C\uBE44\uC2A4", awsColWidths[0]),
      headerCell("\uC6A9\uB3C4", awsColWidths[1]),
      headerCell("\uD14C\uC774\uBE14/\uD568\uC218\uBA85", awsColWidths[2]),
      headerCell("\uC0C1\uD0DC", awsColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("DynamoDB", awsColWidths[0], { runOpts: { bold: true } }),
      cell("WatchRecord \uC800\uC7A5", awsColWidths[1]),
      cell("heal-watch-records", awsColWidths[2]),
      cell([new TextRun({ text: "\uC2E0\uADDC \uD544\uC694", color: COLORS.accent, bold: true, font: FONT, size: 20 })], awsColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("DynamoDB", awsColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("GiftCycle \uC800\uC7A5", awsColWidths[1], { shading: "F8F9FA" }),
      cell("heal-gift-cycles", awsColWidths[2], { shading: "F8F9FA" }),
      cell([new TextRun({ text: "\uC2E0\uADDC \uD544\uC694", color: COLORS.accent, bold: true, font: FONT, size: 20 })], awsColWidths[3], { shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("API Gateway", awsColWidths[0], { runOpts: { bold: true } }),
      cell("CRUD \uC5D4\uB4DC\uD3EC\uC778\uD2B8", awsColWidths[1]),
      cell("/user/watch-records\n/user/gift-cycle", awsColWidths[2]),
      cell([new TextRun({ text: "\uC2E0\uADDC \uD544\uC694", color: COLORS.accent, bold: true, font: FONT, size: 20 })], awsColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("Lambda", awsColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("\uBE44\uC988\uB2C8\uC2A4 \uB85C\uC9C1 \uCC98\uB9AC", awsColWidths[1], { shading: "F8F9FA" }),
      cell("heal-watch-record-handler\nheal-gift-cycle-handler", awsColWidths[2], { shading: "F8F9FA" }),
      cell([new TextRun({ text: "\uC2E0\uADDC \uD544\uC694", color: COLORS.accent, bold: true, font: FONT, size: 20 })], awsColWidths[3], { shading: "F8F9FA" }),
    ]}),
  ],
}));
children.push(spacer());

// 문제 2
children.push(heading("3.2 \uC601\uC0C1 \uC7AC\uC0DD \uBC0F CDN \uCC98\uB9AC", HeadingLevel.HEADING_2));
children.push(para("\uD604\uC7AC CloudFront CDN\uC744 \uD1B5\uD574 \uC601\uC0C1\uC744 \uC81C\uACF5\uD558\uACE0 \uC788\uC73C\uBA70, \uBAA8\uBC14\uC77C \uC571\uC5D0\uC11C\uB294 \uCD94\uAC00\uC801\uC778 \uACE0\uB824\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4."));

children.push(bulletBold("HLS/DASH \uC2A4\uD2B8\uB9AC\uBC0D: ", "\uBAA8\uBC14\uC77C \uB124\uD2B8\uC6CC\uD06C \uD658\uACBD\uC5D0 \uB9DE\uB294 \uC801\uC751\uD615 \uBE44\uD2B8\uB808\uC774\uD2B8 \uC2A4\uD2B8\uB9AC\uBC0D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uD604\uC7AC MP4 \uC9C1\uC811 \uC7AC\uC0DD \uBC29\uC2DD\uC740 \uBAA8\uBC14\uC77C \uB370\uC774\uD130 \uC18C\uBAA8\uAC00 \uD07D\uB2C8\uB2E4."));
children.push(bulletBold("CloudFront Signed URL: ", "\uC571\uC5D0\uC11C\uC758 \uC601\uC0C1 \uC811\uADFC \uAD8C\uD55C \uAD00\uB9AC\uB97C \uC704\uD574 Signed URL \uB610\uB294 Signed Cookie\uAC00 \uD544\uC694\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."));
children.push(bulletBold("\uC624\uD504\uB77C\uC778 \uCE90\uC2DC: ", "\uC571 \uB0B4\uBD80\uC5D0 \uBE44\uB514\uC624 \uCE90\uC2F1 \uB808\uC774\uC5B4\uB97C \uB450\uC5B4 \uBC18\uBCF5 \uC7AC\uC0DD \uC2DC \uB370\uC774\uD130 \uC18C\uBAA8\uB97C \uC904\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4."));

children.push(spacer());

// 문제 3
children.push(heading("3.3 \uD478\uC2DC \uC54C\uB9BC \uBC0F \uBC31\uADF8\uB77C\uC6B4\uB4DC \uCC98\uB9AC", HeadingLevel.HEADING_2));
children.push(para("\uBAA8\uBC14\uC77C \uC571\uC5D0\uC11C\uB294 \uC6F9\uC5D0 \uC5C6\uB294 \uD478\uC2DC \uC54C\uB9BC\uACFC \uBC31\uADF8\uB77C\uC6B4\uB4DC \uC2E4\uD589 \uAE30\uB2A5\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uC774\uB97C \uC704\uD574 AWS \uC11C\uBE44\uC2A4 \uCD94\uAC00\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4."));

children.push(bulletBold("SNS + FCM/APNS: ", "\uC120\uBB3C \uD574\uAE08, \uC8FC\uCC28 \uC624\uD508, \uC2E4\uCC9C \uB9AC\uB9C8\uC778\uB354 \uB4F1\uC758 \uD478\uC2DC \uC54C\uB9BC\uC744 \uBCF4\uB0B4\uAE30 \uC704\uD574 AWS SNS\uC640 \uD50C\uB7AB\uD3FC\uBCC4 \uD478\uC2DC \uC11C\uBE44\uC2A4 \uC5F0\uB3D9\uC774 \uD544\uC694\uD569\uB2C8\uB2E4."));
children.push(bulletBold("EventBridge/SQS: ", "\uC2DC\uCCAD \uC644\uB8CC \uC774\uBCA4\uD2B8 \uAE30\uBC18\uC73C\uB85C GiftCycle \uC790\uB3D9 \uACC4\uC0B0, \uC8FC\uCC28 \uC624\uD508 \uCC98\uB9AC \uB4F1\uC744 \uC11C\uBC84 \uCE21\uC5D0\uC11C \uCC98\uB9AC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."));

children.push(spacer());

// 문제 4
children.push(heading("3.4 API Gateway \uD655\uC7A5 \uD544\uC694\uC131", HeadingLevel.HEADING_2));
children.push(para("\uD604\uC7AC API Gateway\uB294 \uAD6C\uB3C5 \uC0C1\uD0DC \uC870\uD68C/\uC218\uC815\uACFC \uC601\uC0C1 \uBA54\uD0C0\uB370\uC774\uD130 \uC870\uD68C\uB9CC \uC9C0\uC6D0\uD569\uB2C8\uB2E4. \uBAA8\uBC14\uC77C \uC5F0\uB3D9\uC744 \uC704\uD574 \uB2E4\uC74C \uC5D4\uB4DC\uD3EC\uC778\uD2B8\uAC00 \uCD94\uAC00\uB85C \uD544\uC694\uD569\uB2C8\uB2E4."));

const apiColWidths = [1800, 1400, 3200, 2960];
children.push(new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: apiColWidths,
  rows: [
    new TableRow({ children: [
      headerCell("\uC5D4\uB4DC\uD3EC\uC778\uD2B8", apiColWidths[0]),
      headerCell("Method", apiColWidths[1]),
      headerCell("\uC6A9\uB3C4", apiColWidths[2]),
      headerCell("\uC6B0\uC120\uC21C\uC704", apiColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("/user/watch-records", apiColWidths[0], { runOpts: { bold: true } }),
      cell("GET/POST", apiColWidths[1]),
      cell("\uC2DC\uCCAD \uAE30\uB85D \uC870\uD68C/\uC800\uC7A5", apiColWidths[2]),
      cell([priorityBadge("Critical")], apiColWidths[3], { align: AlignmentType.CENTER }),
    ]}),
    new TableRow({ children: [
      cell("/user/gift-cycle", apiColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("GET/PUT", apiColWidths[1], { shading: "F8F9FA" }),
      cell("\uC120\uBB3C \uC0AC\uC774\uD074 \uC870\uD68C/\uC5C5\uB370\uC774\uD2B8", apiColWidths[2], { shading: "F8F9FA" }),
      cell([priorityBadge("Critical")], apiColWidths[3], { align: AlignmentType.CENTER, shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("/user/play-events", apiColWidths[0], { runOpts: { bold: true } }),
      cell("POST", apiColWidths[1]),
      cell("balanceBrain\uC6A9 \uC7AC\uC0DD \uC774\uBCA4\uD2B8 \uAE30\uB85D", apiColWidths[2]),
      cell([priorityBadge("High")], apiColWidths[3], { align: AlignmentType.CENTER }),
    ]}),
    new TableRow({ children: [
      cell("/user/sync", apiColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("POST", apiColWidths[1], { shading: "F8F9FA" }),
      cell("\uC624\uD504\uB77C\uC778 \uB370\uC774\uD130 \uC77C\uAD04 \uB3D9\uAE30\uD654", apiColWidths[2], { shading: "F8F9FA" }),
      cell([priorityBadge("Medium")], apiColWidths[3], { align: AlignmentType.CENTER, shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("/device/register", apiColWidths[0], { runOpts: { bold: true } }),
      cell("POST", apiColWidths[1]),
      cell("\uD478\uC2DC \uC54C\uB9BC\uC6A9 \uB514\uBC14\uC774\uC2A4 \uD1A0\uD070 \uB4F1\uB85D", apiColWidths[2]),
      cell([priorityBadge("Medium")], apiColWidths[3], { align: AlignmentType.CENTER }),
    ]}),
  ],
}));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================================
// 4. 모바일 웹 vs 네이티브 앱 비교
// ========================================
children.push(heading("4. \uBAA8\uBC14\uC77C \uC6F9 vs \uB124\uC774\uD2F0\uBE0C \uC571: \uC5F0\uB3D9 \uBC29\uC2DD \uBE44\uAD50", HeadingLevel.HEADING_1));
children.push(para("\uC5F0\uB3D9 \uBC29\uC2DD\uC5D0 \uB530\uB77C \uBB38\uC81C\uC758 \uBC94\uC704\uC640 \uD574\uACB0 \uBCF5\uC7A1\uB3C4\uAC00 \uD06C\uAC8C \uB2EC\uB77C\uC9D1\uB2C8\uB2E4."));

const compareColWidths = [2000, 2400, 2400, 2560];
children.push(new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: compareColWidths,
  rows: [
    new TableRow({ children: [
      headerCell("\uD56D\uBAA9", compareColWidths[0]),
      headerCell("\uBAA8\uBC14\uC77C \uC6F9 (PWA)", compareColWidths[1]),
      headerCell("WebView \uD558\uC774\uBE0C\uB9AC\uB4DC", compareColWidths[2]),
      headerCell("React Native", compareColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("Storage", compareColWidths[0], { runOpts: { bold: true } }),
      cell("localStorage \uADF8\uB300\uB85C (\uC720\uC2E4 \uC704\uD5D8 \uC874\uC7AC)", compareColWidths[1]),
      cell("WebView localStorage + \uBE0C\uB9BF\uC9C0\uB85C \uC571 \uCE21 \uC800\uC7A5", compareColWidths[2]),
      cell("AsyncStorage / MMKV (\uC548\uC815\uC801)", compareColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("\uCF54\uB4DC \uC7AC\uC0AC\uC6A9", compareColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("\uAE30\uC874 \uCF54\uB4DC 100% \uC7AC\uC0AC\uC6A9", compareColWidths[1], { shading: "F8F9FA" }),
      cell("\uAE30\uC874 \uCF54\uB4DC 90%+ \uC7AC\uC0AC\uC6A9", compareColWidths[2], { shading: "F8F9FA" }),
      cell("\uBE44\uC988\uB2C8\uC2A4 \uB85C\uC9C1\uB9CC \uC7AC\uC0AC\uC6A9, UI \uC7AC\uC791\uC131", compareColWidths[3], { shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("\uC778\uC99D", compareColWidths[0], { runOpts: { bold: true } }),
      cell("Cognito SDK \uADF8\uB300\uB85C", compareColWidths[1]),
      cell("Cognito SDK + \uD1A0\uD070 \uBE0C\uB9BF\uC9C0", compareColWidths[2]),
      cell("Amplify Auth \uC0AC\uC6A9 \uD544\uC694", compareColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("\uD478\uC2DC \uC54C\uB9BC", compareColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("Web Push (\uC81C\uD55C\uC801)", compareColWidths[1], { shading: "F8F9FA" }),
      cell("FCM/APNS \uC9C0\uC6D0", compareColWidths[2], { shading: "F8F9FA" }),
      cell("FCM/APNS \uC9C0\uC6D0", compareColWidths[3], { shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("\uAC1C\uBC1C \uBE44\uC6A9", compareColWidths[0], { runOpts: { bold: true } }),
      cell("\uB0AE\uC74C", compareColWidths[1]),
      cell("\uC911\uAC04", compareColWidths[2]),
      cell("\uB192\uC74C", compareColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("\uCD94\uCC9C\uB3C4", compareColWidths[0], { runOpts: { bold: true }, shading: "EBF5FB" }),
      cell([new TextRun({ text: "\u2605\u2605\u2606 \uB2E8\uAE30", color: COLORS.warning, bold: true, font: FONT, size: 20 })], compareColWidths[1], { shading: "EBF5FB" }),
      cell([new TextRun({ text: "\u2605\u2605\u2605 \uAD8C\uC7A5", color: COLORS.success, bold: true, font: FONT, size: 20 })], compareColWidths[2], { shading: "EBF5FB" }),
      cell([new TextRun({ text: "\u2605\u2605\u2606 \uC7A5\uAE30", color: COLORS.secondary, bold: true, font: FONT, size: 20 })], compareColWidths[3], { shading: "EBF5FB" }),
    ]}),
  ],
}));

children.push(spacer());
children.push(para("\uD604\uC7AC \uC544\uD0A4\uD14D\uCC98\uB97C \uACE0\uB824\uD560 \uB54C, WebView \uD558\uC774\uBE0C\uB9AC\uB4DC \uBC29\uC2DD\uC774 \uAC00\uC7A5 \uD6A8\uC728\uC801\uC785\uB2C8\uB2E4. \uAE30\uC874 Next.js \uCF54\uB4DC\uB97C \uAC70\uC758 \uADF8\uB300\uB85C \uC7AC\uC0AC\uC6A9\uD558\uBA74\uC11C, \uC571 \uACE0\uC720 \uAE30\uB2A5(\uD478\uC2DC \uC54C\uB9BC, \uB124\uC774\uD2F0\uBE0C \uBE44\uB514\uC624 \uD50C\uB808\uC774\uC5B4)\uC744 \uBE0C\uB9BF\uC9C0\uB85C \uBCF4\uC644\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", { italics: true }));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================================
// 5. 우선순위 로드맵
// ========================================
children.push(heading("5. \uC6B0\uC120\uC21C\uC704 \uB85C\uB4DC\uB9F5", HeadingLevel.HEADING_1));
children.push(para("\uBB38\uC81C\uC758 \uC2EC\uAC01\uB3C4\uC640 \uC758\uC874\uC131\uC744 \uAE30\uC900\uC73C\uB85C 4\uB2E8\uACC4\uB85C \uC791\uC5C5\uC744 \uB098\uB205\uB2C8\uB2E4. \uAC01 \uB2E8\uACC4\uB294 \uC774\uC804 \uB2E8\uACC4\uC758 \uC644\uB8CC\uB97C \uC804\uC81C\uB85C \uD569\uB2C8\uB2E4."));

// Phase 1
children.push(heading("Phase 1: \uB370\uC774\uD130 \uC11C\uBC84 \uB3D9\uAE30\uD654 (Critical \u2014 2\uC8FC)", HeadingLevel.HEADING_2));
children.push(para("\uBAA8\uBC14\uC77C \uC5F0\uB3D9\uC758 \uAC00\uC7A5 \uADFC\uBCF8\uC801\uC778 \uC804\uC81C\uC870\uAC74\uC785\uB2C8\uB2E4. \uC774 \uB2E8\uACC4 \uC5C6\uC774\uB294 \uC5B4\uB5A4 \uBAA8\uBC14\uC77C \uD658\uACBD\uB3C4 \uC548\uC804\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));

const p1tasks = [
  ["DynamoDB \uD14C\uC774\uBE14 \uC124\uACC4", "WatchRecord, GiftCycle, PlayEvent \uD14C\uC774\uBE14 \uC2A4\uD0A4\uB9C8 \uC124\uACC4 \uBC0F CDK \uC815\uC758"],
  ["API Gateway \uC5D4\uB4DC\uD3EC\uC778\uD2B8 \uCD94\uAC00", "/user/watch-records, /user/gift-cycle, /user/play-events \uC5D4\uB4DC\uD3EC\uC778\uD2B8 \uC0DD\uC131"],
  ["Lambda \uD578\uB4E4\uB7EC \uAD6C\uD604", "\uAC01 \uC5D4\uB4DC\uD3EC\uC778\uD2B8\uC758 CRUD \uB85C\uC9C1 + Cognito \uC778\uC99D \uAC80\uC99D"],
  ["subscription.ts \uC218\uC815", "getWatchRecords(), saveWatchRecord(), getGiftCycle() \uB4F1\uC744 API \uC6B0\uC120 + localStorage \uD3B4\uBC31 \uD328\uD134\uC73C\uB85C \uBCC0\uACBD"],
  ["\uAE30\uC874 \uB370\uC774\uD130 \uB9C8\uC774\uADF8\uB808\uC774\uC158", "\uAE30\uC874 \uC0AC\uC6A9\uC790\uC758 localStorage \uB370\uC774\uD130\uB97C \uC11C\uBC84\uB85C 1\uD68C \uC5C5\uB85C\uB4DC\uD558\uB294 \uB9C8\uC774\uADF8\uB808\uC774\uC158 \uB85C\uC9C1"],
];

p1tasks.forEach(([title, desc]) => {
  children.push(bulletBold(`${title}: `, desc));
});

children.push(spacer());

// Phase 2
children.push(heading("Phase 2: Storage \uCD94\uC0C1\uD654 \uC644\uC131 (High \u2014 1\uC8FC)", HeadingLevel.HEADING_2));
children.push(para("storage.ts\uC758 \uCD94\uC0C1\uD654 \uB808\uC774\uC5B4\uB97C \uC2E4\uC81C\uB85C \uC571 \uD658\uACBD\uC5D0\uC11C \uC791\uB3D9\uD560 \uC218 \uC788\uB3C4\uB85D \uBCF4\uAC15\uD569\uB2C8\uB2E4."));

const p2tasks = [
  ["\uBE44\uB3D9\uAE30 Storage \uC778\uD130\uD398\uC774\uC2A4 \uC815\uC758", "get/set/remove\uB97C async\uB85C \uBCC0\uD658\uD558\uB294 \uC778\uD130\uD398\uC774\uC2A4 \uC815\uC758. getSubscriptionSync() \uAC19\uC740 \uB3D9\uAE30 \uD568\uC218\uB294 \uC778\uBA54\uBAA8\uB9AC \uCE90\uC2DC \uD328\uD134\uC73C\uB85C \uC804\uD658"],
  ["sessionStorage \uB300\uCCB4 \uAD6C\uD604", "React Navigation params \uB610\uB294 \uC778\uBA54\uBAA8\uB9AC Map\uC73C\uB85C \uAD50\uCCB4 \uAC00\uB2A5\uD55C \uCD94\uC0C1\uD654 \uB808\uC774\uC5B4 \uCD94\uAC00"],
  ["Cookie \uC811\uADFC \uCD94\uC0C1\uD654", "\uC18C\uC15C \uB85C\uADF8\uC778 \uCF5C\uBC31\uC744 deep link / URL scheme \uBC29\uC2DD\uC73C\uB85C \uCC98\uB9AC\uD560 \uC218 \uC788\uB3C4\uB85D getCookie() \uCD94\uC0C1\uD654"],
  ["isBrowser() \uAC00\uB4DC \uD655\uC7A5", "React Native \uD658\uACBD \uAC10\uC9C0\uB97C \uCD94\uAC00\uD558\uC5EC \uD50C\uB7AB\uD3FC\uBCC4 \uBD84\uAE30 \uCC98\uB9AC"],
];

p2tasks.forEach(([title, desc]) => {
  children.push(bulletBold(`${title}: `, desc));
});

children.push(spacer());

// Phase 3
children.push(heading("Phase 3: \uBE44\uC988\uB2C8\uC2A4 \uB85C\uC9C1 \uC11C\uBC84 \uC774\uC804 (High \u2014 2\uC8FC)", HeadingLevel.HEADING_2));
children.push(para("balanceBrain\uC758 \uD575\uC2EC \uB85C\uC9C1\uC744 \uC11C\uBC84\uB85C \uC774\uC804\uD558\uC5EC \uBCF4\uC548\uACFC \uC77C\uAD00\uC131\uC744 \uD655\uBCF4\uD569\uB2C8\uB2E4."));

const p3tasks = [
  ["calculateBalanceState() \uC11C\uBC84 \uC774\uC804", "\uC8FC\uCC28\uBCC4 \uC7A0\uAE08/\uC624\uD508 \uACC4\uC0B0\uC744 Lambda\uC5D0\uC11C \uC2E4\uD589. \uD074\uB77C\uC774\uC5B8\uD2B8\uB294 \uACB0\uACFC\uB9CC \uC218\uC2E0"],
  ["\uC11C\uBC84 \uCE21 \uAD8C\uD55C \uAC80\uC99D \uAC15\uD654", "canPlayVideo()\uB97C \uC11C\uBC84 API\uC5D0\uC11C \uAC80\uC99D\uD558\uC5EC \uD074\uB77C\uC774\uC5B8\uD2B8 \uC870\uC791 \uBC29\uC9C0"],
  ["\uC120\uBB3C \uC0AC\uC774\uD074 \uC790\uB3D9\uD654", "EventBridge \uAE30\uBC18\uC73C\uB85C WatchRecord \uB204\uC801 \uC2DC \uC790\uB3D9 GiftCycle \uACC4\uC0B0 \uBC0F \uD478\uC2DC \uC54C\uB9BC \uD2B8\uB9AC\uAC70"],
];

p3tasks.forEach(([title, desc]) => {
  children.push(bulletBold(`${title}: `, desc));
});

children.push(spacer());

// Phase 4
children.push(heading("Phase 4: \uC571 \uACE0\uC720 \uAE30\uB2A5 (Medium \u2014 2\uC8FC)", HeadingLevel.HEADING_2));
children.push(para("\uC571 \uC0AC\uC6A9\uC790 \uACBD\uD5D8\uC744 \uD5A5\uC0C1\uC2DC\uD0A4\uB294 \uBD80\uAC00 \uAE30\uB2A5\uC785\uB2C8\uB2E4."));

const p4tasks = [
  ["\uD478\uC2DC \uC54C\uB9BC \uC5F0\uB3D9", "AWS SNS + FCM/APNS \uC5F0\uB3D9, \uB514\uBC14\uC774\uC2A4 \uD1A0\uD070 \uAD00\uB9AC API \uAD6C\uD604"],
  ["\uC601\uC0C1 \uC2A4\uD2B8\uB9AC\uBC0D \uCD5C\uC801\uD654", "HLS \uC801\uC751\uD615 \uBE44\uD2B8\uB808\uC774\uD2B8 \uC2A4\uD2B8\uB9AC\uBC0D, MediaConvert \uD30C\uC774\uD504\uB77C\uC778 \uAD6C\uCD95"],
  ["\uC624\uD504\uB77C\uC778 \uC9C0\uC6D0", "\uC571 \uB0B4\uBD80 \uBE44\uB514\uC624 \uCE90\uC2DC\uC640 \uC624\uD504\uB77C\uC778 \uC2DC\uCCAD \uAE30\uB85D \uD050\uC789, \uC628\uB77C\uC778 \uBCF5\uADC0 \uC2DC \uC790\uB3D9 \uB3D9\uAE30\uD654"],
];

p4tasks.forEach(([title, desc]) => {
  children.push(bulletBold(`${title}: `, desc));
});

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================================
// 6. 위험 요소 및 완화 전략
// ========================================
children.push(heading("6. \uC704\uD5D8 \uC694\uC18C \uBC0F \uC644\uD654 \uC804\uB7B5", HeadingLevel.HEADING_1));

const riskColWidths = [2200, 2800, 2200, 2160];
children.push(new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: riskColWidths,
  rows: [
    new TableRow({ children: [
      headerCell("\uC704\uD5D8 \uC694\uC18C", riskColWidths[0]),
      headerCell("\uC601\uD5A5", riskColWidths[1]),
      headerCell("\uD655\uB960", riskColWidths[2]),
      headerCell("\uC644\uD654 \uC804\uB7B5", riskColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("iOS ITP\uC5D0 \uC758\uD55C localStorage \uC0AD\uC81C", riskColWidths[0], { runOpts: { bold: true } }),
      cell("7\uC77C \uBBF8\uC811\uC18D \uC2DC \uBAA8\uB4E0 \uB85C\uCEEC \uB370\uC774\uD130 \uC0AD\uC81C", riskColWidths[1]),
      cell([new TextRun({ text: "\uB192\uC74C", color: COLORS.accent, bold: true, font: FONT, size: 20 })], riskColWidths[2], { align: AlignmentType.CENTER }),
      cell("Phase 1 \uC644\uB8CC\uB85C \uD574\uACB0", riskColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uC2DC \uB370\uC774\uD130 \uCDA9\uB3CC", riskColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("\uAE30\uC874 localStorage\uC640 \uC11C\uBC84 \uB370\uC774\uD130 \uBD88\uC77C\uCE58", riskColWidths[1], { shading: "F8F9FA" }),
      cell([new TextRun({ text: "\uC911\uAC04", color: COLORS.warning, bold: true, font: FONT, size: 20 })], riskColWidths[2], { align: AlignmentType.CENTER, shading: "F8F9FA" }),
      cell("timestamp \uAE30\uBC18 \uCDA9\uB3CC \uD574\uACB0 \uC804\uB7B5", riskColWidths[3], { shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("API \uC9C0\uC5F0/\uC7A5\uC560 \uC2DC UX \uC800\uD558", riskColWidths[0], { runOpts: { bold: true } }),
      cell("\uC601\uC0C1 \uC7AC\uC0DD \uBD88\uAC00, \uC8FC\uCC28 \uC0C1\uD0DC \uBBF8\uBC18\uC601", riskColWidths[1]),
      cell([new TextRun({ text: "\uC911\uAC04", color: COLORS.warning, bold: true, font: FONT, size: 20 })], riskColWidths[2], { align: AlignmentType.CENTER }),
      cell("localStorage \uD3B4\uBC31 + optimistic UI", riskColWidths[3]),
    ]}),
    new TableRow({ children: [
      cell("Cognito \uD1A0\uD070 WebView \uAC04 \uC720\uC2E4", riskColWidths[0], { runOpts: { bold: true }, shading: "F8F9FA" }),
      cell("\uC571 \u2194 WebView \uC804\uD658 \uC2DC \uC7AC\uB85C\uADF8\uC778 \uC694\uAD6C", riskColWidths[1], { shading: "F8F9FA" }),
      cell([new TextRun({ text: "\uB192\uC74C", color: COLORS.accent, bold: true, font: FONT, size: 20 })], riskColWidths[2], { align: AlignmentType.CENTER, shading: "F8F9FA" }),
      cell("\uD1A0\uD070 \uBE0C\uB9BF\uC9C0 + \uC571 \uCE21 Secure Storage", riskColWidths[3], { shading: "F8F9FA" }),
    ]}),
    new TableRow({ children: [
      cell("\uBE44\uC6A9 \uCD08\uACFC (DynamoDB)", riskColWidths[0], { runOpts: { bold: true } }),
      cell("\uC774\uBCA4\uD2B8 \uB9E4 \uC7AC\uC0DD\uB9C8\uB2E4 \uAE30\uB85D \uC2DC \uBE44\uC6A9 \uAE09\uC99D", riskColWidths[1]),
      cell([new TextRun({ text: "\uB0AE\uC74C", color: COLORS.success, bold: true, font: FONT, size: 20 })], riskColWidths[2], { align: AlignmentType.CENTER }),
      cell("\uC77C\uC77C \uC694\uC57D + \uBC30\uCE58 \uC4F0\uAE30", riskColWidths[3]),
    ]}),
  ],
}));

children.push(spacer(200));

// ========================================
// 7. 결론
// ========================================
children.push(heading("7. \uACB0\uB860 \uBC0F \uAD8C\uACE0\uC0AC\uD56D", HeadingLevel.HEADING_1));

children.push(para("\uD604\uC7AC Heal Echo\uC758 wellness/balance \uAE30\uB2A5\uC740 \uC6F9 \uD658\uACBD\uC5D0 \uCD5C\uC801\uD654\uB418\uC5B4 \uC788\uC73C\uBA70, \uBAA8\uBC14\uC77C \uC5F0\uB3D9 \uC2DC \uAC00\uC7A5 \uD070 \uBCD1\uBAA9\uC740 WatchRecord/GiftCycle/PlayEvent \uB370\uC774\uD130\uAC00 localStorage\uC5D0\uB9CC \uC758\uC874\uD558\uACE0 \uC788\uB2E4\uB294 \uC810\uC785\uB2C8\uB2E4. \uC774 \uB370\uC774\uD130\uB4E4\uC740 \uC0AC\uC6A9\uC790\uC758 \uC2DC\uCCAD \uC774\uB825\uACFC \uBCF4\uC0C1 \uC2DC\uC2A4\uD15C\uC758 \uD575\uC2EC\uC774\uBBC0\uB85C, \uC11C\uBC84 \uB3D9\uAE30\uD654\uAC00 \uCD5C\uC6B0\uC120 \uACFC\uC81C\uC785\uB2C8\uB2E4."));

children.push(spacer(80));

children.push(para("\uAD8C\uACE0 \uC791\uC5C5 \uC21C\uC11C\uB294 \uB2E4\uC74C\uACFC \uAC19\uC2B5\uB2C8\uB2E4.", { bold: true }));
children.push(new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  spacing: { after: 80 },
  children: [
    new TextRun({ text: "Phase 1 (\uB370\uC774\uD130 \uC11C\uBC84 \uB3D9\uAE30\uD654)", bold: true, font: FONT, size: 22 }),
    new TextRun({ text: " \u2014 \uBAA8\uBC14\uC77C \uC5F0\uB3D9 \uC5EC\uBD80\uC640 \uBB34\uAD00\uD558\uAC8C \uD604\uC7AC \uC6F9 \uC0AC\uC6A9\uC790\uC758 \uB370\uC774\uD130 \uC548\uC804\uC131\uB3C4 \uAC1C\uC120\uB428", font: FONT, size: 22 }),
  ],
}));
children.push(new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  spacing: { after: 80 },
  children: [
    new TextRun({ text: "Phase 2 (Storage \uCD94\uC0C1\uD654)", bold: true, font: FONT, size: 22 }),
    new TextRun({ text: " \u2014 \uC571 \uD658\uACBD\uC5D0\uC11C \uC2E4\uC81C\uB85C \uB3D9\uC791\uD560 \uC218 \uC788\uB294 \uAE30\uBC18 \uB9C8\uB828", font: FONT, size: 22 }),
  ],
}));
children.push(new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  spacing: { after: 80 },
  children: [
    new TextRun({ text: "Phase 3 (\uBE44\uC988\uB2C8\uC2A4 \uB85C\uC9C1 \uC11C\uBC84 \uC774\uC804)", bold: true, font: FONT, size: 22 }),
    new TextRun({ text: " \u2014 \uBCF4\uC548 \uAC15\uD654 \uBC0F \uAE30\uAE30 \uAC04 \uC77C\uAD00\uC131 \uD655\uBCF4", font: FONT, size: 22 }),
  ],
}));
children.push(new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  spacing: { after: 80 },
  children: [
    new TextRun({ text: "Phase 4 (\uC571 \uACE0\uC720 \uAE30\uB2A5)", bold: true, font: FONT, size: 22 }),
    new TextRun({ text: " \u2014 \uD478\uC2DC \uC54C\uB9BC, \uC601\uC0C1 \uCD5C\uC801\uD654 \uB4F1 \uC0AC\uC6A9\uC790 \uACBD\uD5D8 \uD5A5\uC0C1", font: FONT, size: 22 }),
  ],
}));

children.push(spacer(120));
children.push(para("\uD2B9\uD788 Phase 1\uC740 \uBAA8\uBC14\uC77C \uC5F0\uB3D9\uACFC \uBCC4\uAC1C\uB85C \uD604\uC7AC \uC6F9 \uC0AC\uC6A9\uC790\uC758 \uB370\uC774\uD130 \uC548\uC804\uC131\uB3C4 \uAC1C\uC120\uD558\uBBC0\uB85C, \uC989\uC2DC \uCC29\uC218\uD560 \uAC83\uC744 \uAD8C\uACE0\uD569\uB2C8\uB2E4. storage.ts\uC758 \uCD94\uC0C1\uD654 \uC124\uACC4\uB294 \uD6CC\uB96D\uD558\uAC8C \uC900\uBE44\uB418\uC5B4 \uC788\uC73C\uBBC0\uB85C, \uC11C\uBC84 \uB3D9\uAE30\uD654\uB9CC \uC644\uB8CC\uB418\uBA74 \uBAA8\uBC14\uC77C \uD655\uC7A5\uC758 \uAE30\uC220\uC801 \uAE30\uBC18\uC774 \uB9C8\uB828\uB429\uB2C8\uB2E4.", { italics: true }));


// ── 문서 생성 ──
const doc = new Document({
  styles,
  numbering,
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Heal Echo \u2014 Wellness/Balance \uBAA8\uBC14\uC77C \uC5F0\uB3D9 \uBD84\uC11D", font: FONT, size: 16, color: COLORS.muted, italics: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", font: FONT, size: 16, color: COLORS.muted }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: COLORS.muted }),
          ],
        })],
      }),
    },
    children,
  }],
});

const OUTPUT = "/sessions/zealous-tender-gauss/mnt/Test Heal Echo/Wellness-Balance-모바일연동-분석보고서.docx";

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Created:", OUTPUT);
});
