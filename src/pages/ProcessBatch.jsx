import { Download, Edit3, Eye, FileJson, Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { apiBaseUrl, apiRequest } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { ManualPdfEditor } from '../components/ManualPdfEditor.jsx';
import { useAuth } from '../state/auth.jsx';

const formatDuration = (ms) => {
  if (ms == null) return 'Not available';
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

const isRunning = (status) => ['queued', 'processing'].includes(status);
const isFinished = (status) => ['completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(status);

export const ProcessBatch = () => {
  const { batchId } = useParams();
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [realtimeState, setRealtimeState] = useState('connecting');
  const [review, setReview] = useState(null);
  const [reviewUrl, setReviewUrl] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const realtimeConnectedRef = useRef(false);

  const refresh = async () => {
    const [statusPayload, filesPayload, resultsPayload] = await Promise.all([
      apiRequest(`/api/pdf-batches/${batchId}/status`, { token }),
      apiRequest(`/api/pdf-batches/${batchId}/files`, { token }),
      apiRequest(`/api/pdf-batches/${batchId}/results`, { token })
    ]);
    setStatus(statusPayload);
    setFiles(filesPayload.files);
    setResults(resultsPayload.results);
  };

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
    const refreshTimer = setInterval(() => {
      if (!realtimeConnectedRef.current) refresh().catch(() => {});
    }, 15000);
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);
    const socket = io(apiBaseUrl, {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      realtimeConnectedRef.current = true;
      setRealtimeState('connected');
      socket.emit('batch:join', { batchId });
    });
    socket.on('disconnect', () => {
      realtimeConnectedRef.current = false;
      setRealtimeState('polling');
    });
    socket.on('batch:status', (payload) => {
      if (String(payload.batchId) === String(batchId)) {
        setStatus(payload);
        if (payload.files) setFiles(payload.files);
        if (payload.results) setResults(payload.results);
      }
    });
    socket.on('connect_error', () => {
      realtimeConnectedRef.current = false;
      setRealtimeState('polling');
    });

    return () => {
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
      realtimeConnectedRef.current = false;
      socket.emit('batch:leave', { batchId });
      socket.disconnect();
    };
  }, [batchId, token]);

  useEffect(
    () => () => {
      if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    },
    [reviewUrl]
  );

  const start = async () => {
    setError('');
    try {
      await apiRequest(`/api/pdf-batches/${batchId}/process`, { method: 'POST', token });
      if (!realtimeConnectedRef.current) await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const download = async (path, filename) => {
    setError('');
    try {
      const blob = await apiRequest(path, { token, responseType: 'blob' });
      if (!(blob instanceof Blob)) {
        throw new Error('Download response was not a file');
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
      await refresh().catch(() => {});
    }
  };

  const openReview = async (result, variant = 'edited') => {
    setError('');
    const file = files.find((candidate) => String(candidate._id) === String(result.fileId));
    try {
      const blob = await apiRequest(`/api/pdf-batches/${batchId}/files/${result.fileId}/${variant}`, {
        token,
        responseType: 'blob'
      });
      if (!(blob instanceof Blob)) throw new Error('Review response was not a PDF');
      if (reviewUrl) URL.revokeObjectURL(reviewUrl);
      setReviewUrl(URL.createObjectURL(blob));
      setReview({ result, file, variant });
    } catch (err) {
      setError(err.message);
    }
  };

  const closeReview = () => {
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl('');
    setReview(null);
    setEditorOpen(false);
  };

  const controlBatch = async (action) => {
    setError('');
    try {
      const payload = await apiRequest(`/api/pdf-batches/${batchId}/${action}`, {
        method: 'POST',
        token
      });
      setStatus(payload);
      if (!realtimeConnectedRef.current) await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const liveElapsedMs = (() => {
    if (!status?.timing?.startedAt) return 0;
    if (status.timing.durationMs != null) return status.timing.durationMs;
    return Math.max(now - new Date(status.timing.startedAt).getTime(), 0);
  })();

  const zipReady = Boolean(status?.artifacts?.zipReady);
  const reportReady = Boolean(status?.artifacts?.reportReady);
  const filesById = new Map(files.map((file) => [String(file._id), file]));
  const canProcess =
    !status ||
    (!isRunning(status.status) && !['completed', 'cancelled'].includes(status.status));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Process batch</h1>
          <div className="mt-2">{status && <StatusBadge status={status.status} />}</div>
          <div className="mt-1 text-xs text-slate-500">
            Realtime: {realtimeState === 'connected' ? 'connected' : 'slow polling fallback'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="focus-ring flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={start}
            disabled={!canProcess}
          >
            <Play size={16} /> {status?.status === 'completed_with_warnings' || status?.status === 'failed' ? 'Reprocess' : 'Process'}
          </button>
          <button
            className="focus-ring rounded-md border border-slate-300 bg-white px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!status || !isRunning(status.status)}
            onClick={() => controlBatch('pause')}
          >
            Pause
          </button>
          <button
            className="focus-ring rounded-md border border-slate-300 bg-white px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={status?.status !== 'paused'}
            onClick={() => controlBatch('resume')}
          >
            Resume
          </button>
          <button
            className="focus-ring rounded-md border border-rose-300 bg-white px-4 py-2 text-sm text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!status || isFinished(status.status) || status.status === 'cancelled'}
            onClick={() => controlBatch('cancel')}
          >
            Cancel
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {status && (
        <>
          <section className="mt-6 rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">
                  {status.progress.processedFiles} of {status.progress.totalFiles} PDFs processed
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Elapsed {formatDuration(liveElapsedMs)}
                  {!isFinished(status.status) &&
                    ` - Estimated remaining ${formatDuration(status.timing.estimatedRemainingMs)}`}
                </div>
              </div>
              <div className="text-2xl font-semibold">{status.progress.progressPercent}%</div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded bg-slate-100">
              <div
                className="h-full rounded bg-brand transition-all"
                style={{ width: `${status.progress.progressPercent}%` }}
              />
            </div>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-md bg-panel p-3">
                <div className="text-xs uppercase text-slate-500">Started</div>
                <div className="mt-1">
                  {status.timing.startedAt ? new Date(status.timing.startedAt).toLocaleString() : 'Not started'}
                </div>
              </div>
              <div className="rounded-md bg-panel p-3">
                <div className="text-xs uppercase text-slate-500">Total time</div>
                <div className="mt-1">{formatDuration(status.timing.durationMs ?? liveElapsedMs)}</div>
              </div>
              <div className="rounded-md bg-panel p-3">
                <div className="text-xs uppercase text-slate-500">Artifacts</div>
                <div className="mt-1">{zipReady && reportReady ? 'ZIP and report ready' : 'Generating after processing'}</div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-3 md:grid-cols-5">
            {Object.entries(status.totals).map(([key, value]) => (
              <div className="rounded-md border border-slate-200 bg-white p-4" key={key}>
                <div className="text-xs uppercase text-slate-500">{key.replaceAll(/([A-Z])/g, ' $1')}</div>
                <div className="mt-1 text-2xl font-semibold">{value}</div>
              </div>
            ))}
          </section>
        </>
      )}

      <section className="mt-6 rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-medium">Files</div>
        <div className="max-h-80 overflow-y-auto">
          {files.map((file) => (
            <div className="grid grid-cols-[1fr_170px_120px] items-center border-b border-slate-100 px-4 py-3 text-sm" key={file._id}>
              <div>
                <div className="font-medium">{file.originalName}</div>
                <div className="text-xs text-slate-500">
                  {file.documentType} ({file.documentTypeSource || 'none'}
                  {file.documentTypeConfidence ? ` ${Math.round(file.documentTypeConfidence * 100)}%` : ''}) -{' '}
                  {file.replacementCount} replacements
                </div>
              </div>
              <StatusBadge status={file.status} />
              <div className="text-right text-slate-500">{file.failureReason}</div>
            </div>
          ))}
        </div>
      </section>

      {results.length > 0 && (
        <section className="mt-6 rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 font-medium">Rule results</div>
          <div className="max-h-80 overflow-y-auto">
            {results.map((result) => {
              const file = filesById.get(String(result.fileId));
              return (
                <div className="grid grid-cols-[1fr_160px_2fr_110px] gap-3 border-b border-slate-100 px-4 py-3 text-sm" key={result._id}>
                  <div>
                    <div className="font-medium">{file?.originalName || 'Unknown file'}</div>
                    <div className="text-xs text-slate-500">
                      {result.replacements?.length || 0} matched area
                      {(result.replacements?.length || 0) === 1 ? '' : 's'}
                    </div>
                  </div>
                  <StatusBadge status={result.status} />
                  <div className="text-slate-600">{result.reason || 'Completed without warnings'}</div>
                  <div className="flex justify-end">
                    <button
                      className="focus-ring flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      disabled={!file}
                      onClick={() => openReview(result, file?.editedKey ? 'edited' : 'original')}
                    >
                      <Eye size={15} /> Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {review && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 p-4">
          <div className="mx-auto flex h-full max-h-[calc(100vh-2rem)] max-w-6xl flex-col overflow-hidden rounded-md bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <div className="font-medium">{review.file?.originalName || 'PDF review'}</div>
                <div className="text-xs text-slate-500">{review.result.reason || review.result.status}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`focus-ring rounded-md border px-3 py-2 text-sm ${
                    review.variant === 'original' ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white'
                  }`}
                  type="button"
                  onClick={() => openReview(review.result, 'original')}
                >
                  Original
                </button>
                <button
                  className={`focus-ring rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                    review.variant === 'edited' ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white'
                  }`}
                  type="button"
                  disabled={!review.file?.editedKey}
                  onClick={() => openReview(review.result, 'edited')}
                >
                  Edited
                </button>
                <button
                  className="focus-ring flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  type="button"
                  onClick={() => setEditorOpen(true)}
                >
                  <Edit3 size={15} /> Edit PDF
                </button>
                <button
                  className="focus-ring rounded-md border border-slate-300 bg-white p-2"
                  type="button"
                  onClick={closeReview}
                  aria-label="Close review"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden bg-slate-100">
              {editorOpen ? (
                <ManualPdfEditor
                  batchId={batchId}
                  file={review.file}
                  onClose={() => setEditorOpen(false)}
                  onSaved={async () => {
                    setEditorOpen(false);
                    await refresh();
                    await openReview(review.result, 'edited');
                  }}
                  token={token}
                  variant={review.variant}
                />
              ) : reviewUrl ? (
                <iframe className="h-full w-full" src={reviewUrl} title="PDF review" />
              ) : (
                <div className="p-6 text-sm text-slate-500">Loading PDF...</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          className="focus-ring flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!zipReady}
          onClick={() => download(`/api/pdf-batches/${batchId}/download-zip`, `${batchId}-edited-pdfs.zip`)}
        >
          <Download size={16} /> {zipReady ? 'ZIP' : 'ZIP not ready'}
        </button>
        <button
          className="focus-ring flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!reportReady}
          onClick={() => download(`/api/pdf-batches/${batchId}/report`, `${batchId}-report.json`)}
        >
          <FileJson size={16} /> {reportReady ? 'Report' : 'Report not ready'}
        </button>
      </div>
    </div>
  );
};

