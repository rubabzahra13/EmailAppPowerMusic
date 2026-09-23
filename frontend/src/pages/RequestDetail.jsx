import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Building2,
  Mail,
  AlertTriangle,
  Check,
  Info,
} from 'lucide-react';
import { Tag, Modal, Toast, useToast } from '../components/ui';
import RequestComparison from '../components/RequestComparison';
import { hasComparisonContext } from '../utils/requestComparison';
import { getManagerDisplayName, isManualEntry, AWAITING_MANAGER_HINT } from '../utils/manualEntry';
import {
  sentViaTableRequestTags,
  requestTagLabel,
  requestTagVariant,
  isAwaitingManagerSubmission,
} from '../utils/requestTags';
import { formatRequestDisplayId, formatAdminDateTime, formatAdminDate } from '../utils/requestDisplayId';
import { formatManagerNotes, readManagerNotes } from '../utils/managerNotes';
import { loadWithCache, patchCache, writeCache, refreshCache, getNewRequestsPage } from '../utils/pilot2Api';
import { fetchJson } from '../utils/api';
import { markRequestViewed, removeRequestHighlight, markDirectoryPersonHighlight } from '../utils/adminUiHighlights';
import { useAuth } from '../context/AuthContext';
import { adminPageScrollClass } from '../utils/responsiveLayout';

