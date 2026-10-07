import React from 'react';
import { CheckCircle2, Copy, RefreshCw, Send, XCircle } from 'lucide-react';
import type { AbstractHistoryEvent } from '../../api/types';
import { dateTime } from '../../lib/format';

const DECISION: Record<'accepted' | 'rejected' | 'duplicate', { label: string; icon: React.ReactNode; dot: string; box: string }> = {
  accepted: { label: 'Accepted', icon: <CheckCircle2 className="w-4 h-4" />, dot: 'bg-emerald-600 text-white', box: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  rejected: { label: 'Rejected', icon: <XCircle className="w-4 h-4" />, dot: 'bg-red-600 text-white', box: 'bg-red-50 border-red-200 text-red-900' },
  duplicate: { label: 'Marked as duplicate', icon: <Copy className="w-4 h-4" />, dot: 'bg-orange-500 text-white', box: 'bg-orange-50 border-orange-200 text-orange-900' },
};

/** Submission → decisions (with comments) → resubmissions, oldest first. */
export function AbstractTimeline({ events }: { events: AbstractHistoryEvent[] }) {
  if (!events.length) return null;
  return (
    <ol className="relative border-l-2 border-black/[0.07] ml-3.5 space-y-5">
      {events.map((e, i) => {
        const d = e.type === 'review' ? DECISION[e.decision] : null;
        return (
          <li key={i} className="relative pl-7">
            <span
              className={`absolute -left-[15px] top-0 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-white ${
                d ? d.dot : 'bg-[#580c1e] text-[#fef3c7]'
              }`}
            >
              {d ? d.icon : e.type === 'submitted' ? <Send className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-semibold text-[#1a1918]">
                {e.type === 'submitted' ? 'Submitted' : e.type === 'resubmitted' ? `Resubmitted (revision ${e.revision})` : `${d!.label} by the Scientific Committee`}
              </p>
              <p className="text-[11px] text-[#8a8280]">
                {dateTime(e.at)}
                {e.type === 'review' && e.reviewer ? ` · ${e.reviewer}` : ''}
                {e.type === 'review' ? ` · revision ${e.revision}` : ''}
              </p>
            </div>
            {e.type === 'review' && e.comment && (
              <blockquote className={`mt-2 rounded-xl border px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${d!.box}`}>{e.comment}</blockquote>
            )}
          </li>
        );
      })}
    </ol>
  );
}
