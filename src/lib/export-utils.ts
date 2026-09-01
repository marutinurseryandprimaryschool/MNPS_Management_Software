/* ============================================
   CampusOS — Export builders (Excel + PDF)
   ============================================
   exceljs workbook builders and jspdf equivalents for the Principal
   Register's day sheet and month sheet, and for the defaulter list.
   The sheet builders consume the ledger output of src/lib/principal-fees.ts —
   they never re-add the money themselves.

   - exceljs and jspdf are imported dynamically so they stay out of the
     initial bundle (static export, client-side only).
   - Every builder either downloads a complete file or throws — callers
     surface a failure toast; no partial files are ever produced.
   - PDFs use "Rs." because the built-in jspdf fonts have no ₹ glyph.
*/

/* ── Shared data contracts ────────────────────────────────────────────── */

export interface LabeledAmount {
  label: string;
  amount: number;
}

export interface DailySheetData {
  schoolName: string;
  academicYear: string;
  /** 'yyyy-MM-dd' — the day this sheet covers. */
  dateKey: string;
  /** Cash / Bank split of the day's receipts. */
  incomeByMode: LabeledAmount[];
  /** Cash / Bank split of the day's spending. */
  expensesByMode: LabeledAmount[];
  payments: {
    /** Business date the money was received, 'dd MMM yyyy'. */
    date: string;
    /** Clock time the entry was recorded ('' when unknown). */
    time: string;
    student: string;
    className: string;
    section: string;
    teacher: string;
    /** 'School fee' | 'ECA fee' | 'Van fee' | 'Other'. */
    head: string;
    /** Academic month the receipt was tagged to ('' for school/other). */
    month: string;
    mode: string;
    enteredBy: string;
    amount: number;
  }[];
  expenses: {
    date: string;
    time: string;
    category: string;
    /** Person / vendor the money went to ('' when not recorded). */
    paidTo: string;
    description: string;
    mode: string;
    amount: number;
  }[];
  totalIncome: number;
  totalExpense: number;
  /** Closing balances as of end of the day. */
  cashInHand: number;
  bankBalance: number;
}

export interface MonthlySheetData {
  schoolName: string;
  academicYear: string;
  /** 'yyyy-MM'. */
  monthKey: string;
  /** e.g. 'August 2026'. */
  monthLabel: string;
  /** One row per day that saw activity, each with its closing balances. */
  days: {
    dateKey: string;
    incomeCash: number;
    incomeBank: number;
    expenseCash: number;
    expenseBank: number;
    cashInHand: number;
    bankBalance: number;
  }[];
  totalIncome: number;
  totalExpense: number;
  /** Closing balances as of end of the month. */
  cashInHand: number;
  bankBalance: number;
}

export interface DefaulterExportRow {
  admissionNumber: string;
  student: string;
  className: string;
  section: string;
  previousBalance: number;
  terms: number;
  eca: number;
  ecaMonthsDue: number;
  bus: number;
  busMonthsDue: number;
  additional: number;
  unallocated: number;
  totalDue: number;
}

export interface DefaulterExportMeta {
  schoolName: string;
  academicYear: string;
  /** 'yyyy-MM-dd' generation date (used in title + filename). */
  generatedOn: string;
  classFilter?: string;
  minPending?: number;
}

/* ── Small shared helpers ─────────────────────────────────────────────── */

const inr = (n: number): string => `Rs. ${Math.round(n).toLocaleString('en-IN')}`;

function downloadBlob(data: BlobPart, filename: string, mime: string): void {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic-import interop
   for exceljs/jspdf (CJS default vs namespace) is untyped by design. */

async function newWorkbook(): Promise<any> {
  const mod: any = await import('exceljs');
  const Excel = mod?.default ?? mod;
  return new Excel.Workbook();
}

async function downloadWorkbook(wb: any, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

const XLSX_MONEY_FMT = '#,##0';
const TITLE_FONT = { bold: true, size: 14 };
const SECTION_FONT = { bold: true, size: 11 };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };

/** Adds a bold header row + data rows; returns the next free row index. */
function addSheetTable(
  ws: any,
  startRow: number,
  headers: string[],
  rows: (string | number)[][],
  moneyCols: number[],
): number {
  const headerRow = ws.getRow(startRow);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    // Bordered, centred headers so the sheet reads as a table, not a dump.
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBBBBBB' } },
      bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } },
      left: { style: 'thin', color: { argb: 'FFBBBBBB' } },
      right: { style: 'thin', color: { argb: 'FFBBBBBB' } },
    };
  });
  rows.forEach((r, ri) => {
    const row = ws.getRow(startRow + 1 + ri);
    r.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.border = {
        top: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        left: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        right: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      };
      if (moneyCols.includes(ci)) {
        cell.numFmt = XLSX_MONEY_FMT;
        cell.alignment = { horizontal: 'right' };
      } else {
        cell.alignment = { horizontal: 'left', wrapText: false };
      }
    });
  });
  // Widen every column to its longest value so nothing shows as ####.
  headers.forEach((h, i) => {
    const longest = rows.reduce(
      (max, r) => Math.max(max, String(r[i] ?? '').length),
      h.length,
    );
    const col = ws.getColumn(i + 1);
    col.width = Math.max(col.width ?? 0, Math.min(40, longest + 4));
  });
  return startRow + rows.length + 1;
}

/**
 * The banner every remaining export shares, so the defaulter list, arrears and
 * expense report read as the same family of documents as the billing reports:
 * school name on a dark band, report title beneath, then the generation stamp.
 */
function addSheetTitle(ws: any, meta: { schoolName: string; academicYear: string }, subtitle: string): number {
  ws.mergeCells('A1:F1');
  const title = ws.getCell('A1');
  title.value = meta.schoolName;
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = XLS_TITLE_FILL;
  ws.getRow(1).height = 24;

  ws.mergeCells('A2:F2');
  const sub = ws.getCell('A2');
  sub.value = subtitle.toUpperCase();
  sub.font = { bold: true, size: 11 };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  sub.fill = XLS_SECTION_FILL;
  ws.getRow(2).height = 20;

  ws.getCell('A3').value = `Academic Year: ${meta.academicYear}`;
  ws.getCell('A3').font = { size: 9 };
  ws.getCell('D3').value = `Generated: ${new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })}`;
  ws.getCell('D3').font = { size: 9 };
  return 5;
}

/* ── Excel: daily balance sheet ───────────────────────────────────────── */

export async function exportDailyBalanceSheetExcel(data: DailySheetData): Promise<void> {
  const wb = await newWorkbook();
  const ws = wb.addWorksheet('Day Sheet');
  ws.columns = [
    { width: 26 }, { width: 16 }, { width: 14 }, { width: 12 },
    { width: 10 }, { width: 20 }, { width: 14 },
  ];

  let row = addSheetTitle(ws, data, `Day Sheet — ${data.dateKey}`);

  ws.getCell(row, 1).value = 'Income by Mode';
  ws.getCell(row, 1).font = SECTION_FONT;
  row = addSheetTable(ws, row + 1, ['Mode', 'Amount'],
    [...data.incomeByMode.map(m => [m.label, m.amount] as (string | number)[]),
      ['Total Income', data.totalIncome]], [1]);
  row += 1;

  ws.getCell(row, 1).value = 'Expenses by Mode';
  ws.getCell(row, 1).font = SECTION_FONT;
  row = addSheetTable(ws, row + 1, ['Mode', 'Amount'],
    [...data.expensesByMode.map(m => [m.label, m.amount] as (string | number)[]),
      ['Total Expenses', data.totalExpense]], [1]);
  row += 1;

  ws.getCell(row, 1).value = 'Tally';
  ws.getCell(row, 1).font = SECTION_FONT;
  row = addSheetTable(ws, row + 1, ['', 'Amount'], [
    ['Total Income', data.totalIncome],
    ['Total Expenses', data.totalExpense],
    ['Net for the day (income - expenses)', data.totalIncome - data.totalExpense],
  ], [1]);
  row += 1;

  ws.getCell(row, 1).value = 'Fees Received';
  ws.getCell(row, 1).font = SECTION_FONT;
  row = addSheetTable(ws, row + 1,
    ['Date', 'Time', 'Student', 'Class', 'Section', 'Teacher', 'Head', 'Month', 'Mode', 'Received By', 'Amount'],
    data.payments.map(p => [
      p.date, p.time || '-', p.student, p.className, p.section || '-', p.teacher || '-',
      p.head, p.month || '-', p.mode, p.enteredBy, p.amount,
    ]),
    [10]);
  row += 1;

  ws.getCell(row, 1).value = 'Expense Entries';
  ws.getCell(row, 1).font = SECTION_FONT;
  row = addSheetTable(ws, row + 1,
    ['Date', 'Time', 'Paid To', 'Category', 'Description', 'Mode', 'Amount'],
    data.expenses.map(e => [
      e.date, e.time || '-', e.paidTo || '-', e.category, e.description, e.mode, e.amount,
    ]),
    [6]);
  row += 1;

  ws.getCell(row, 1).value = 'Closing Balances (end of day)';
  ws.getCell(row, 1).font = SECTION_FONT;
  addSheetTable(ws, row + 1, ['', 'Amount'], [
    ['Cash in Hand', data.cashInHand],
    ['Bank Balance', data.bankBalance],
    ['Total', data.cashInHand + data.bankBalance],
  ], [1]);

  await downloadWorkbook(wb, `day-sheet-${data.dateKey}.xlsx`);
}

