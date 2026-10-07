import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FilePlus2, FileText, MessageSquareWarning, PencilLine } from 'lucide-react';
import { api, apiUrl } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { ABSTRACT_FORM_PATH } from '../../lib/nav';
import type { MyAbstractDetail, MyAbstractList, MyAbstractSummary } from '../../api/types';
import { Alert, EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PortalPage } from '../registration/RegistrationShell';
import { useProfile } from '../registration/hooks';
import { AbstractForm } from './AbstractForm';
import { AbstractTimeline } from './AbstractTimeline';
import { AbstractView } from './AbstractView';

const keys = {
  list: ['my-abstracts'] as const,
  one: (id: number) => ['my-abstracts', id] as const,
};

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-black/[0.06] shadow-[0_10px_30px_-12px_rgba(88,12,30,0.15)] p-5 sm:p-7 ${className}`}>{children}</div>;
}

const primaryBtn =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#580c1e] to-[#781029] text-[#fef3c7] hover:text-white text-xs font-bold uppercase tracking-wider border border-[#d4af37]/40 shadow-sm hover:shadow-[0_6px_18px_rgba(88,12,30,0.25)] transition-all cursor-pointer';

/** What the author should know / do next, per status. */
function StatusNote({ a, closesAt }: { a: Pick<MyAbstractSummary, 'status' | 'reviewComment' | 'canResubmit'>; closesAt?: string }) {
  if (a.status === 'accepted')
    return (
      <Alert tone="success">
        Congratulations – your abstract has been <strong>accepted</strong> by the Scientific Committee. Presentation details will be emailed to you. The presenting author must complete conference registration.
      </Alert>
    );
  if (a.status === 'rejected' || a.status === 'duplicate')
    return (
      <div className={`rounded-2xl border p-4 ${a.status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
        <p className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${a.status === 'rejected' ? 'text-red-800' : 'text-orange-800'}`}>
          <MessageSquareWarning className="w-4 h-4" /> Comment from the Scientific Committee
        </p>
        {a.reviewComment && <p className="text-sm text-[#1a1918] mt-2 whitespace-pre-wrap leading-relaxed">{a.reviewComment}</p>}
        <p className="text-xs text-[#4e4443] mt-3">
          {a.canResubmit
            ? `Please revise your abstract as suggested and resubmit it${closesAt ? ` before ${dateTime(closesAt)}` : ''}. It keeps the same abstract number.`
            : 'Abstract submission has closed, so this abstract can no longer be resubmitted.'}
        </p>
      </div>
    );
  return (
    <Alert tone="info">
      <span className="inline-flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> {a.status === 'resubmitted' ? 'Your revised abstract is' : 'Your abstract is'} with the Scientific Committee for review. You will be emailed when a decision is made.
      </span>
    </Alert>
  );
}

/** /my-abstracts – the author's abstracts with the committee's decision and comment. */
export function MyAbstractsPage() {
  const q = useQuery({ queryKey: keys.list, queryFn: () => api.get<MyAbstractList>('/abstracts/mine') });
  if (q.isLoading) return <LoadingState label="Loading your abstracts…" />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { window, abstracts } = q.data;

  return (
    <PortalPage title="My Abstracts" tag={`${abstracts.length} submitted`}>
      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-[#4e4443]">
          {window.isOpen ? (
            <>
              Abstract submission is open until <strong className="text-[#1a1918]">{dateTime(window.closesAt)}</strong>.
            </>
          ) : (
            <>Abstract submission is closed.</>
          )}
        </div>
        {window.isOpen && (
          <Link to={ABSTRACT_FORM_PATH} className={primaryBtn}>
            <FilePlus2 className="w-4 h-4 text-[#d4af37]" /> Submit a new abstract
          </Link>
        )}
      </Panel>

      {abstracts.length === 0 ? (
        <Panel>
          <EmptyState title="You have not submitted any abstracts yet." icon={<FileText className="w-8 h-8 text-[#c89e37]" />}>
            {window.isOpen && (
              <Link to={ABSTRACT_FORM_PATH} className="font-semibold text-[#580c1e] underline">
                Submit your first abstract
              </Link>
            )}
          </EmptyState>
        </Panel>
      ) : (
        abstracts.map((a) => (
          <Panel key={a.id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#580c1e]">{a.abstractNumber}</span>
                  <StatusBadge status={a.status} label={a.statusLabel} />
                  <span className="text-xs text-[#665e5d]">{a.categoryLabel}</span>
                  {a.revision > 1 && <span className="text-[11px] text-[#8a8280]">· revision {a.revision}</span>}
                </div>
                <h2 className="font-serif text-lg font-bold text-[#1a1918] mt-1.5 leading-snug">{a.title}</h2>
                <p className="text-[11px] text-[#8a8280] mt-1">
                  Submitted {dateTime(a.submittedAt)}
                  {a.resubmittedAt && ` · resubmitted ${dateTime(a.resubmittedAt)}`}
                  {a.reviewedAt && ` · reviewed ${dateTime(a.reviewedAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {a.canResubmit && (
                  <Link to={`/my-abstracts/${a.id}?revise=1`} className={primaryBtn}>
                    <PencilLine className="w-4 h-4 text-[#d4af37]" /> Revise &amp; resubmit
                  </Link>
                )}
                <Link to={`/my-abstracts/${a.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#580c1e] hover:underline">
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
            <StatusNote a={a} closesAt={window.closesAt} />
          </Panel>
        ))
      )}
    </PortalPage>
  );
}

/** /my-abstracts/:id – the abstract, its history, and the resubmission form (?revise=1). */
export function MyAbstractDetailPage() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const revise = params.get('revise') === '1';
  const [done, setDone] = useState<string | null>(null);
  const q = useQuery({ queryKey: keys.one(id), queryFn: () => api.get<MyAbstractDetail>(`/abstracts/mine/${id}`), enabled: Number.isFinite(id) });
  const profileQ = useProfile();

  if (q.isLoading || profileQ.isLoading) return <LoadingState label="Loading the abstract…" />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (profileQ.error || !profileQ.data) return <ErrorState error={profileQ.error} onRetry={() => profileQ.refetch()} />;
  const a = q.data;
  const editing = revise && a.canResubmit;

  const back = (
    <Link to="/my-abstracts" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#580c1e] hover:underline">
      <ArrowLeft className="w-3.5 h-3.5" /> All my abstracts
    </Link>
  );

  return (
    <PortalPage title={editing ? 'Revise & Resubmit' : a.abstractNumber ?? 'Abstract'} tag={a.statusLabel}>
      {back}
      {done && (
        <Alert tone="success">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> {done}
          </span>
        </Alert>
      )}
      <StatusNote a={{ status: a.status, reviewComment: a.reviewComment, canResubmit: a.canResubmit }} />

      {editing ? (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
            <p className="text-sm text-[#4e4443]">
              Revising <span className="font-mono font-bold text-[#580c1e]">{a.abstractNumber}</span> (revision {a.revision} → {a.revision + 1})
            </p>
            <button type="button" onClick={() => setParams({})} className="text-xs font-semibold text-[#665e5d] hover:text-[#580c1e] underline cursor-pointer">
              Cancel
            </button>
          </div>
          <AbstractForm
            profile={profileQ.data}
            initial={a}
            formId="resubmit-form"
            onSubmitted={async (r) => {
              await qc.invalidateQueries({ queryKey: keys.list });
              await qc.invalidateQueries({ queryKey: keys.one(id) });
              setDone(`Revision ${r.revision ?? a.revision + 1} of ${r.abstractNumber} has been resubmitted. A confirmation has been emailed to you.`);
              navigate(`/my-abstracts/${id}`, { replace: true });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </Panel>
      ) : (
        <>
          {a.canResubmit && (
            <div>
              <button type="button" onClick={() => setParams({ revise: '1' })} className={primaryBtn}>
                <PencilLine className="w-4 h-4 text-[#d4af37]" /> Revise &amp; resubmit
              </button>
            </div>
          )}
          <Panel>
            <AbstractView a={a} fileHref={(fileId) => apiUrl(`/abstracts/files/${fileId}`)} />
          </Panel>
          <Panel>
            <h3 className="font-serif text-lg font-bold text-[#580c1e] mb-5">History</h3>
            <AbstractTimeline events={a.history} />
          </Panel>
        </>
      )}
    </PortalPage>
  );
}
