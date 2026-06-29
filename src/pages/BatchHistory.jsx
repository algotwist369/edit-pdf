import { Pause, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useAuth } from '../state/auth.jsx';

const canPause = (status) => ['queued', 'processing'].includes(status);
const canResume = (status) => status === 'paused';
const canCancel = (status) => !['completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(status);

export const BatchHistory = () => {
  const { token } = useAuth();
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');

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

  return (
    <div>
      <h1 className="text-2xl font-semibold">Batch history</h1>
      {error && <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <section className="mt-6 rounded-md border border-slate-200 bg-white">
        {batches.map((batch) => (
          <Link
            className="grid grid-cols-[1fr_150px_190px_130px] items-center border-b border-slate-100 px-4 py-3 text-sm hover:bg-panel"
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
              >
                <Pause size={15} />
              </button>
              <button
                className="focus-ring rounded-md border border-slate-300 p-2 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canResume(batch.status)}
                onClick={(event) => controlBatch(event, batch._id, 'resume')}
                title="Resume batch"
              >
                <Play size={15} />
              </button>
              <button
                className="focus-ring rounded-md border border-rose-300 p-2 text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canCancel(batch.status)}
                onClick={(event) => controlBatch(event, batch._id, 'cancel')}
                title="Cancel batch"
              >
                <Square size={15} />
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