function initials(first = '', last = '') {
  const value = `${(first || '').charAt(0)}${(last || '').charAt(0)}`.trim();
  return value ? value.toUpperCase() : '?';
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="grid grid-cols-[76px_1fr] gap-x-3 py-2.5 text-sm">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd
        className={`min-w-0 break-words font-semibold text-[var(--color-text-primary)] ${
          mono ? 'font-medium' : ''
        }`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

function DetailCard({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border-default)] bg-white shadow-[0_1px_2px_rgba(26,26,46,0.04)]">
      <header className="flex items-center gap-2 border-b border-[var(--color-border-default)] px-5 py-3">
        <Icon className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {title}
        </h3>
      </header>
      <dl className="divide-y divide-[var(--color-border-default)]/70 px-5 py-1">{children}</dl>
    </section>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile } = useAuth();
  const adminDisplayName = profile?.full_name?.trim() || 'Power Music Admin';

  const [requests, setRequests] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let active = true;
    loadWithCache('requests_page', getNewRequestsPage, (data) => {
      if (!active || !Array.isArray(data.requests)) return;
      setRequests(data.requests);
      setDirectory(data.persons || []);
    }).catch(() => {
      if (active) setLoadFailed(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const request = useMemo(
    () => (requests || []).find((r) => r.id === id) || null,
    [requests, id],
  );

  useEffect(() => {
    if (request) markRequestViewed(request.id);
  }, [request?.id]);

  const matchedDirectoryRecord = useMemo(() => {
    if (!request?.directoryMatch?.directoryId || !directory?.length) return null;
    return directory.find((record) => record.id === request.directoryMatch.directoryId) || null;
  }, [request, directory]);

  const goBack = () => navigate('/new-requests');

  // ── Loading / not-found states ──
  if (requests === null && !loadFailed) {
    return (
      <div className={adminPageScrollClass}>
        <Toast />
        <BackButton onClick={goBack} />
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-5">
            <div className="h-[72px] w-[72px] shrink-0 animate-pulse rounded-full bg-[var(--color-surface-highlight)]" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--color-surface-highlight)]" />
              <div className="h-4 w-80 animate-pulse rounded bg-[var(--color-surface-highlight)]" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-surface-highlight)]" />
            <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-surface-highlight)]" />
          </div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className={adminPageScrollClass}>
        <Toast />
        <BackButton onClick={goBack} />
        <div className="mx-auto mt-24 max-w-md rounded-2xl border border-[var(--color-border-default)] bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(26,26,46,0.04)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-highlight)]">
            <Info className="h-5 w-5 text-[var(--color-text-secondary)]" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-[var(--color-text-primary)]">
            This request isn’t here anymore
          </h2>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            {loadFailed
              ? 'We couldn’t load this request. It may have been handled, or the link is out of date.'
              : 'It may have already been handled by you or another admin.'}
          </p>
          <button
            type="button"
            onClick={goBack}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-surface-sidebar-hover)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to New Requests
          </button>
        </div>
      </div>
    );
  }

  const isAdd = request.action === 'Add';
  const managerName = getManagerDisplayName(request.submittedBy, request.tags);
  const awaitingManager = isAwaitingManagerSubmission(request.tags);
  const submittedByLabel = awaitingManager
    ? 'PureGym automated email'
    : (request.createdBy || managerName);
  const personName = `${request.person.firstName} ${request.person.lastName}`.trim();
  const notesText = readManagerNotes(request);
  const sentViaTags = sentViaTableRequestTags(request.tags || []);

  const accent = isAdd
    ? {
        gradient: 'linear-gradient(135deg, #34d399, #16a34a)',
        pillVariant: 'add-action',
        pillLabel: 'Add person',
        verb: 'added',
        button: 'bg-[#16a34a] hover:bg-[#15803d]',
        glow: '0 6px 20px rgba(34,197,94,0.35)',
      }
    : {
        gradient: 'linear-gradient(135deg, #fb7185, #dc2626)',
        pillVariant: 'remove-action',
        pillLabel: 'Remove person',
        verb: 'removed',
        button: 'bg-[#dc2626] hover:bg-[#b91c1c]',
        glow: '0 6px 20px rgba(239,68,68,0.35)',
      };

  const handleComplete = async () => {
    const adminNote = noteText.trim();
    const outcome = isAdd ? 'Added' : 'Removed';
    const handledAt = new Date().toISOString();

    setConfirmOpen(false);
    removeRequestHighlight(request.id);

    const nextRequests = (requests || []).filter((r) => r.id !== request.id);
    const emailKey = request.person.email.toLowerCase();
    const existingPerson = directory.find((p) => p.email.toLowerCase() === emailKey);
    const nextDirectory = existingPerson
      ? directory.map((p) =>
          p.email.toLowerCase() === emailKey
            ? {
                ...p,
                status: outcome,
                dateAdded: handledAt,
                handledBy: adminDisplayName,
                adminNotes: adminNote || '',
              }
            : p,
        )
      : [
          {
            id: `temp-${request.id}`,
            displayId: request.displayId,
            sourceRequestNumber: request.displayId,
            firstName: request.person.firstName,
            lastName: request.person.lastName,
            email: request.person.email,
            location: request.person.location,
            status: outcome,
            dateAdded: handledAt,
            requestReceivedAt: request.receivedAt,
            addedBy: request.createdBy || managerName,
            managerName: request.createdBy || managerName,
            handledBy: adminDisplayName,
            managerEmail: request.submittedBy?.email || '',
            club: request.submittedBy?.club || '',
            managerNotes: request.notes || '',
            adminNotes: adminNote || '',
            notes: request.notes || '',
          },
          ...directory,
        ];

    patchCache('requests_page', { requests: nextRequests, persons: nextDirectory });
    writeCache('directory_persons', nextDirectory);
    markDirectoryPersonHighlight(request.person.email);
    sessionStorage.setItem('pm_directory_pending_tab', outcome === 'Added' ? 'Added' : 'Removed');

    showToast(`${personName} marked as ${outcome}. They are now in the Directory.`, 'success');
    navigate('/new-requests');

    try {
      await fetchJson(`/api/admin/requests/${request.id}/mark-handled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: adminNote || null }),
      });
      refreshCache('directory_persons', () => fetchJson('/api/persons'), (data) => {
        // best-effort revalidation; the destination page owns render state
        writeCache('directory_persons', Array.isArray(data) ? data : []);
      }).catch(() => {});
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to save — please refresh the requests list.', 'error');
    }
  };

  return (
    <div className={adminPageScrollClass}>
      <Toast />

      <div className="mx-auto w-full max-w-4xl pb-10">
        <BackButton onClick={goBack} />

        {/* Hero */}
        <div className="mt-5 flex items-start gap-4 sm:gap-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-extrabold text-white shadow-sm sm:h-[72px] sm:w-[72px] sm:text-2xl"
            style={{ background: accent.gradient }}
            aria-hidden="true"
          >
            {initials(request.person.firstName, request.person.lastName)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-extrabold leading-none tracking-tight text-[var(--color-text-primary)] break-words sm:text-[34px]">
              {personName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Tag variant={accent.pillVariant} label={accent.pillLabel} />
              {sentViaTags.map((tag) => (
                <Tag key={tag} variant={requestTagVariant(tag)} label={requestTagLabel(tag)} />
              ))}
            </div>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              <span className="font-bold text-[var(--color-text-primary)]">
                {formatRequestDisplayId(request.displayId)}
              </span>
              <span className="text-[var(--color-text-muted)]"> · </span>
              <time dateTime={request.receivedAt}>{formatAdminDateTime(request.receivedAt)}</time>
              <span className="text-[var(--color-text-muted)]"> · </span>
              Submitted by {submittedByLabel}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-[var(--color-border-default)]" />

        {/* Already in directory */}
        {request.directoryMatch && matchedDirectoryRecord ? (
          <section
            role="alert"
            className="mt-6 flex gap-3 rounded-2xl border border-amber-300 bg-[var(--color-tag-already-exists-bg)] px-5 py-4"
          >
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-tag-already-exists-text)]"
              aria-hidden="true"
            />
            <div className="min-w-0 text-sm text-[var(--color-tag-already-exists-text)]">
              <p className="text-[15px] font-bold leading-tight">Already in the directory</p>
              <p className="mt-1 break-words">
                {matchedDirectoryRecord.firstName} {matchedDirectoryRecord.lastName} ·{' '}
                {matchedDirectoryRecord.email}
              </p>
              <p className="mt-0.5 opacity-90">
                {matchedDirectoryRecord.status === 'Removed' ? 'Removed' : 'Added'}{' '}
                {formatAdminDate(matchedDirectoryRecord.dateAdded)} · {matchedDirectoryRecord.location}
              </p>
            </div>
          </section>
        ) : null}

        {/* Two-column: person + requester */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailCard icon={User} title={`Person to ${isAdd ? 'add' : 'remove'}`}>
            <DetailRow label="Name" value={personName} />
            <DetailRow label="Email" value={request.person.email} mono />
            <DetailRow label="Location" value={request.person.location} />
          </DetailCard>

          {awaitingManager ? (
            <DetailCard icon={Mail} title="Requested by">
              <DetailRow label="Source" value="PureGym automated email" />
              <DetailRow label="Status" value={AWAITING_MANAGER_HINT} />
            </DetailCard>
          ) : (
            <DetailCard icon={Building2} title="Requested by">
              <DetailRow label="Name" value={managerName} />
              <DetailRow label="Email" value={request.submittedBy?.email} mono />
              <DetailRow
                label="Club"
                value={isManualEntry(request.submittedBy) ? 'Manual entry' : request.submittedBy?.club}
              />
            </DetailCard>
          )}
        </div>

        {/* Needs review */}
        {hasComparisonContext(request.intakeMatch, request.directoryMatch) ? (
          <div className="mt-4">
            <section className="rounded-2xl border border-[var(--color-border-default)] bg-white shadow-[0_1px_2px_rgba(26,26,46,0.04)]">
              <header className="flex items-center gap-2 border-b border-[var(--color-border-default)] px-5 py-3">
                <AlertTriangle className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Needs review
                </h3>
              </header>
              <div className="p-4">
                <RequestComparison
                  intakeMatch={request.intakeMatch}
                  directoryMatch={request.directoryMatch}
                  directory={directory}
                  requestPerson={request.person}
                  variant="detail"
                />
              </div>
            </section>
          </div>
        ) : null}

        {/* Notes from manager */}
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Notes from manager
          </p>
          {notesText ? (
            <blockquote className="rounded-r-xl border-l-4 border-[var(--color-brand-primary)] bg-[var(--color-surface-panel)] py-3 pl-4 pr-4 text-[15px] italic leading-relaxed text-[var(--color-text-primary)]">
              {formatManagerNotes(request)}
            </blockquote>
          ) : (
            <p className="flex items-center gap-2 rounded-r-xl border-l-4 border-[var(--color-border-default)] bg-[var(--color-surface-panel)] py-3 pl-4 text-sm italic text-[var(--color-text-muted)]">
              <Info className="h-4 w-4" aria-hidden="true" />
              No notes were added.
            </p>
          )}
        </div>

        {/* Action zone */}
        <div
          className="mt-8 overflow-hidden rounded-3xl p-5 shadow-lg sm:p-6"
          style={{ background: 'linear-gradient(160deg, #1f1f3a, #15152a)' }}
        >
          <h2 className="text-lg font-bold text-white sm:text-xl">Complete this request</h2>
          <p className="mt-1 text-sm text-white/60">
            Confirm you have {request.person.firstName} {accent.verb} in Power Music, then mark it done.
            This cannot be undone.
          </p>

          <label htmlFor="request-admin-note" className="mt-4 block text-xs font-semibold text-white/70">
            Admin note <span className="text-white/40">(optional)</span>
          </label>
          <textarea
            id="request-admin-note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note saved with this request…"
            rows={2}
            className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
          />

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={goBack}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/75 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a2e] ${accent.button}`}
              style={{ boxShadow: accent.glow }}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Mark as {accent.verb}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        confirm
        title="Confirm action"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2 border border-[var(--color-border-default)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              className="px-4 py-2 text-white text-sm font-semibold rounded-lg bg-[var(--color-brand-primary)] hover:bg-[var(--color-surface-sidebar-hover)] shadow-sm cursor-pointer"
            >
              Confirm
            </button>
          </>
        }
      >
        <p>
          Confirm you have {isAdd ? 'added' : 'removed'} <strong>{personName}</strong> in Power Music
          before continuing. This cannot be undone.
          {noteText.trim() ? (
            <span className="mt-2 block text-xs text-[var(--color-text-muted)]">
              Admin note: {noteText.trim()}
            </span>
          ) : null}
        </p>
      </Modal>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]/25 rounded"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      New Requests
    </button>
  );
}
