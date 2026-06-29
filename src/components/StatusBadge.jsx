const colorMap = {
  completed: 'bg-emerald-100 text-emerald-800',
  completed_with_warnings: 'bg-amber-100 text-amber-800',
  failed: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-rose-100 text-rose-800',
  paused: 'bg-orange-100 text-orange-800',
  processing: 'bg-sky-100 text-sky-800',
  queued: 'bg-indigo-100 text-indigo-800',
  replaced: 'bg-emerald-100 text-emerald-800',
  skipped_not_found: 'bg-amber-100 text-amber-800',
  skipped_same_value: 'bg-slate-100 text-slate-700',
  invalid_rule: 'bg-rose-100 text-rose-800',
  review_required: 'bg-orange-100 text-orange-800',
  uploaded: 'bg-slate-100 text-slate-700'
};

export const StatusBadge = ({ status }) => (
  <span className={`rounded px-2 py-1 text-xs font-medium ${colorMap[status] || 'bg-slate-100 text-slate-700'}`}>
    {status?.replaceAll('_', ' ')}
  </span>
);