/* ── Excel: monthly balance sheet ─────────────────────────────────────── */

export async function exportMonthlyBalanceSheetExcel(data: MonthlySheetData): Promise<void> {
  const wb = await newWorkbook();
  const ws = wb.addWorksheet('Month Sheet');
  ws.columns = [
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 },
  ];

  let row = addSheetTitle(ws, data, `Month Sheet — ${data.monthLabel}`);

  row = addSheetTable(ws, row,
    ['Date', 'Cash In', 'Bank In', 'Cash Out', 'Bank Out', 'Net', 'Cash in Hand', 'Bank Balance'],
    [
      ...data.days.map(d => [
        d.dateKey, d.incomeCash, d.incomeBank, d.expenseCash, d.expenseBank,
        d.incomeCash + d.incomeBank - d.expenseCash - d.expenseBank,
        d.cashInHand, d.bankBalance,
      ] as (string | number)[]),
      ['Total',
        data.days.reduce((sum, d) => sum + d.incomeCash, 0),
        data.days.reduce((sum, d) => sum + d.incomeBank, 0),
        data.days.reduce((sum, d) => sum + d.expenseCash, 0),
        data.days.reduce((sum, d) => sum + d.expenseBank, 0),
        data.totalIncome - data.totalExpense,
        data.cashInHand, data.bankBalance],
    ], [1, 2, 3, 4, 5, 6, 7]);
  row += 1;

  ws.getCell(row, 1).value = 'Tally';
  ws.getCell(row, 1).font = SECTION_FONT;
  row = addSheetTable(ws, row + 1, ['', 'Amount'], [
    ['Total Income', data.totalIncome],
    ['Total Expenses', data.totalExpense],
    ['Net for the month (income - expenses)', data.totalIncome - data.totalExpense],
  ], [1]);
  row += 1;

  ws.getCell(row, 1).value = 'Closing Balances (end of month)';
  ws.getCell(row, 1).font = SECTION_FONT;
  addSheetTable(ws, row + 1, ['', 'Amount'], [
    ['Cash in Hand', data.cashInHand],
    ['Bank Balance', data.bankBalance],
    ['Total', data.cashInHand + data.bankBalance],
  ], [1]);

  await downloadWorkbook(wb, `month-sheet-${data.monthKey}.xlsx`);
}

/* ── Excel: defaulter list ────────────────────────────────────────────── */

export async function exportDefaulterListExcel(
  rows: DefaulterExportRow[],
  meta: DefaulterExportMeta,
): Promise<void> {
  const wb = await newWorkbook();
  const ws = wb.addWorksheet('Defaulters');
  ws.columns = [
    { width: 14 }, { width: 26 }, { width: 12 }, { width: 10 }, { width: 12 },
    { width: 12 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 13 }, { width: 12 },
  ];

  const row = addSheetTitle(ws, meta, `Defaulter Report — ${meta.generatedOn}`);
  const filters: string[] = [];
  if (meta.classFilter) filters.push(`Class: ${meta.classFilter}`);
  if (meta.minPending) filters.push(`Min pending: ${meta.minPending}`);
  if (filters.length > 0) {
    ws.getCell(row - 1, 1).value = filters.join(' • ');
  }

  addSheetTable(ws, row,
    ['Adm No', 'Student', 'Class', 'Section', 'Prev Balance', 'Terms',
      'ECA (months)', 'Bus (months)', 'Additional', 'Unallocated', 'Total Due'],
    [
      ...rows.map(r => [
        r.admissionNumber, r.student, r.className, r.section, r.previousBalance,
        r.terms, `${r.eca} (${r.ecaMonthsDue})`, `${r.bus} (${r.busMonthsDue})`,
        r.additional, r.unallocated, r.totalDue,
      ] as (string | number)[]),
      ['Total', '', '', '',
        rows.reduce((s, r) => s + r.previousBalance, 0),
        rows.reduce((s, r) => s + r.terms, 0),
        rows.reduce((s, r) => s + r.eca, 0),
        rows.reduce((s, r) => s + r.bus, 0),
        rows.reduce((s, r) => s + r.additional, 0),
        rows.reduce((s, r) => s + r.unallocated, 0),
        rows.reduce((s, r) => s + r.totalDue, 0)],
    ], [4, 5, 8, 9, 10]);

  await downloadWorkbook(wb, `defaulters-${meta.generatedOn}.xlsx`);
}

/* ── PDF plumbing ─────────────────────────────────────────────────────── */

