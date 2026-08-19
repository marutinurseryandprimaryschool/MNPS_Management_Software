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
    student: string;
    className: string;
    /** 'School fee' | 'ECA fee' | 'Van fee' | 'Other'. */
    head: string;
    /** Academic month the receipt was tagged to ('' for school/other). */
    month: string;
    mode: string;
    enteredBy: string;
    amount: number;
  }[];
  expenses: {
    category: string;
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
  });
  rows.forEach((r, ri) => {
    const row = ws.getRow(startRow + 1 + ri);
    r.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      if (moneyCols.includes(ci)) cell.numFmt = XLSX_MONEY_FMT;
    });
  });
  return startRow + rows.length + 1;
}

function addSheetTitle(ws: any, meta: { schoolName: string; academicYear: string }, subtitle: string): number {
  ws.getCell('A1').value = meta.schoolName;
  ws.getCell('A1').font = TITLE_FONT;
  ws.getCell('A2').value = `${subtitle} — Academic Year ${meta.academicYear}`;
  ws.getCell('A2').font = SECTION_FONT;
  return 4;
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
    ['Student', 'Class', 'Head', 'Month', 'Mode', 'Received By', 'Amount'],
    data.payments.map(p => [p.student, p.className, p.head, p.month || '-', p.mode, p.enteredBy, p.amount]),
    [6]);
  row += 1;

  ws.getCell(row, 1).value = 'Expense Entries';
  ws.getCell(row, 1).font = SECTION_FONT;
  row = addSheetTable(ws, row + 1,
    ['Category', 'Description', 'Mode', 'Amount'],
    data.expenses.map(e => [e.category, e.description, e.mode, e.amount]),
    [3]);
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

function pdfTitle(doc: any, meta: { schoolName: string; academicYear: string }, subtitle: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(meta.schoolName, PDF_MARGIN, 16);
  doc.setFontSize(11);
  doc.text(`${subtitle} — Academic Year ${meta.academicYear}`, PDF_MARGIN, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  return 30;
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
    { header: 'Student', width: 42 },
    { header: 'Class', width: 20 },
    { header: 'Head', width: 26 },
    { header: 'Month', width: 22 },
    { header: 'Mode', width: 18 },
    { header: 'Amount', width: 26, align: 'right' },
  ], data.payments.map(p => [p.student, p.className, p.head, p.month || '-', p.mode, inr(p.amount)]), y) + 4;

  y = pdfSection(doc, 'Expense Entries', y);
  y = pdfTable(doc, [
    { header: 'Category', width: 40 },
    { header: 'Description', width: 84 },
    { header: 'Mode', width: 24 },
    { header: 'Amount', width: 30, align: 'right' },
  ], data.expenses.map(e => [e.category, e.description, e.mode, inr(e.amount)]), y) + 4;

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

/* eslint-enable @typescript-eslint/no-explicit-any */
