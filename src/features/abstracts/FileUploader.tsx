import React, { useRef, useState } from 'react';
import { FileText, Film, Image as ImageIcon, UploadCloud, X } from 'lucide-react';
import type { FileKind } from '../../api/types';

/**
 * Abstract uploads – not tied to the presentation type. 1–5 files: documents (PDF / Word), images
 * (JPG / PNG) and one video (MP4 / MOV / WebM). Checked here for quick feedback; the server checks
 * each file's real content and size again.
 */

export interface UploadLimits {
  maxFiles: number;
  maxVideos: number;
  maxDocumentMb: number;
  maxVideoMb: number;
}
export const DEFAULT_LIMITS: UploadLimits = { maxFiles: 5, maxVideos: 1, maxDocumentMb: 20, maxVideoMb: 500 };

const EXT_KIND: Record<string, FileKind> = {
  pdf: 'document', doc: 'document', docx: 'document',
  jpg: 'image', jpeg: 'image', png: 'image',
  mp4: 'video', mov: 'video', webm: 'video',
};
export const ACCEPT = Object.keys(EXT_KIND).map((e) => `.${e}`).join(',');

export const kindOfName = (name: string): FileKind | null => EXT_KIND[name.split('.').pop()?.toLowerCase() ?? ''] ?? null;

export function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

const ICON: Record<FileKind, React.ReactNode> = {
  document: <FileText className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
};
const KIND_LABEL: Record<FileKind, string> = { document: 'Document', image: 'Image', video: 'Video' };

export interface KeptFile {
  id: number;
  originalName: string;
  kind: FileKind;
  sizeBytes: number;
}

export function FileUploader({
  files,
  onFilesChange,
  kept = [],
  keepIds = [],
  onKeepIdsChange,
  limits = DEFAULT_LIMITS,
  error,
  disabled,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Files of the current revision (when revising); kept unless removed. */
  kept?: KeptFile[];
  keepIds?: number[];
  onKeepIdsChange?: (ids: number[]) => void;
  limits?: UploadLimits;
  error?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const keptNow = kept.filter((k) => keepIds.includes(k.id));

  const add = (list: FileList | File[]) => {
    const next = [...files];
    const problems: string[] = [];
    let videos = keptNow.filter((k) => k.kind === 'video').length + next.filter((f) => kindOfName(f.name) === 'video').length;
    for (const f of Array.from(list)) {
      const kind = kindOfName(f.name);
      if (!kind) {
        problems.push(`“${f.name}” is not an accepted file type.`);
        continue;
      }
      const maxMb = kind === 'video' ? limits.maxVideoMb : limits.maxDocumentMb;
      if (f.size > maxMb * 1024 * 1024) {
        problems.push(`“${f.name}” is larger than ${maxMb} MB.`);
        continue;
      }
      if (kind === 'video' && videos >= limits.maxVideos) {
        problems.push(`Only ${limits.maxVideos} video can be uploaded per abstract.`);
        continue;
      }
      if (keptNow.length + next.length >= limits.maxFiles) {
        problems.push(`A maximum of ${limits.maxFiles} files can be uploaded.`);
        break;
      }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue; // same file picked twice
      if (kind === 'video') videos++;
      next.push(f);
    }
    setProblem(problems.length ? problems.join(' ') : null);
    onFilesChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const shown = error ?? problem;
  const count = keptNow.length + files.length;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files.length) add(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed px-5 py-7 text-center transition-colors ${
          dragging ? 'border-[#580c1e] bg-[#580c1e]/[0.04]' : shown ? 'border-red-300 bg-red-50/40' : 'border-black/[0.12] bg-[#fcfaf7]'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <UploadCloud className="w-8 h-8 mx-auto text-[#580c1e]/70" />
        <p className="mt-2 text-sm text-[#1a1918]">
          Drag &amp; drop files here, or{' '}
          <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="font-bold text-[#580c1e] underline cursor-pointer disabled:cursor-not-allowed">
            browse
          </button>
        </p>
        <p className="mt-1.5 text-[11px] text-[#665e5d] leading-relaxed">
          Documents &amp; images: PDF, Word, JPG, PNG – up to {limits.maxDocumentMb} MB each
          <br className="hidden sm:block" />
          <span className="sm:hidden"> · </span>Video: MP4, MOV, WebM – up to {limits.maxVideoMb} MB · up to {limits.maxFiles} files in total
        </p>
        <input
          ref={inputRef}
          id="files"
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          aria-invalid={!!shown || undefined}
          onChange={(e) => e.target.files && add(e.target.files)}
        />
      </div>

      {shown && (
        <p className="text-[11px] text-red-700 mt-2" role="alert">
          {shown}
        </p>
      )}

      {count > 0 && (
        <ul className="mt-3 divide-y divide-black/[0.06] rounded-2xl border border-black/[0.08] bg-white">
          {keptNow.map((k) => (
            <FileRow
              key={`k${k.id}`}
              kind={k.kind}
              name={k.originalName}
              size={k.sizeBytes}
              badge="Current file"
              disabled={disabled}
              onRemove={() => onKeepIdsChange?.(keepIds.filter((id) => id !== k.id))}
            />
          ))}
          {files.map((f, i) => (
            <FileRow
              key={`n${i}${f.name}`}
              kind={kindOfName(f.name) ?? 'document'}
              name={f.name}
              size={f.size}
              badge={kept.length ? 'New' : undefined}
              disabled={disabled}
              onRemove={() => onFilesChange(files.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
      {kept.length > keptNow.length && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onKeepIdsChange?.(kept.map((k) => k.id))}
          className="mt-2 text-[11px] font-semibold text-[#580c1e] underline cursor-pointer"
        >
          Restore removed current files
        </button>
      )}
    </div>
  );
}

function FileRow({ kind, name, size, badge, onRemove, disabled }: { kind: FileKind; name: string; size: number; badge?: string; onRemove: () => void; disabled?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="w-8 h-8 rounded-lg bg-[#580c1e]/[0.07] text-[#580c1e] flex items-center justify-center shrink-0">{ICON[kind]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#1a1918] truncate">{name}</p>
        <p className="text-[11px] text-[#8a8280]">
          {KIND_LABEL[kind]} · {formatSize(size)}
          {badge && <span className="ml-2 px-1.5 py-px rounded bg-[#fdf3e3] text-[#8a6a1f] font-semibold">{badge}</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${name}`}
        className="p-1.5 rounded-full text-[#665e5d] hover:text-red-700 hover:bg-red-50 cursor-pointer disabled:cursor-not-allowed"
      >
        <X className="w-4 h-4" />
      </button>
    </li>
  );
}