interface PdfCol {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

const PDF_MARGIN = 12;
const PDF_ROW_H = 7;

async function newPdf(orientation: 'p' | 'l'): Promise<any> {
  const { jsPDF } = await import('jspdf');
  return new jsPDF({ orientation, unit: 'mm', format: 'a4' });
}

/** PDF twin of addSheetTitle — same banner, so every report looks related. */
function pdfTitle(doc: any, meta: { schoolName: string; academicYear: string }, subtitle: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(31, 78, 121);
  doc.rect(PDF_MARGIN, 8, pageW - PDF_MARGIN * 2, 10, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(meta.schoolName, pageW / 2, 15, { align: 'center' });
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(subtitle.toUpperCase(), pageW / 2, 24, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Academic Year: ${meta.academicYear}`, PDF_MARGIN, 30);
  doc.text(
    `Generated: ${new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`,
    pageW - PDF_MARGIN, 30, { align: 'right' },
  );
  doc.setDrawColor(150);
  doc.line(PDF_MARGIN, 33, pageW - PDF_MARGIN, 33);
  doc.setFontSize(9);
  return 39;
}

function pdfHeaderRow(doc: any, cols: PdfCol[], y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(239, 239, 239);
  doc.rect(PDF_MARGIN, y - 5, pageW - PDF_MARGIN * 2, PDF_ROW_H, 'F');
  doc.setFont('helvetica', 'bold');
  let x = PDF_MARGIN + 2;
  for (const col of cols) {
    doc.text(col.header, col.align === 'right' ? x + col.width - 4 : x, y, {
      align: col.align === 'right' ? 'right' : 'left',
    });
    x += col.width;
  }
  doc.setFont('helvetica', 'normal');
  return y + PDF_ROW_H;
}

/** Draws a table with page-break handling; returns the y after the table. */
function pdfTable(doc: any, cols: PdfCol[], rows: string[][], startY: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  let y = pdfHeaderRow(doc, cols, startY);
  for (const row of rows) {
    if (y > pageH - 14) {
      doc.addPage();
      y = pdfHeaderRow(doc, cols, 16);
    }
    let x = PDF_MARGIN + 2;
    row.forEach((val, i) => {
      const col = cols[i];
      const text = doc.splitTextToSize(val ?? '', col.width - 5)[0] ?? '';
      doc.text(text, col.align === 'right' ? x + col.width - 4 : x, y, {
        align: col.align === 'right' ? 'right' : 'left',
      });
      x += col.width;
    });
    y += PDF_ROW_H;
  }
  return y;
}

function pdfSection(doc: any, label: string, y: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 30) {
    doc.addPage();
    y = 16;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(label, PDF_MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  return y + 6;
}

/* ── PDF: daily balance sheet ─────────────────────────────────────────── */

export async function exportDailyBalanceSheetPdf(data: DailySheetData): Promise<void> {
  const doc = await newPdf('p');
  let y = pdfTitle(doc, data, `Day Sheet — ${data.dateKey}`);

  const modeCols: PdfCol[] = [{ header: 'Mode', width: 90 }, { header: 'Amount', width: 60, align: 'right' }];
  y = pdfSection(doc, 'Income by Mode', y);
  y = pdfTable(doc, modeCols, [
    ...data.incomeByMode.map(m => [m.label, inr(m.amount)]),
    ['Total Income', inr(data.totalIncome)],
  ], y) + 4;

  y = pdfSection(doc, 'Expenses by Mode', y);
  y = pdfTable(doc, modeCols, [
    ...data.expensesByMode.map(m => [m.label, inr(m.amount)]),
    ['Total Expenses', inr(data.totalExpense)],
  ], y) + 4;

  y = pdfSection(doc, 'Tally', y);
  y = pdfTable(doc, modeCols, [
    ['Total Income', inr(data.totalIncome)],
    ['Total Expenses', inr(data.totalExpense)],
    ['Net for the day (income - expenses)', inr(data.totalIncome - data.totalExpense)],
  ], y) + 4;

  y = pdfSection(doc, 'Fees Received', y);
  y = pdfTable(doc, [
    { header: 'Time', width: 16 },
    { header: 'Student', width: 34 },
    { header: 'Class', width: 16 },
    { header: 'Sec', width: 10 },
    { header: 'Teacher', width: 26 },
    { header: 'Head', width: 20 },
    { header: 'Month', width: 18 },
    { header: 'Mode', width: 18 },
    { header: 'Amount', width: 24, align: 'right' },
  ], data.payments.map(p => [
    p.time || '-', p.student, p.className, p.section || '-', p.teacher || '-',
    p.head, p.month || '-', p.mode, inr(p.amount),
  ]), y) + 4;

  y = pdfSection(doc, 'Expense Entries', y);
  y = pdfTable(doc, [
    { header: 'Time', width: 16 },
    { header: 'Paid To', width: 30 },
    { header: 'Category', width: 30 },
    { header: 'Description', width: 52 },
    { header: 'Mode', width: 20 },
    { header: 'Amount', width: 28, align: 'right' },
  ], data.expenses.map(e => [
    e.time || '-', e.paidTo || '-', e.category, e.description, e.mode, inr(e.amount),
  ]), y) + 4;

  y = pdfSection(doc, 'Closing Balances (end of day)', y);
  pdfTable(doc, modeCols, [
    ['Cash in Hand', inr(data.cashInHand)],
    ['Bank Balance', inr(data.bankBalance)],
    ['Total', inr(data.cashInHand + data.bankBalance)],
  ], y);

  doc.save(`day-sheet-${data.dateKey}.pdf`);
}

/* ── PDF: monthly balance sheet ───────────────────────────────────────── */

export async function exportMonthlyBalanceSheetPdf(data: MonthlySheetData): Promise<void> {
  const doc = await newPdf('l');
  let y = pdfTitle(doc, data, `Month Sheet — ${data.monthLabel}`);

  y = pdfTable(doc, [
    { header: 'Date', width: 32 },
    { header: 'Cash In', width: 32, align: 'right' },
    { header: 'Bank In', width: 32, align: 'right' },
    { header: 'Cash Out', width: 32, align: 'right' },
    { header: 'Bank Out', width: 32, align: 'right' },
    { header: 'Net', width: 32, align: 'right' },
    { header: 'Cash in Hand', width: 36, align: 'right' },
    { header: 'Bank Balance', width: 36, align: 'right' },
  ], [
    ...data.days.map(d => [
      d.dateKey, inr(d.incomeCash), inr(d.incomeBank), inr(d.expenseCash), inr(d.expenseBank),
      inr(d.incomeCash + d.incomeBank - d.expenseCash - d.expenseBank),
      inr(d.cashInHand), inr(d.bankBalance),
    ]),
    ['Total',
      inr(data.days.reduce((sum, d) => sum + d.incomeCash, 0)),
      inr(data.days.reduce((sum, d) => sum + d.incomeBank, 0)),
      inr(data.days.reduce((sum, d) => sum + d.expenseCash, 0)),
      inr(data.days.reduce((sum, d) => sum + d.expenseBank, 0)),
      inr(data.totalIncome - data.totalExpense),
      inr(data.cashInHand), inr(data.bankBalance)],
  ], y) + 4;

  const summaryCols: PdfCol[] = [
    { header: '', width: 90 }, { header: 'Amount', width: 60, align: 'right' },
  ];

  y = pdfSection(doc, 'Tally', y);
  y = pdfTable(doc, summaryCols, [
    ['Total Income', inr(data.totalIncome)],
    ['Total Expenses', inr(data.totalExpense)],
    ['Net for the month (income - expenses)', inr(data.totalIncome - data.totalExpense)],
  ], y) + 4;

  y = pdfSection(doc, 'Closing Balances (end of month)', y);
  pdfTable(doc, summaryCols, [
    ['Cash in Hand', inr(data.cashInHand)],
    ['Bank Balance', inr(data.bankBalance)],
    ['Total', inr(data.cashInHand + data.bankBalance)],
  ], y);

  doc.save(`month-sheet-${data.monthKey}.pdf`);
}

/* ── PDF: defaulter list ──────────────────────────────────────────────── */

export async function exportDefaulterListPdf(
  rows: DefaulterExportRow[],
  meta: DefaulterExportMeta,
): Promise<void> {
  const doc = await newPdf('l');
  const y = pdfTitle(doc, meta, `Defaulter Report — ${meta.generatedOn}`);
  const filters: string[] = [];
  if (meta.classFilter) filters.push(`Class: ${meta.classFilter}`);
  if (meta.minPending) filters.push(`Min pending: ${inr(meta.minPending)}`);
  if (filters.length > 0) {
    doc.text(filters.join('  •  '), PDF_MARGIN, y - 4);
  }

  pdfTable(doc, [
    { header: 'Adm No', width: 24 },
    { header: 'Student', width: 48 },
    { header: 'Class', width: 22 },
    { header: 'Sec', width: 14 },
    { header: 'Prev Bal', width: 24, align: 'right' },
    { header: 'Terms', width: 24, align: 'right' },
    { header: 'ECA (mo)', width: 28, align: 'right' },
    { header: 'Bus (mo)', width: 28, align: 'right' },
    { header: 'Addl', width: 22, align: 'right' },
    { header: 'Unalloc', width: 22, align: 'right' },
    { header: 'Total Due', width: 28, align: 'right' },
  ], [
    ...rows.map(r => [
      r.admissionNumber, r.student, r.className, r.section,
      inr(r.previousBalance), inr(r.terms),
      `${inr(r.eca)} (${r.ecaMonthsDue})`, `${inr(r.bus)} (${r.busMonthsDue})`,
      inr(r.additional), inr(r.unallocated), inr(r.totalDue),
    ]),
    ['Total', '', '', '',
      inr(rows.reduce((s, r) => s + r.previousBalance, 0)),
      inr(rows.reduce((s, r) => s + r.terms, 0)),
      inr(rows.reduce((s, r) => s + r.eca, 0)),
      inr(rows.reduce((s, r) => s + r.bus, 0)),
      inr(rows.reduce((s, r) => s + r.additional, 0)),
      inr(rows.reduce((s, r) => s + r.unallocated, 0)),
      inr(rows.reduce((s, r) => s + r.totalDue, 0))],
  ], y);

  doc.save(`defaulters-${meta.generatedOn}.pdf`);
}

/* ── Principal Register: arrears export ───────────────────────────────── */

/**
 * Arrears row for the STANDALONE Principal Register (School / ECA / Van).
 * Deliberately a separate type from `DefaulterExportRow`: that one describes
 * the legacy fee module's buckets (previous balance, terms, bus, unallocated),
 * and merging the two would force every field optional in both. Both export
 * pairs share the same sheet/PDF plumbing below, and `DefaulterExportMeta` is
 * reused unchanged, so existing callers are untouched.
 */
export interface PrincipalArrearsExportRow {
  rollNo: string;
  student: string;
  className: string;
  section: string;
  /** School fee still unpaid — due from day one. */
  school: number;
  /** ECA months that have ENDED and are still unpaid. */
  eca: number;
  ecaMonthsDue: number;
  /** Van months that have ENDED and are still unpaid. */
  van: number;
  vanMonthsDue: number;
  /** Distinct ECA/van months behind — how far back the arrears go. */
  monthsBehind: number;
  /** What can be chased TODAY. */
  dueNow: number;
  /** Everything unpaid, including months that have not ended yet. */
  pending: number;
}

const ARREARS_HEADERS = [
  'Roll No', 'Student', 'Class', 'Section', 'School Due',
  'ECA Due', 'ECA Months', 'Van Due', 'Van Months', 'Months Behind',
  'Due Now', 'Total Pending',
];

const sumBy = <T,>(rows: T[], pick: (row: T) => number): number =>
  rows.reduce((total, row) => total + pick(row), 0);

function arrearsFilters(meta: DefaulterExportMeta, money: (n: number) => string): string[] {
  const filters: string[] = [];
  if (meta.classFilter) filters.push(`Class: ${meta.classFilter}`);
  if (meta.minPending) filters.push(`Min due: ${money(meta.minPending)}`);
  return filters;
}

export async function exportPrincipalArrearsExcel(
  rows: PrincipalArrearsExportRow[],
  meta: DefaulterExportMeta,
): Promise<void> {
  const wb = await newWorkbook();
  const ws = wb.addWorksheet('Arrears');
  ws.columns = [
    { width: 10 }, { width: 26 }, { width: 12 }, { width: 10 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
    { width: 13 }, { width: 14 },
  ];

  const row = addSheetTitle(ws, meta, `Fee Arrears — ${meta.generatedOn}`);
  const filters = arrearsFilters(meta, value => String(value));
  if (filters.length > 0) ws.getCell(row - 1, 1).value = filters.join(' • ');

  addSheetTable(ws, row, ARREARS_HEADERS, [
    ...rows.map(r => [
      r.rollNo, r.student, r.className, r.section, r.school,
      r.eca, r.ecaMonthsDue, r.van, r.vanMonthsDue, r.monthsBehind,
      r.dueNow, r.pending,
    ] as (string | number)[]),
    ['Total', '', '', '',
      sumBy(rows, r => r.school),
      sumBy(rows, r => r.eca), '',
      sumBy(rows, r => r.van), '', '',
      sumBy(rows, r => r.dueNow),
      sumBy(rows, r => r.pending)],
  ], [4, 5, 7, 10, 11]);

  await downloadWorkbook(wb, `arrears-${meta.generatedOn}.xlsx`);
}

export async function exportPrincipalArrearsPdf(
  rows: PrincipalArrearsExportRow[],
  meta: DefaulterExportMeta,
): Promise<void> {
  const doc = await newPdf('l');
  const y = pdfTitle(doc, meta, `Fee Arrears — ${meta.generatedOn}`);
  const filters = arrearsFilters(meta, inr);
  if (filters.length > 0) doc.text(filters.join('  •  '), PDF_MARGIN, y - 4);

  pdfTable(doc, [
    { header: 'Roll', width: 18 },
    { header: 'Student', width: 52 },
    { header: 'Class', width: 24 },
    { header: 'Sec', width: 16 },
    { header: 'School Due', width: 28, align: 'right' },
    { header: 'ECA Due (mo)', width: 32, align: 'right' },
    { header: 'Van Due (mo)', width: 32, align: 'right' },
    { header: 'Months Behind', width: 28, align: 'right' },
    { header: 'Due Now', width: 28, align: 'right' },
    { header: 'Pending', width: 28, align: 'right' },
  ], [
    ...rows.map(r => [
      r.rollNo, r.student, r.className, r.section,
      inr(r.school),
      `${inr(r.eca)} (${r.ecaMonthsDue})`,
      `${inr(r.van)} (${r.vanMonthsDue})`,
      String(r.monthsBehind),
      inr(r.dueNow), inr(r.pending),
    ]),
    ['Total', '', '', '',
      inr(sumBy(rows, r => r.school)),
      inr(sumBy(rows, r => r.eca)),
      inr(sumBy(rows, r => r.van)),
      '',
      inr(sumBy(rows, r => r.dueNow)),
      inr(sumBy(rows, r => r.pending))],
  ], y);

  doc.save(`arrears-${meta.generatedOn}.pdf`);
}

/* ── Expense report (Income & Expense → Expenses tab) ─────────────────── */

/** One expense entry as it appears in the report's itemised list. */
export interface ExpenseReportExportRow {
  dateKey: string;
  category: string;
  description: string;
  mode: string;
  enteredBy: string;
  amount: number;
}

export interface ExpenseReportCategoryRow {
  category: string;
  count: number;
  cash: number;
  bank: number;
  total: number;
  /** Percent of the window's total spend, 0–100. */
  share: number;
}

/**
 * Category roll-up + every entry behind it, for one date window. Totals arrive
 * already computed by `computeExpenseReport` — nothing is re-added here, so the
 * file can never disagree with the screen it was exported from.
 */
export interface ExpenseReportData {
  schoolName: string;
  academicYear: string;
  fromKey: string;
  toKey: string;
  categories: ExpenseReportCategoryRow[];
  entries: ExpenseReportExportRow[];
  totalCash: number;
  totalBank: number;
  total: number;
  count: number;
}

const CATEGORY_HEADERS = ['Category', 'Entries', 'Cash', 'Bank', 'Total', 'Share %'];
const ENTRY_HEADERS = ['Date', 'Category', 'Description', 'Mode', 'Entered By', 'Amount'];

const sharePct = (share: number): string => `${share.toFixed(1)}%`;
const expenseFileStem = (data: ExpenseReportData): string =>
  `expense-report-${data.fromKey}-to-${data.toKey}`;

export async function exportExpenseReportExcel(data: ExpenseReportData): Promise<void> {
  const wb = await newWorkbook();
  const ws = wb.addWorksheet('Expense Report');
  ws.columns = [
    { width: 14 }, { width: 26 }, { width: 40 }, { width: 12 },
    { width: 22 }, { width: 14 },
  ];

  let row = addSheetTitle(ws, data, `Expense Report — ${data.fromKey} to ${data.toKey}`);

  ws.getCell(row, 1).value = 'Summary';
  ws.getCell(row, 1).font = SECTION_FONT;
  row = addSheetTable(ws, row + 1, ['', 'Amount'], [
    ['Cash spent', data.totalCash],
    ['Bank spent', data.totalBank],
    ['Total spent', data.total],
    ['Entries', data.count],
  ], [1]);
  row += 1;

  ws.getCell(row, 1).value = 'By Category';
  ws.getCell(row, 1).font = SECTION_FONT;
  row = addSheetTable(ws, row + 1, CATEGORY_HEADERS, [
    ...data.categories.map(c => [
      c.category, c.count, c.cash, c.bank, c.total, sharePct(c.share),
    ] as (string | number)[]),
    ['Total', data.count, data.totalCash, data.totalBank, data.total,
      data.total > 0 ? '100.0%' : '0.0%'],
  ], [2, 3, 4]);
  row += 1;

  ws.getCell(row, 1).value = 'All Entries';
  ws.getCell(row, 1).font = SECTION_FONT;
  addSheetTable(ws, row + 1, ENTRY_HEADERS,
    data.entries.map(e => [
      e.dateKey, e.category, e.description, e.mode, e.enteredBy, e.amount,
    ] as (string | number)[]),
    [5]);

  await downloadWorkbook(wb, `${expenseFileStem(data)}.xlsx`);
}

export async function exportExpenseReportPdf(data: ExpenseReportData): Promise<void> {
  const doc = await newPdf('p');
  let y = pdfTitle(doc, data, `Expense Report — ${data.fromKey} to ${data.toKey}`);

  const summaryCols: PdfCol[] = [
    { header: '', width: 90 },
    { header: 'Amount', width: 60, align: 'right' },
  ];
  y = pdfSection(doc, 'Summary', y);
  y = pdfTable(doc, summaryCols, [
    ['Cash spent', inr(data.totalCash)],
    ['Bank spent', inr(data.totalBank)],
    ['Total spent', inr(data.total)],
    ['Entries', String(data.count)],
  ], y) + 4;

  y = pdfSection(doc, 'By Category', y);
  y = pdfTable(doc, [
    { header: 'Category', width: 54 },
    { header: 'Entries', width: 20, align: 'right' },
    { header: 'Cash', width: 30, align: 'right' },
    { header: 'Bank', width: 30, align: 'right' },
    { header: 'Total', width: 32, align: 'right' },
    { header: 'Share', width: 20, align: 'right' },
  ], [
    ...data.categories.map(c => [
      c.category, String(c.count), inr(c.cash), inr(c.bank), inr(c.total), sharePct(c.share),
    ]),
    ['Total', String(data.count), inr(data.totalCash), inr(data.totalBank), inr(data.total),
      data.total > 0 ? '100.0%' : '0.0%'],
  ], y) + 4;

  y = pdfSection(doc, 'All Entries', y);
  pdfTable(doc, [
    { header: 'Date', width: 24 },
    { header: 'Category', width: 40 },
    { header: 'Description', width: 60 },
    { header: 'Mode', width: 20 },
    { header: 'Amount', width: 30, align: 'right' },
  ], data.entries.map(e => [
    e.dateKey, e.category, e.description, e.mode, inr(e.amount),
  ]), y);

  doc.save(`${expenseFileStem(data)}.pdf`);
}

/* ── Daily Billing & Expense Report ───────────────────────────────────── */

/**
 * ONE report object, consumed by BOTH exporters, so the PDF and the Excel can
 * never disagree about a total. The caller builds it once from the engine's
 * ledger output; neither exporter re-adds any money.
 */
export interface DailyFinanceReport {
  schoolName: string;
  academicYear: string;
  /** 'yyyy-MM-dd' — the business date this report covers. */
  dateKey: string;
  /** '01 September 2026' — the printed date. */
  dateLabel: string;
  /** When the file was produced. */
  generatedAt: string;
  preparedBy: string;
  billing: {
    time: string;
    student: string;
    className: string;
    section: string;
    teacher: string;
    head: string;
    month: string;
    method: string;
    amount: number;
  }[];
  expenses: {
    time: string;
    payee: string;
    purpose: string;
    category: string;
    method: string;
    amount: number;
  }[];
  /** Per-method billing / expenses / net — from computeModeTotals. */
  methodRows: { method: string; billing: number; expenses: number; net: number }[];
  billingTotal: number;
  expenseTotal: number;
  netTotal: number;
  cashInHand: number;
  bankBalance: number;
}

const REPORT_TITLE = 'DAILY BILLING & EXPENSE REPORT';

/* Palette + rules shared by the report's Excel and PDF renderers. */
const XLS_BORDER_THIN = { style: 'thin', color: { argb: 'FFB0B0B0' } } as const;
const XLS_TITLE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } } as const;
const XLS_SECTION_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } } as const;
const XLS_HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } } as const;
const XLS_MONEY = '#,##0.00';

const boxAll = () => ({
  top: XLS_BORDER_THIN, bottom: XLS_BORDER_THIN, left: XLS_BORDER_THIN, right: XLS_BORDER_THIN,
});

/** Merge A..lastCol on `row` and write a styled banner into it. */
function bannerRow(
  ws: any, row: number, lastCol: string, text: string,
  opts: { fill?: any; color?: string; size?: number; height?: number } = {},
): void {
  ws.mergeCells(`A${row}:${lastCol}${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = text;
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.font = { bold: true, size: opts.size ?? 12, color: { argb: opts.color ?? 'FF000000' } };
  if (opts.fill) cell.fill = opts.fill;
  ws.getRow(row).height = opts.height ?? 20;
}

export async function exportDailyFinanceReportExcel(report: DailyFinanceReport): Promise<void> {
  const wb = await newWorkbook();
  const ws = wb.addWorksheet('Daily Report', {
    pageSetup: {
      orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  /* One column grid serves four different tables, so every width has to suit
     the WIDEST thing that lands in it — column A carries both "Sl. No." and
     "GPay / UPI", and the money columns must never render as #####. */
  const LAST = 'I';
  ws.columns = [
    { width: 14 }, // Sl. No.  /  Payment method name
    { width: 30 }, // Student  /  Payee  /  Billing amount
    { width: 18 }, // Class    /  Purpose (merged onward)  /  Expenses amount
    { width: 18 }, // Section  /  Category  /  Net amount
    { width: 24 }, // Teacher
    { width: 18 }, // Fee head
    { width: 14 }, // Month
    { width: 18 }, // Payment method
    { width: 18 }, // Amount
  ];

  /* ── Title block ── */
  bannerRow(ws, 1, LAST, report.schoolName, { fill: XLS_TITLE_FILL, color: 'FFFFFFFF', size: 15, height: 26 });
  bannerRow(ws, 2, LAST, REPORT_TITLE, { fill: XLS_SECTION_FILL, size: 12, height: 22 });

  ws.getCell('A3').value = 'Report Date';
  ws.getCell('B3').value = report.dateLabel;
  ws.getCell('E3').value = 'Academic Year';
  ws.getCell('F3').value = report.academicYear;
  ws.getCell('A4').value = 'Generated On';
  ws.getCell('B4').value = report.generatedAt;
  ws.getCell('E4').value = 'Prepared By';
  ws.getCell('F4').value = report.preparedBy;
  for (const ref of ['A3', 'E3', 'A4', 'E4']) ws.getCell(ref).font = { bold: true };

  /* ── Summary ── */
  let row = 6;
  bannerRow(ws, row, LAST, 'DAILY SUMMARY', { fill: XLS_SECTION_FILL, size: 11, height: 18 });
  row += 1;
  const summary: [string, number][] = [
    ['Total Billing (money received)', report.billingTotal],
    ['Total Expenses (money spent)', report.expenseTotal],
    ['Net Amount (billing - expenses)', report.netTotal],
  ];
  for (const [label, amount] of summary) {
    ws.mergeCells(`A${row}:E${row}`);
    const labelCell = ws.getCell(`A${row}`);
    labelCell.value = label;
    labelCell.font = { bold: label.startsWith('Net') };
    labelCell.border = boxAll();
    ws.mergeCells(`F${row}:${LAST}${row}`);
    const amountCell = ws.getCell(`F${row}`);
    amountCell.value = amount;
    amountCell.numFmt = XLS_MONEY;
    amountCell.alignment = { horizontal: 'right' };
    amountCell.font = { bold: true };
    amountCell.border = boxAll();
    row += 1;
  }
  row += 1;

  /* ── Billing table ── */
  bannerRow(ws, row, LAST, 'BILLING / INCOME DETAILS', { fill: XLS_SECTION_FILL, size: 11, height: 18 });
  row += 1;
  const billingHeaders = ['Sl. No.', 'Student Name', 'Class', 'Section', 'Teacher', 'Fee Head', 'Month', 'Payment Method', 'Amount Received'];
  writeReportHeader(ws, row, billingHeaders);
  row += 1;
  if (report.billing.length === 0) {
    ws.mergeCells(`A${row}:${LAST}${row}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = 'No billing recorded for this date.';
    cell.alignment = { horizontal: 'center' };
    cell.border = boxAll();
    row += 1;
  } else {
    report.billing.forEach((entry, index) => {
      writeReportRow(ws, row, [
        index + 1, entry.student, entry.className || '-', entry.section || '-',
        entry.teacher || '-', entry.head, entry.month || '-', entry.method, entry.amount,
      ], [8]);
      row += 1;
    });
    writeReportTotal(ws, row, LAST, 'Total Billing', report.billingTotal);
    row += 1;
  }
  row += 1;

  /* ── Expense table ── */
  bannerRow(ws, row, LAST, 'EXPENSE DETAILS', { fill: XLS_SECTION_FILL, size: 11, height: 18 });
  row += 1;
  /* Purpose is free text and needs room, so it spans C..F on every expense
     row (header included) instead of being clipped into one narrow column. */
  writeReportHeader(ws, row, ['Sl. No.', 'Payee', 'Purpose', '', '', '', 'Category', 'Payment Method', 'Amount']);
  ws.mergeCells(`C${row}:F${row}`);
  row += 1;
  if (report.expenses.length === 0) {
    ws.mergeCells(`A${row}:${LAST}${row}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = 'No expenses recorded for this date.';
    cell.alignment = { horizontal: 'center' };
    cell.border = boxAll();
    row += 1;
  } else {
    report.expenses.forEach((entry, index) => {
      writeReportRow(ws, row, [
        index + 1, entry.payee || '-', entry.purpose || '-', '', '', '',
        entry.category, entry.method, entry.amount,
      ], [8]);
      ws.mergeCells(`C${row}:F${row}`);
      ws.getCell(`C${row}`).alignment = { horizontal: 'left', wrapText: true };
      row += 1;
    });
    writeReportTotal(ws, row, LAST, 'Total Expenses', report.expenseTotal);
    row += 1;
  }
  row += 1;

  /* ── Payment-method summary ── */
  bannerRow(ws, row, LAST, 'PAYMENT METHOD SUMMARY', { fill: XLS_SECTION_FILL, size: 11, height: 18 });
  row += 1;
  writeReportHeader(ws, row, ['Method', 'Billing', 'Expenses', 'Net', '', '', '', '', '']);
  row += 1;
  for (const entry of report.methodRows) {
    writeReportRow(ws, row, [
      entry.method, entry.billing, entry.expenses, entry.net, '', '', '', '', '',
    ], [1, 2, 3]);
    row += 1;
  }
  writeReportRow(ws, row, [
    'TOTAL', report.billingTotal, report.expenseTotal, report.netTotal, '', '', '', '', '',
  ], [1, 2, 3], true);
  row += 2;

  /* ── Closing position + signature ── */
  bannerRow(ws, row, LAST, 'CLOSING POSITION (end of day)', { fill: XLS_SECTION_FILL, size: 11, height: 18 });
  row += 1;
  for (const [label, amount] of [
    ['Cash in Hand', report.cashInHand],
    ['Bank Balance (GPay / UPI, Bank, Other)', report.bankBalance],
    ['Total in Hand', report.cashInHand + report.bankBalance],
  ] as [string, number][]) {
    ws.mergeCells(`A${row}:E${row}`);
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).border = boxAll();
    ws.mergeCells(`F${row}:${LAST}${row}`);
    const cell = ws.getCell(`F${row}`);
    cell.value = amount;
    cell.numFmt = XLS_MONEY;
    cell.alignment = { horizontal: 'right' };
    cell.border = boxAll();
    row += 1;
  }
  row += 2;
  ws.getCell(`A${row}`).value = 'Prepared By: ______________________';
  ws.getCell(`F${row}`).value = 'Signature: ______________________';

  /* NO frozen pane: this is a single-page report, and pinning the header block
     made Excel repeat it above the split — it read as two copies of the same
     report. The month's long detail sheets keep their freeze; this one must not. */
  ws.pageSetup.printArea = `A1:${LAST}${row}`;

  await downloadWorkbook(wb, `daily-billing-expense-${report.dateKey}.xlsx`);
}

/** Bold, filled, bordered, wrapped header band for a report table. */
function writeReportHeader(ws: any, row: number, headers: string[]): void {
  headers.forEach((header, index) => {
    const cell = ws.getRow(row).getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 10 };
    cell.fill = XLS_HEAD_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = boxAll();
  });
  // Tall enough for a two-line wrapped header ("Payment / Method") to show
  // fully — a clipped header is what makes a sheet look broken.
  ws.getRow(row).height = 32;
}

function writeReportRow(
  ws: any, row: number, values: (string | number)[], moneyCols: number[], bold = false,
): void {
  values.forEach((value, index) => {
    const cell = ws.getRow(row).getCell(index + 1);
    cell.value = value === '' ? null : value;
    cell.border = boxAll();
    if (bold) cell.font = { bold: true };
    if (moneyCols.includes(index)) {
      cell.numFmt = XLS_MONEY;
      cell.alignment = { horizontal: 'right' };
    } else if (index === 0) {
      cell.alignment = { horizontal: 'center' };
    }
  });
}

function writeReportTotal(ws: any, row: number, lastCol: string, label: string, amount: number): void {
  ws.mergeCells(`A${row}:H${row}`);
  const labelCell = ws.getCell(`A${row}`);
  labelCell.value = label;
  labelCell.font = { bold: true };
  labelCell.alignment = { horizontal: 'right' };
  labelCell.border = boxAll();
  const cell = ws.getCell(`${lastCol}${row}`);
  cell.value = amount;
  cell.numFmt = XLS_MONEY;
  cell.font = { bold: true };
  cell.alignment = { horizontal: 'right' };
  cell.border = boxAll();
}

export async function exportDailyFinanceReportPdf(report: DailyFinanceReport): Promise<void> {
  const doc = await newPdf('l');
  const pageW = doc.internal.pageSize.getWidth();
  const right = pageW - PDF_MARGIN;

  /* ── Title block ── */
  doc.setFillColor(31, 78, 121);
  doc.rect(PDF_MARGIN, 10, pageW - PDF_MARGIN * 2, 11, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(report.schoolName, pageW / 2, 17.5, { align: 'center' });
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(REPORT_TITLE, pageW / 2, 27, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Report Date   :  ${report.dateLabel}`, PDF_MARGIN, 34);
  doc.text(`Academic Year :  ${report.academicYear}`, pageW / 2 + 10, 34);
  doc.text(`Generated On  :  ${report.generatedAt}`, PDF_MARGIN, 39);
  doc.text(`Prepared By   :  ${report.preparedBy}`, pageW / 2 + 10, 39);
  doc.setDrawColor(150);
  doc.line(PDF_MARGIN, 42, right, 42);

  /* ── Summary strip: three boxes ── */
  let y = 47;
  const boxW = (pageW - PDF_MARGIN * 2 - 8) / 3;
  const boxes: [string, number][] = [
    ['TOTAL BILLING', report.billingTotal],
    ['TOTAL EXPENSES', report.expenseTotal],
    ['NET AMOUNT', report.netTotal],
  ];
  boxes.forEach(([label, amount], index) => {
    const x = PDF_MARGIN + index * (boxW + 4);
    doc.setFillColor(244, 246, 249);
    doc.rect(x, y, boxW, 16, 'F');
    doc.setDrawColor(180);
    doc.rect(x, y, boxW, 16);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 3, y + 6);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(inr(amount), x + boxW - 3, y + 13, { align: 'right' });
  });
  y += 22;

  /* ── Billing table ── */
  y = pdfSection(doc, 'BILLING / INCOME DETAILS', y);
  if (report.billing.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No billing recorded for this date.', PDF_MARGIN + 2, y + 2);
    doc.setFont('helvetica', 'normal');
    y += 8;
  } else {
    y = pdfTable(doc, [
      { header: 'Sl.', width: 10 },
      { header: 'Time', width: 16 },
      { header: 'Student Name', width: 46 },
      { header: 'Class', width: 18 },
      { header: 'Sec', width: 12 },
      { header: 'Teacher', width: 40 },
      { header: 'Fee Head', width: 26 },
      { header: 'Month', width: 20 },
      { header: 'Method', width: 24 },
      { header: 'Amount', width: 28, align: 'right' },
    ], report.billing.map((entry, index) => [
      String(index + 1), entry.time || '-', entry.student, entry.className || '-',
      entry.section || '-', entry.teacher || '-', entry.head, entry.month || '-',
      entry.method, inr(entry.amount),
    ]), y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Total Billing:  ${inr(report.billingTotal)}`, right, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 10;
  }

  /* ── Expense table ── */
  y = pdfSection(doc, 'EXPENSE DETAILS', y);
  if (report.expenses.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No expenses recorded for this date.', PDF_MARGIN + 2, y + 2);
    doc.setFont('helvetica', 'normal');
    y += 8;
  } else {
    y = pdfTable(doc, [
      { header: 'Sl.', width: 10 },
      { header: 'Time', width: 16 },
      { header: 'Payee', width: 44 },
      { header: 'Purpose', width: 70 },
      { header: 'Category', width: 32 },
      { header: 'Method', width: 24 },
      { header: 'Amount', width: 28, align: 'right' },
    ], report.expenses.map((entry, index) => [
      String(index + 1), entry.time || '-', entry.payee || '-', entry.purpose || '-',
      entry.category, entry.method, inr(entry.amount),
    ]), y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Total Expenses:  ${inr(report.expenseTotal)}`, right, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 10;
  }

  /* ── Method summary + closing position ── */
  y = pdfSection(doc, 'PAYMENT METHOD SUMMARY', y);
  y = pdfTable(doc, [
    { header: 'Method', width: 40 },
    { header: 'Billing', width: 32, align: 'right' },
    { header: 'Expenses', width: 32, align: 'right' },
    { header: 'Net', width: 32, align: 'right' },
  ], [
    ...report.methodRows.map(entry => [
      entry.method, inr(entry.billing), inr(entry.expenses), inr(entry.net),
    ]),
    ['TOTAL', inr(report.billingTotal), inr(report.expenseTotal), inr(report.netTotal)],
  ], y) + 4;

  y = pdfSection(doc, 'CLOSING POSITION (end of day)', y);
  y = pdfTable(doc, [
    { header: 'Position', width: 60 },
    { header: 'Amount', width: 36, align: 'right' },
  ], [
    ['Cash in Hand', inr(report.cashInHand)],
    ['Bank Balance (GPay / UPI, Bank, Other)', inr(report.bankBalance)],
    ['Total in Hand', inr(report.cashInHand + report.bankBalance)],
  ], y) + 12;

  /* ── Signatures ── */
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 30) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.line(PDF_MARGIN, y, PDF_MARGIN + 60, y);
  doc.text('Prepared By (Principal)', PDF_MARGIN, y + 5);
  doc.line(right - 60, y, right, y);
  doc.text('Signature', right - 60, y + 5);
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text(
    'This is a computer generated record of money physically received and spent by the school.',
    pageW / 2, y + 14, { align: 'center' },
  );
  doc.setTextColor(0);

  doc.save(`daily-billing-expense-${report.dateKey}.pdf`);
}

/* ── Monthly Billing & Expense Report ─────────────────────────────────── */

/**
 * The month's version of DailyFinanceReport — same sections, same shared-object
 * rule (both exporters read this one object, so their totals cannot diverge).
 * `dailyBreakdown` comes straight from computeMonthlyLedger().days; no second
 * calculation exists anywhere.
 */
export interface MonthlyFinanceReport {
  schoolName: string;
  academicYear: string;
  /** 'yyyy-MM'. */
  monthKey: string;
  /** 'September 2026'. */
  monthLabel: string;
  /** '01 September 2026 - 30 September 2026'. */
  periodLabel: string;
  generatedAt: string;
  preparedBy: string;
  billing: {
    date: string;
    student: string;
    className: string;
    section: string;
    teacher: string;
    head: string;
    month: string;
    method: string;
    amount: number;
  }[];
  expenses: {
    date: string;
    payee: string;
    purpose: string;
    category: string;
    method: string;
    amount: number;
  }[];
  methodRows: { method: string; billing: number; expenses: number; net: number }[];
  /** One row per day that saw activity, oldest first. */
  dailyBreakdown: { date: string; billing: number; expenses: number; net: number }[];
  billingTotal: number;
  expenseTotal: number;
  netTotal: number;
  cashInHand: number;
  bankBalance: number;
}

const MONTHLY_TITLE = 'MONTHLY BILLING & EXPENSE REPORT';

export async function exportMonthlyFinanceReportExcel(report: MonthlyFinanceReport): Promise<void> {
  const wb = await newWorkbook();
  const landscape = {
    orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  } as const;

  /* ── Sheet 1: Monthly Summary ── */
  const ws = wb.addWorksheet('Monthly Summary', { pageSetup: { ...landscape } });
  const LAST = 'F';
  ws.columns = [{ width: 30 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 16 }, { width: 16 }];

  bannerRow(ws, 1, LAST, report.schoolName, { fill: XLS_TITLE_FILL, color: 'FFFFFFFF', size: 15, height: 26 });
  bannerRow(ws, 2, LAST, MONTHLY_TITLE, { fill: XLS_SECTION_FILL, size: 12, height: 22 });

  ws.getCell('A3').value = 'Report Period';
  ws.getCell('B3').value = report.periodLabel;
  ws.getCell('A4').value = 'Academic Year';
  ws.getCell('B4').value = report.academicYear;
  ws.getCell('D3').value = 'Generated On';
  ws.getCell('E3').value = report.generatedAt;
  ws.getCell('D4').value = 'Prepared By';
  ws.getCell('E4').value = report.preparedBy;
  for (const ref of ['A3', 'A4', 'D3', 'D4']) ws.getCell(ref).font = { bold: true };

  let row = 6;
  bannerRow(ws, row, LAST, 'MONTHLY SUMMARY', { fill: XLS_SECTION_FILL, size: 11, height: 18 });
  row += 1;
  for (const [label, amount] of [
    ['Total Billing (money received)', report.billingTotal],
    ['Total Expenses (money spent)', report.expenseTotal],
    ['Net Amount (billing - expenses)', report.netTotal],
  ] as [string, number][]) {
    ws.mergeCells(`A${row}:C${row}`);
    const labelCell = ws.getCell(`A${row}`);
    labelCell.value = label;
    labelCell.font = { bold: label.startsWith('Net') };
    labelCell.border = boxAll();
    ws.mergeCells(`D${row}:${LAST}${row}`);
    const cell = ws.getCell(`D${row}`);
    cell.value = amount;
    cell.numFmt = XLS_MONEY;
    cell.alignment = { horizontal: 'right' };
    cell.font = { bold: true };
    cell.border = boxAll();
    row += 1;
  }
  row += 1;

  bannerRow(ws, row, LAST, 'PAYMENT METHOD SUMMARY', { fill: XLS_SECTION_FILL, size: 11, height: 18 });
  row += 1;
  writeReportHeader(ws, row, ['Payment Method', 'Billing', 'Expenses', 'Net', '', '']);
  row += 1;
  for (const entry of report.methodRows) {
    writeReportRow(ws, row, [entry.method, entry.billing, entry.expenses, entry.net, '', ''], [1, 2, 3]);
    row += 1;
  }
  writeReportRow(ws, row,
    ['TOTAL', report.billingTotal, report.expenseTotal, report.netTotal, '', ''], [1, 2, 3], true);
  row += 2;

  bannerRow(ws, row, LAST, 'DAY-BY-DAY BREAKDOWN', { fill: XLS_SECTION_FILL, size: 11, height: 18 });
  row += 1;
  writeReportHeader(ws, row, ['Date', 'Billing', 'Expenses', 'Net', '', '']);
  row += 1;
  if (report.dailyBreakdown.length === 0) {
    ws.mergeCells(`A${row}:${LAST}${row}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = 'No transactions recorded in this month.';
    cell.alignment = { horizontal: 'center' };
    cell.border = boxAll();
    row += 1;
  } else {
    for (const day of report.dailyBreakdown) {
      writeReportRow(ws, row, [day.date, day.billing, day.expenses, day.net, '', ''], [1, 2, 3]);
      row += 1;
    }
    writeReportRow(ws, row,
      ['TOTAL', report.billingTotal, report.expenseTotal, report.netTotal, '', ''], [1, 2, 3], true);
    row += 1;
  }
  row += 1;

  bannerRow(ws, row, LAST, 'CLOSING POSITION (end of month)', { fill: XLS_SECTION_FILL, size: 11, height: 18 });
  row += 1;
  for (const [label, amount] of [
    ['Cash in Hand', report.cashInHand],
    ['Bank Balance (GPay / UPI, Bank, Other)', report.bankBalance],
    ['Total in Hand', report.cashInHand + report.bankBalance],
  ] as [string, number][]) {
    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).border = boxAll();
    ws.mergeCells(`D${row}:${LAST}${row}`);
    const cell = ws.getCell(`D${row}`);
    cell.value = amount;
    cell.numFmt = XLS_MONEY;
    cell.alignment = { horizontal: 'right' };
    cell.border = boxAll();
    row += 1;
  }
  row += 2;
  ws.getCell(`A${row}`).value = 'Prepared By: ______________________';
  ws.getCell(`D${row}`).value = 'Signature: ______________________';

  /* ── Sheet 2: Billing details ── */
  const bs = wb.addWorksheet('Billing Details', { pageSetup: { ...landscape } });
  bs.columns = [
    { width: 7 }, { width: 16 }, { width: 28 }, { width: 14 }, { width: 10 },
    { width: 22 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 },
  ];
  bannerRow(bs, 1, 'J', `${report.schoolName} — Billing Details — ${report.monthLabel}`,
    { fill: XLS_TITLE_FILL, color: 'FFFFFFFF', size: 12, height: 24 });
  writeReportHeader(bs, 3, [
    'Sl. No.', 'Date', 'Student Name', 'Class', 'Section',
    'Teacher', 'Fee Head', 'Month', 'Payment Method', 'Amount Received',
  ]);
  let brow = 4;
  if (report.billing.length === 0) {
    bs.mergeCells(`A${brow}:J${brow}`);
    const cell = bs.getCell(`A${brow}`);
    cell.value = 'No billing recorded in this month.';
    cell.alignment = { horizontal: 'center' };
    cell.border = boxAll();
  } else {
    report.billing.forEach((entry, index) => {
      writeReportRow(bs, brow, [
        index + 1, entry.date, entry.student, entry.className || '-', entry.section || '-',
        entry.teacher || '-', entry.head, entry.month || '-', entry.method, entry.amount,
      ], [9]);
      brow += 1;
    });
    writeReportTotal(bs, brow, 'J', 'TOTAL MONTHLY BILLING', report.billingTotal);
  }
  bs.views = [{ state: 'frozen', ySplit: 3 }];

  /* ── Sheet 3: Expense details ── */
  const es = wb.addWorksheet('Expense Details', { pageSetup: { ...landscape } });
  es.columns = [
    { width: 7 }, { width: 16 }, { width: 26 }, { width: 40 },
    { width: 20 }, { width: 16 }, { width: 16 },
  ];
  bannerRow(es, 1, 'G', `${report.schoolName} — Expense Details — ${report.monthLabel}`,
    { fill: XLS_TITLE_FILL, color: 'FFFFFFFF', size: 12, height: 24 });
  writeReportHeader(es, 3, [
    'Sl. No.', 'Date', 'Payee', 'Purpose', 'Category', 'Payment Method', 'Amount',
  ]);
  let erow = 4;
  if (report.expenses.length === 0) {
    es.mergeCells(`A${erow}:G${erow}`);
    const cell = es.getCell(`A${erow}`);
    cell.value = 'No expenses recorded in this month.';
    cell.alignment = { horizontal: 'center' };
    cell.border = boxAll();
  } else {
    report.expenses.forEach((entry, index) => {
      writeReportRow(es, erow, [
        index + 1, entry.date, entry.payee || '-', entry.purpose || '-',
        entry.category, entry.method, entry.amount,
      ], [6]);
      erow += 1;
    });
    writeReportTotal(es, erow, 'G', 'TOTAL MONTHLY EXPENSES', report.expenseTotal);
  }
  es.views = [{ state: 'frozen', ySplit: 3 }];

  await downloadWorkbook(wb, `monthly-billing-expense-${report.monthKey}.xlsx`);
}

export async function exportMonthlyFinanceReportPdf(report: MonthlyFinanceReport): Promise<void> {
  const doc = await newPdf('l');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const right = pageW - PDF_MARGIN;

  doc.setFillColor(31, 78, 121);
  doc.rect(PDF_MARGIN, 10, pageW - PDF_MARGIN * 2, 11, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(report.schoolName, pageW / 2, 17.5, { align: 'center' });
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(MONTHLY_TITLE, pageW / 2, 27, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Report Period :  ${report.periodLabel}`, PDF_MARGIN, 34);
  doc.text(`Academic Year :  ${report.academicYear}`, pageW / 2 + 10, 34);
  doc.text(`Generated On  :  ${report.generatedAt}`, PDF_MARGIN, 39);
  doc.text(`Prepared By   :  ${report.preparedBy}`, pageW / 2 + 10, 39);
  doc.setDrawColor(150);
  doc.line(PDF_MARGIN, 42, right, 42);

  let y = 47;
  const boxW = (pageW - PDF_MARGIN * 2 - 8) / 3;
  ([
    ['TOTAL BILLING', report.billingTotal],
    ['TOTAL EXPENSES', report.expenseTotal],
    ['NET AMOUNT', report.netTotal],
  ] as [string, number][]).forEach(([label, amount], index) => {
    const x = PDF_MARGIN + index * (boxW + 4);
    doc.setFillColor(244, 246, 249);
    doc.rect(x, y, boxW, 16, 'F');
    doc.setDrawColor(180);
    doc.rect(x, y, boxW, 16);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 3, y + 6);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(inr(amount), x + boxW - 3, y + 13, { align: 'right' });
  });
  y += 22;

  y = pdfSection(doc, 'PAYMENT METHOD SUMMARY', y);
  y = pdfTable(doc, [
    { header: 'Payment Method', width: 44 },
    { header: 'Billing', width: 34, align: 'right' },
    { header: 'Expenses', width: 34, align: 'right' },
    { header: 'Net', width: 34, align: 'right' },
  ], [
    ...report.methodRows.map(e => [e.method, inr(e.billing), inr(e.expenses), inr(e.net)]),
    ['TOTAL', inr(report.billingTotal), inr(report.expenseTotal), inr(report.netTotal)],
  ], y) + 4;

  y = pdfSection(doc, 'DAY-BY-DAY BREAKDOWN', y);
  if (report.dailyBreakdown.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No transactions recorded in this month.', PDF_MARGIN + 2, y + 2);
    doc.setFont('helvetica', 'normal');
    y += 8;
  } else {
    y = pdfTable(doc, [
      { header: 'Date', width: 40 },
      { header: 'Billing', width: 34, align: 'right' },
      { header: 'Expenses', width: 34, align: 'right' },
      { header: 'Net', width: 34, align: 'right' },
    ], [
      ...report.dailyBreakdown.map(d => [d.date, inr(d.billing), inr(d.expenses), inr(d.net)]),
      ['TOTAL', inr(report.billingTotal), inr(report.expenseTotal), inr(report.netTotal)],
    ], y) + 4;
  }

  /* Detail tables start on a fresh page — a month can be long. */
  doc.addPage();
  y = 16;
  y = pdfSection(doc, `BILLING / INCOME DETAILS — ${report.monthLabel}`, y);
  if (report.billing.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No billing recorded in this month.', PDF_MARGIN + 2, y + 2);
    doc.setFont('helvetica', 'normal');
    y += 8;
  } else {
    y = pdfTable(doc, [
      { header: 'Sl.', width: 10 },
      { header: 'Date', width: 26 },
      { header: 'Student Name', width: 44 },
      { header: 'Class', width: 18 },
      { header: 'Sec', width: 12 },
      { header: 'Teacher', width: 38 },
      { header: 'Fee Head', width: 24 },
      { header: 'Month', width: 20 },
      { header: 'Method', width: 22 },
      { header: 'Amount', width: 26, align: 'right' },
    ], report.billing.map((entry, index) => [
      String(index + 1), entry.date, entry.student, entry.className || '-', entry.section || '-',
      entry.teacher || '-', entry.head, entry.month || '-', entry.method, inr(entry.amount),
    ]), y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`TOTAL MONTHLY BILLING:  ${inr(report.billingTotal)}`, right, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 10;
  }

  y = pdfSection(doc, `EXPENSE DETAILS — ${report.monthLabel}`, y);
  if (report.expenses.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No expenses recorded in this month.', PDF_MARGIN + 2, y + 2);
    doc.setFont('helvetica', 'normal');
    y += 8;
  } else {
    y = pdfTable(doc, [
      { header: 'Sl.', width: 10 },
      { header: 'Date', width: 26 },
      { header: 'Payee', width: 42 },
      { header: 'Purpose', width: 66 },
      { header: 'Category', width: 30 },
      { header: 'Method', width: 22 },
      { header: 'Amount', width: 26, align: 'right' },
    ], report.expenses.map((entry, index) => [
      String(index + 1), entry.date, entry.payee || '-', entry.purpose || '-',
      entry.category, entry.method, inr(entry.amount),
    ]), y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`TOTAL MONTHLY EXPENSES:  ${inr(report.expenseTotal)}`, right, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 10;
  }

  if (y > pageH - 50) { doc.addPage(); y = 16; }
  y = pdfSection(doc, 'CLOSING POSITION (end of month)', y);
  y = pdfTable(doc, [
    { header: 'Position', width: 64 },
    { header: 'Amount', width: 36, align: 'right' },
  ], [
    ['Total Billing', inr(report.billingTotal)],
    ['Less: Total Expenses', inr(report.expenseTotal)],
    ['Net Amount', inr(report.netTotal)],
    ['Cash in Hand', inr(report.cashInHand)],
    ['Bank Balance (GPay / UPI, Bank, Other)', inr(report.bankBalance)],
  ], y) + 12;

  if (y > pageH - 30) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.line(PDF_MARGIN, y, PDF_MARGIN + 60, y);
  doc.text('Prepared By (Principal)', PDF_MARGIN, y + 5);
  doc.line(right - 60, y, right, y);
  doc.text('Signature', right - 60, y + 5);
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text(
    'This is a computer generated record of money physically received and spent by the school.',
    pageW / 2, y + 14, { align: 'center' },
  );
  doc.setTextColor(0);

  doc.save(`monthly-billing-expense-${report.monthKey}.pdf`);
}

/* ── Payment receipt (Phase 3 §19–§21) ────────────────────────────────── */

/**
 * Everything one receipt prints. `receiptRef` is the payment document's id —
 * collision-safe and honestly labelled "Receipt / Reference No.", NOT a
 * sequential counter (a client-side counter would race; see spec §21).
 * The balances come from computeReceiptSnapshot, so a reprint months later
 * still shows the numbers as they stood when the payment was recorded.
 */
export interface PaymentReceiptData {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  academicYear: string;
  receiptRef: string;
  /** The date the money was received — never the entry timestamp. */
  paymentDate: string;
  studentName: string;
  className: string;
  sectionName?: string;
  rollNo?: string;
  teacherName?: string;
  feeHead: string;
  month?: string;
  previousBalance: number;
  amountReceived: number;
  remainingBalance: number;
  paymentMethod: string;
  /** PENDING / PARTIAL / PAID. */
  status: string;
  recordedBy?: string;
  remarks?: string;
}

export async function exportPaymentReceiptPdf(data: PaymentReceiptData): Promise<void> {
  const doc = await newPdf('p');
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(data.schoolName, pageW / 2, 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = 24;
  if (data.schoolAddress) { doc.text(data.schoolAddress, pageW / 2, y, { align: 'center' }); y += 5; }
  if (data.schoolPhone) { doc.text(`Phone: ${data.schoolPhone}`, pageW / 2, y, { align: 'center' }); y += 5; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  y += 4;
  doc.text('PAYMENT RECEIPT', pageW / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 4;
  doc.line(PDF_MARGIN, y, pageW - PDF_MARGIN, y);
  y += 8;

  const label = (name: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.text(name, PDF_MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(value, pageW - PDF_MARGIN * 2 - 60)[0] ?? '', PDF_MARGIN + 58, y);
    y += 7;
  };

  label('Receipt / Reference No.', data.receiptRef);
  label('Payment Date', data.paymentDate);
  label('Academic Year', data.academicYear);
  y += 2;
  label('Student', data.studentName);
  label('Class', [data.className, data.sectionName].filter(Boolean).join(' · ') || '—');
  if (data.rollNo) label('Roll No.', data.rollNo);
  if (data.teacherName) label('Teacher', data.teacherName);
  y += 2;
  label('Fee Head', data.month ? `${data.feeHead} — ${data.month}` : data.feeHead);
  label('Payment Method', data.paymentMethod);

  // Money box: previous → received → remaining, with the received amount loud.
  y += 3;
  doc.setFillColor(245, 245, 245);
  doc.rect(PDF_MARGIN, y - 4, pageW - PDF_MARGIN * 2, 30, 'F');
  doc.setFont('helvetica', 'normal');
  doc.text('Previous Balance', PDF_MARGIN + 4, y + 2);
  doc.text(inr(data.previousBalance), pageW - PDF_MARGIN - 4, y + 2, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Amount Received', PDF_MARGIN + 4, y + 11);
  doc.text(inr(data.amountReceived), pageW - PDF_MARGIN - 4, y + 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Remaining Balance', PDF_MARGIN + 4, y + 20);
  doc.text(inr(data.remainingBalance), pageW - PDF_MARGIN - 4, y + 20, { align: 'right' });
  y += 34;

  label('Status', data.status);
  if (data.recordedBy) label('Recorded By', data.recordedBy);
  if (data.remarks) label('Remarks', data.remarks);

  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    'This receipt records money already received by the school. It is not an online payment.',
    PDF_MARGIN, y,
  );
  doc.setTextColor(0);

  const refTail = data.receiptRef.slice(-6);
  doc.save(`receipt-${data.paymentDate}-${refTail}.pdf`);
}

/* eslint-enable @typescript-eslint/no-explicit-any */
