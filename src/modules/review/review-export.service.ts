import ExcelJS from 'exceljs';
import { formatEventDateTime } from '../../lib/time.js';
import type { ReviewAbstractFilters } from './review.schemas.js';
import { abstractRows, type AssignmentView } from './review-admin.service.js';

/**
 * Excel downloads of the review data (same filters as the admin abstract table):
 *  - Review export: one row per reviewer per abstract, so every judge's own review and score is kept.
 *  - Final review report: one row per abstract with all judges, individual scores, total / average.
 * No selection or ranking rules are applied – "Final review status" is only the review progress.
 */

const MAROON = 'FF580C1E';

function styleSheet(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 30;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  ws.eachRow((row, i) => {
    if (i > 1) row.alignment = { vertical: 'top', wrapText: true };
  });
}

const judgeLabel = (a: AssignmentView) => `${a.reviewerName} (${a.reviewerCode})`;
const judgeStatus = (a: AssignmentView) => (a.status === 'pending' && a.review?.state === 'draft' ? 'Pending (draft saved)' : a.statusLabel);
const scoreText = (score: number | null, max: number | null) => (score === null ? '' : max ? `${score}/${max}` : String(score));

async function toBuffer(wb: ExcelJS.Workbook) {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ENDOCON 2027';
  wb.created = new Date();
  return wb;
}

export async function reviewExportXlsx(f: ReviewAbstractFilters): Promise<Buffer> {
  const { rows } = await abstractRows(f, false);
  // Every criterion used in any exported review gets its own column (from the saved snapshots).
  const criteria = new Map<number, string>();
  for (const r of rows) for (const a of r.assignments) for (const s of a.review?.state === 'submitted' ? a.review.scores : []) criteria.set(s.criterionId, `${s.criterionName} (max ${s.maxScore})`);

  const wb = newWorkbook();
  const ws = wb.addWorksheet('Reviews');
  ws.columns = [
    { header: 'Abstract ID', key: 'no', width: 18 },
    { header: 'Abstract Title', key: 'title', width: 45 },
    { header: 'Author / Presenter', key: 'presenter', width: 24 },
    { header: 'Presentation Category', key: 'category', width: 24 },
    { header: 'Track / Theme', key: 'track', width: 24 },
    { header: 'Assigned Judge', key: 'judge', width: 26 },
    { header: 'Judge Email', key: 'judgeEmail', width: 28 },
    { header: 'Assignment', key: 'assignment', width: 14 },
    { header: 'Judge Review Status', key: 'status', width: 18 },
    ...[...criteria].map(([id, label]) => ({ header: label, key: `c${id}`, width: 16 })),
    { header: 'Individual Score', key: 'score', width: 14 },
    { header: 'Individual Max', key: 'max', width: 12 },
    { header: 'Total Score (abstract)', key: 'total', width: 14 },
    { header: 'Average Score (abstract)', key: 'avg', width: 14 },
    { header: 'Recommended Category', key: 'recCategory', width: 24 },
    { header: 'COI Status', key: 'coi', width: 10 },
    { header: 'COI Reason', key: 'coiReason', width: 30 },
    { header: 'Comments', key: 'comments', width: 40 },
    { header: 'Review Submitted At', key: 'submittedAt', width: 20 },
    { header: 'Final Review Status', key: 'final', width: 20 },
    { header: 'Committee Decision', key: 'decision', width: 16 },
  ];
  for (const r of rows) {
    const base = {
      no: r.abstractNumber,
      title: r.title,
      presenter: r.presenter,
      category: r.categoryLabel,
      track: r.track ?? '',
      total: r.summary.totalScore ?? '',
      avg: r.summary.averageScore ?? '',
      final: r.summary.progressLabel,
      decision: r.decisionLabel,
    };
    if (!r.assignments.length) {
      ws.addRow({ ...base, judge: '(not assigned)', coi: '' });
      continue;
    }
    // Active assignments first, then removed ones (kept for the record).
    for (const a of [...r.assignments.filter((x) => x.active), ...r.assignments.filter((x) => !x.active)]) {
      const submitted = a.review?.state === 'submitted' ? a.review : null;
      const row: Record<string, unknown> = {
        ...base,
        judge: judgeLabel(a),
        judgeEmail: a.reviewerEmail,
        assignment: a.active ? 'Active' : `Removed${a.replacedBy ? ` → ${a.replacedBy}` : ''}`,
        status: judgeStatus(a),
        score: submitted?.totalScore ?? '',
        max: submitted?.maxTotal ?? '',
        recCategory: submitted?.recommendedCategoryLabel ?? '',
        coi: submitted ? (submitted.coi ? 'Yes' : 'No') : '',
        coiReason: submitted?.coi ? submitted.coiReason : '',
        comments: submitted?.comments ?? '',
        submittedAt: submitted ? formatEventDateTime(submitted.submittedAt) : '',
      };
      for (const s of submitted?.scores ?? []) row[`c${s.criterionId}`] = s.score;
      ws.addRow(row);
    }
  }
  styleSheet(ws);
  return toBuffer(wb);
}

export async function finalReportXlsx(f: ReviewAbstractFilters): Promise<Buffer> {
  const { rows } = await abstractRows(f, false);
  const wb = newWorkbook();
  const ws = wb.addWorksheet('Final Review Report');
  ws.columns = [
    { header: 'Abstract ID', key: 'no', width: 18 },
    { header: 'Abstract Title', key: 'title', width: 45 },
    { header: 'Author / Presenter', key: 'presenter', width: 24 },
    { header: 'Presentation Category', key: 'category', width: 24 },
    { header: 'Track / Theme', key: 'track', width: 24 },
    { header: 'Assigned Judge(s)', key: 'judges', width: 34 },
    { header: 'Individual Scores', key: 'scores', width: 40 },
    { header: 'Recommended Category (by judge)', key: 'recCategory', width: 36 },
    { header: 'Reviews Received', key: 'received', width: 12 },
    { header: 'Total Score', key: 'total', width: 12 },
    { header: 'Average Score', key: 'avg', width: 12 },
    { header: 'Max per Review', key: 'max', width: 12 },
    { header: 'Conflict of Interest', key: 'coi', width: 24 },
    { header: 'Final Review Status', key: 'final', width: 20 },
    { header: 'Committee Decision', key: 'decision', width: 16 },
  ];
  for (const r of rows) {
    const active = r.assignments.filter((a) => a.active);
    const s = r.summary;
    ws.addRow({
      no: r.abstractNumber,
      title: r.title,
      presenter: r.presenter,
      category: r.categoryLabel,
      track: r.track ?? '',
      judges: active.map(judgeLabel).join('\n') || '(not assigned)',
      scores: active
        .map((a) => `${a.reviewerName}: ${a.status === 'completed' && a.review?.state === 'submitted' ? scoreText(a.review.totalScore, a.review.maxTotal) : judgeStatus(a)}`)
        .join('\n'),
      recCategory: active
        .filter((a) => a.status === 'completed' && a.review?.recommendedCategoryLabel)
        .map((a) => `${a.reviewerName}: ${a.review!.recommendedCategoryLabel}`)
        .join('\n'),
      received: `${s.completed + s.coi} of ${s.assigned}`,
      total: s.totalScore ?? '',
      avg: s.averageScore ?? '',
      max: s.maxPerReview ?? '',
      coi: s.coi ? `Yes – ${active.filter((a) => a.status === 'coi').map((a) => a.reviewerName).join(', ')}` : 'None',
      final: s.progressLabel,
      decision: r.decisionLabel,
    });
  }
  styleSheet(ws);
  return toBuffer(wb);
}
