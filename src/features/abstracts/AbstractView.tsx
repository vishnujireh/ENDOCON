import React from 'react';
import type { AbstractRecord } from '../../api/types';
import { dateTime } from '../../lib/format';
import { DefinitionList } from '../../components/ui/Layout';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatSize } from './FileUploader';

/** Read-only abstract (author preview, submitted view and admin view). */
export function AbstractView({ a, fileHref }: { a: AbstractRecord; fileHref?: (fileId: number) => string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        {a.status && <StatusBadge status={a.status} label={a.statusLabel} />}
        <span className="text-xs text-[#665e5d]">{a.categoryLabel}</span>
        {a.abstractNumber && <span className="font-mono text-xs font-bold text-[#580c1e]">{a.abstractNumber}</span>}
        {a.revision > 1 && <span className="text-[11px] text-[#8a8280]">revision {a.revision}</span>}
      </div>
      <h2 className="font-serif text-xl font-bold leading-snug">{a.title || 'Untitled'}</h2>
      <DefinitionList
        rows={[
          ...(a.contactEmail
            ? ([['Submitted by', [a.contactName, a.contactEmail, a.contactPhone].filter(Boolean).join(' · ')]] as [string, React.ReactNode][])
            : []),
          ['Track / Theme', a.track],
          ['Institution', a.institution],
          ['Department', a.department],
          ['Corresponding author', a.correspondingAuthor],
          ['Keywords', a.keywords?.join(', ')],
          ['Submitting author', a.submittingAuthor ? `${a.submittingAuthor.fullName}${a.submittingAuthor.email ? ` <${a.submittingAuthor.email}>` : ''}` : null],
          ['Presenting author', a.presentingAuthor?.fullName ?? a.submittingAuthor?.fullName],
          ['Co-authors', a.coAuthors?.map((c) => (c.institution ? `${c.fullName} (${c.institution})` : c.fullName)).join('; ')],
          ...(a.category === 'yia' ? ([['Presenting author age', a.presentingAuthorAge]] as [string, React.ReactNode][]) : []),
          ...(a.category === 'plenary' ? ([['SGEI membership no.', a.sgeiMembershipNo]] as [string, React.ReactNode][]) : []),
          ...(a.submittedAt ? ([['Submitted', dateTime(a.submittedAt)]] as [string, React.ReactNode][]) : []),
          ...(a.resubmittedAt ? ([['Last resubmitted', dateTime(a.resubmittedAt)]] as [string, React.ReactNode][]) : []),
        ]}
      />
      {a.body?.trim() ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] mb-1">Abstract ({a.wordCount} words)</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed bg-[#faf8f5] rounded-2xl p-4 border border-black/[0.05]">{a.body}</p>
        </div>
      ) : (
        <p className="text-xs text-[#665e5d]">No abstract text entered – see the uploaded file(s).</p>
      )}
      {a.referencesText && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] mb-1">References</p>
          <p className="text-xs whitespace-pre-wrap">{a.referencesText}</p>
        </div>
      )}
      {a.category === 'video' && (a.videoUrl || a.videoObjectives || a.techniqueJustification) && (
        <DefinitionList
          rows={[
            // Older submissions only (videos are now uploaded as files).
            ...(a.videoUrl ? ([['Video link', <a href={a.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[#580c1e] underline break-all">{a.videoUrl}</a>]] as [string, React.ReactNode][]) : []),
            ['Objectives & rationale', a.videoObjectives],
            ['Technique justification', a.techniqueJustification],
          ]}
        />
      )}
      <DefinitionList rows={[['Conflict of interest', a.conflictOfInterest]]} />
      {a.files?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#665e5d] mb-1">Files</p>
          <ul className="text-xs space-y-1">
            {a.files.map((f) => (
              <li key={f.id}>
                {fileHref ? (
                  <a href={fileHref(f.id)} className="text-[#580c1e] underline">
                    {f.originalName}
                  </a>
                ) : (
                  f.originalName
                )}{' '}
                <span className="text-[#665e5d]">({{ document: 'Document', image: 'Image', video: 'Video' }[f.kind] ?? f.kind}, {formatSize(f.sizeBytes)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
