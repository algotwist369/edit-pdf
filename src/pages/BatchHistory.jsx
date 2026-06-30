import { Pause, Play, Square, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useAuth } from '../state/auth.jsx';

const canPause = (status) => ['queued', 'processing'].includes(status);
const canResume = (status) => status === 'paused';
const canCancel = (status) => !['completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(status);
const canDelete = (status) => !['queued', 'processing'].includes(status);

export const BatchHistory = () => {
  const { token } = useAuth();
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [deletingBatchId, setDeletingBatchId] = useState('');

  const load = async () => {
    const payload = await apiRequest('/api/pdf-batches', { token });
    setBatches(payload.batches);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  const controlBatch = async (event, batchId, action) => {
    event.preventDefault();
    event.stopPropagation();
    setError('');
    try {
      await apiRequest(`/api/pdf-batches/${batchId}/${action}`, { method: 'POST', token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteBatch = async (event, batch) => {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm(`Delete "${batch.name}" and all related PDFs, reports, and ZIP files?`)) return;

    setError('');
    setDeletingBatchId(batch._id);
    try {
      await apiRequest(`/api/pdf-batches/${batch._id}`, { method: 'DELETE', token });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingBatchId('');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Batch history</h1>
      {error && <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <section className="mt-6 rounded-md border border-slate-200 bg-white">
        {batches.map((batch) => (
          <Link
            className="grid grid-cols-[1fr_150px_230px_130px] items-center border-b border-slate-100 px-4 py-3 text-sm hover:bg-panel"
            key={batch._id}
            to={`/batches/${batch._id}/process`}
          >
            <div>
              <div className="font-medium">{batch.name}</div>
              <div className="text-xs text-slate-500">
                {batch.totalFiles} PDFs - {batch.totalReplacements} replacements
              </div>
            </div>
            <StatusBadge status={batch.status} />
            <div className="flex justify-end gap-2">
              <button
                className="focus-ring rounded-md border border-slate-300 p-2 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canPause(batch.status)}
                onClick={(event) => controlBatch(event, batch._id, 'pause')}
                title="Pause batch"
                type="button"
              >
                <Pause size={15} />
              </button>
              <button
                className="focus-ring rounded-md border border-slate-300 p-2 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canResume(batch.status)}
                onClick={(event) => controlBatch(event, batch._id, 'resume')}
                title="Resume batch"
                type="button"
              >
                <Play size={15} />
              </button>
              <button
                className="focus-ring rounded-md border border-rose-300 p-2 text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canCancel(batch.status)}
                onClick={(event) => controlBatch(event, batch._id, 'cancel')}
                title="Cancel batch"
                type="button"
              >
                <Square size={15} />
              </button>
              <button
                className="focus-ring rounded-md border border-rose-300 bg-rose-50 p-2 text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={deletingBatchId === batch._id || !canDelete(batch.status)}
                onClick={(event) => deleteBatch(event, batch)}
                title="Delete batch history"
                type="button"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="text-right text-slate-500">{new Date(batch.createdAt).toLocaleDateString()}</div>
          </Link>
        ))}
        {!batches.length && <div className="p-6 text-sm text-slate-600">No batches yet.</div>}
      </section>
    </div>
  );
};

