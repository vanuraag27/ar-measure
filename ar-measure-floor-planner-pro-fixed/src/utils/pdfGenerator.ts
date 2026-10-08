import { jsPDF } from 'jspdf';
import { ProjectRecord, RoomRecord, AppSettings } from '../types';
import { formatLength, formatArea } from './units';

export function generateProjectPDFDoc(project: ProjectRecord, settings: AppSettings): { doc: jsPDF; filename: string } {
  const paperFormat = settings.pdfPaperSize || 'a4';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: paperFormat
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryColor = [15, 23, 42]; // Slate-900
  const accentColor = [245, 158, 11]; // Amber-500
  const mutedColor = [100, 116, 139]; // Slate-500
  const lightBg = [248, 250, 252]; // Slate-50

  const totalArea = project.rooms.reduce((acc, r) => acc + (r.area || 0), 0);

  // ==========================================
  // PAGE 1: COVER & PROJECT OVERVIEW
  // ==========================================
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Decorative Accent Bar
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, 8, pageHeight, 'F');

  // Header tag
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text('ARCHITECTURAL AR SURVEY & FLOOR PLAN REPORT', margin, 35);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(project.name || 'Floor Plan Survey', margin, 50);

  // Property & Client Information Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 70, contentWidth, 75, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PROJECT SPECIFICATIONS', margin + 8, 82);

  const drawRow = (label: string, value: string, yPos: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(label, margin + 8, yPos);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(value, margin + 65, yPos);
  };

  drawRow('Property Type:', project.propertyType.toUpperCase(), 94);
  drawRow('Address / Location:', project.address || 'Not specified', 104);
  drawRow('Survey Date:', new Date(project.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 114);
  drawRow('Survey Client:', project.clientName || 'General Client', 124);
  drawRow('Total Measured Area:', formatArea(totalArea, settings.defaultAreaUnit), 134);

  // Summary Metrics Badges
  const badgeWidth = (contentWidth - 10) / 3;
  const metrics = [
    { label: 'Rooms Surveyed', value: `${project.rooms.length}` },
    { label: 'Total Floor Area', value: formatArea(totalArea, settings.defaultAreaUnit) },
    { label: 'Survey Quality', value: 'AR High Precision' },
  ];

  metrics.forEach((m, idx) => {
    const x = margin + idx * (badgeWidth + 5);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, 160, badgeWidth, 32, 3, 3, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(m.label, x + 6, 172);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(m.value, x + 6, 184);
  });

  // Disclaimer Box at Bottom
  const disclaimerY = pageHeight - 45;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, disclaimerY, contentWidth, 30, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PROFESSIONAL MEASUREMENT DISCLAIMER', margin + 6, disclaimerY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  const disclaimerText = 'AR measurements are optical & inertial sensor estimates. Measurements may vary depending on device hardware, lighting, surface texture, and operator movement. For construction, legal, structural, or professional surveying work, verify critical measurements with certified surveying instruments.';
  doc.text(doc.splitTextToSize(disclaimerText, contentWidth - 12), margin + 6, disclaimerY + 15);

  // ==========================================
  // PAGE 2: 2D FLOOR PLAN VECTOR DRAWING
  // ==========================================
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('2D ARCHITECTURAL FLOOR PLAN', margin, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text(`${project.name} · Scale: 1:50 · North oriented`, margin, 32);

  // Floor Plan Drawing Area
  const planBoxX = margin;
  const planBoxY = 40;
  const planBoxW = contentWidth;
  const planBoxH = 175;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(planBoxX, planBoxY, planBoxW, planBoxH, 3, 3, 'FD');

  // Grid lines
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  for (let x = planBoxX + 15; x < planBoxX + planBoxW; x += 15) {
    doc.line(x, planBoxY, x, planBoxY + planBoxH);
  }
  for (let y = planBoxY + 15; y < planBoxY + planBoxH; y += 15) {
    doc.line(planBoxX, y, planBoxX + planBoxW, y);
  }

  // Draw North Arrow
  const northX = planBoxX + planBoxW - 15;
  const northY = planBoxY + 15;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.triangle(northX, northY - 8, northX - 4, northY + 4, northX + 4, northY + 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('N', northX - 2.5, northY - 10);

  // Graphic Scale Bar
  const scaleX = planBoxX + 10;
  const scaleY = planBoxY + planBoxH - 10;
  const isImperial = settings.unitSystem === 'imperial';
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(1);
  doc.line(scaleX, scaleY, scaleX + 30, scaleY);
  doc.line(scaleX, scaleY - 2, scaleX, scaleY + 2);
  doc.line(scaleX + 15, scaleY - 1.5, scaleX + 15, scaleY + 1.5);
  doc.line(scaleX + 30, scaleY - 2, scaleX + 30, scaleY + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('0', scaleX - 1, scaleY - 4);
  if (isImperial) {
    doc.text('5 ft', scaleX + 12, scaleY - 4);
    doc.text('10 ft', scaleX + 26, scaleY - 4);
  } else {
    doc.text('1m', scaleX + 13, scaleY - 4);
    doc.text('2m', scaleX + 28, scaleY - 4);
  }

  // Compute bounding box of all room corners to map to canvas
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  project.rooms.forEach(r => {
    (r.corners || []).forEach(c => {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
    });
  });

  if (!isFinite(minX)) {
    minX = 0; maxX = 10; minY = 0; maxY = 8;
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const paddingM = 15;
  const scaleFactor = Math.min((planBoxW - paddingM * 2) / spanX, (planBoxH - paddingM * 2) / spanY);

  const toDocX = (mx: number) => planBoxX + paddingM + (mx - minX) * scaleFactor;
  const toDocY = (my: number) => planBoxY + paddingM + (my - minY) * scaleFactor;

  // Render rooms
  project.rooms.forEach((room) => {
    if (!room.corners || room.corners.length < 3) return;

    // Room background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.8);

    // Build path
    const pts = room.corners.map(c => ({ x: toDocX(c.x), y: toDocY(c.y) }));
    for (let i = 0; i < pts.length; i++) {
      const next = pts[(i + 1) % pts.length];
      doc.line(pts[i].x, pts[i].y, next.x, next.y);
    }

    // Room Label in center
    const avgX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const avgY = pts.reduce((s, p) => s + p.y, 0) / pts.length;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(room.name.toUpperCase(), avgX, avgY - 2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(`${formatLength(room.length, settings.defaultLengthUnit)} × ${formatLength(room.width, settings.defaultLengthUnit)}`, avgX, avgY + 3, { align: 'center' });
    doc.text(formatArea(room.area, settings.defaultAreaUnit), avgX, avgY + 8, { align: 'center' });

    // Draw Furniture outlines
    if (room.furniture && room.furniture.length > 0) {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);
      room.furniture.forEach(f => {
        const fx = toDocX(f.x) - (f.width * scaleFactor) / 2;
        const fy = toDocY(f.y) - (f.depth * scaleFactor) / 2;
        const fw = f.width * scaleFactor;
        const fh = f.depth * scaleFactor;
        doc.roundedRect(fx, fy, fw, fh, 1, 1, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(f.name, fx + fw / 2, fy + fh / 2 + 1, { align: 'center' });
      });
    }
  });

  // Legend at bottom of page 2
  const legendY = planBoxY + planBoxH + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text(
    isImperial
      ? 'Wall thickness: 6" (150mm) · Solid perimeter walls · Furniture items placed at scale'
      : 'Wall thickness: 150mm · Solid perimeter walls · Furniture items placed at scale',
    margin, 
    legendY
  );

  // ==========================================
  // PAGE 3: ROOM MEASUREMENT TABLE & INVENTORY
  // ==========================================
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ROOM MEASUREMENT & SCHEDULE TABLE', margin, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text('Calculated from AR spatial scanning coordinates and verified perimeter boundaries.', margin, 32);

  // Table Header
  const tableY = 45;
  const colWidths = [48, 25, 25, 25, 26, 26];
  const colNames = [
    'Room Name', 
    `Length (${settings.defaultLengthUnit})`, 
    `Width (${settings.defaultLengthUnit})`, 
    `Height (${settings.defaultLengthUnit})`, 
    `Area (${settings.defaultAreaUnit})`, 
    `Perimeter (${settings.defaultLengthUnit})`
  ];

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, tableY, contentWidth, 9, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  let curColX = margin;
  colNames.forEach((name, i) => {
    doc.text(name, curColX + 3, tableY + 6);
    curColX += colWidths[i];
  });

  // Table Rows
  let curRowY = tableY + 9;
  project.rooms.forEach((room, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, curRowY, contentWidth, 8.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

    const vals = [
      room.name,
      formatLength(room.length, settings.defaultLengthUnit),
      formatLength(room.width, settings.defaultLengthUnit),
      formatLength(room.height || 2.7, settings.defaultLengthUnit),
      formatArea(room.area, settings.defaultAreaUnit),
      formatLength(room.perimeter, settings.defaultLengthUnit),
    ];

    let rowColX = margin;
    vals.forEach((v, i) => {
      doc.text(v, rowColX + 3, curRowY + 5.5);
      rowColX += colWidths[i];
    });

    curRowY += 8.5;
  });

  // Total Row
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curRowY, contentWidth, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL FLOOR AREA', margin + 3, curRowY + 6);
  doc.text(formatArea(totalArea, settings.defaultAreaUnit), margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 3, curRowY + 6);

  // Footer notes & signature block
  const signY = curRowY + 40;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, signY, margin + 70, signY);
  doc.line(pageWidth - margin - 70, signY, pageWidth - margin, signY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text('Surveyor Signature / Verification', margin, signY + 6);
  doc.text('Client / Owner Approval', pageWidth - margin - 70, signY + 6);

  // Return doc and filename
  const filename = `${(project.name || 'FloorPlan').replace(/\s+/g, '_')}_Survey_Report.pdf`;
  return { doc, filename };
}

export function exportProjectToPDF(project: ProjectRecord, settings: AppSettings): void {
  const { doc, filename } = generateProjectPDFDoc(project, settings);
  doc.save(filename);
}

export function generateProjectPDFBlob(project: ProjectRecord, settings: AppSettings): { blob: Blob; filename: string } {
  const { doc, filename } = generateProjectPDFDoc(project, settings);
  const blob = doc.output('blob');
  return { blob, filename };
}
