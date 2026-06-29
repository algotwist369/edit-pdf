import { Plus, Trash2, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { LocalPdfPreview } from '../components/LocalPdfPreview.jsx';
import { useAuth } from '../state/auth.jsx';

const emptyRule = {
  old_text: '',
  new_text: '',
  match_type: 'exact',
  replace_scope: 'all',
  apply_to: 'all',
  auto_resize_font: true,
  allow_multiline: false
};

export const CreateBatch = () => {
  const [name, setName] = useState('');
  const [files, setFiles] = useState([]);
  const [rules, setRules] = useState([{ ...emptyRule }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (files.length > 50) throw new Error('Maximum 50 PDFs are allowed in one batch');
      const data = new FormData();
      data.append('name', name);
      files.forEach((file) => data.append('files', file));
      const uploaded = await apiRequest('/api/pdf-batches/upload', { method: 'POST', body: data, token });
      await apiRequest(`/api/pdf-batches/${uploaded.batch._id}/rules`, {
        method: 'POST',
        body: { rules },
        token
      });
      navigate(`/batches/${uploaded.batch._id}/process`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateRule = (index, patch) => {
    setRules((current) => current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)));
  };

  return (
    <form onSubmit={submit}>
      <h1 className="text-2xl font-semibold">Create PDF batch</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <label className="text-sm font-medium">Batch name</label>
            <input
              className="focus-ring mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="June invoice corrections"
            />
            <label className="mt-5 block text-sm font-medium">PDF files</label>
            <div className="mt-2 rounded-md border border-dashed border-slate-300 bg-panel p-5">
              <UploadCloud className="mb-3 text-brand" />
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
              <div className="mt-3 text-sm text-slate-600">{files.length} selected, limit 50 PDFs</div>
            </div>
            {files.length > 0 && (
              <ul className="mt-4 max-h-52 overflow-auto text-sm text-slate-700">
                {files.map((file) => (
                  <li className="border-b border-slate-100 py-2" key={`${file.name}-${file.size}`}>
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Replacement rules</h2>
              <button
                type="button"
                className="focus-ring rounded-md border border-slate-300 p-2"
                onClick={() => setRules([...rules, { ...emptyRule }])}
                title="Add rule"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {rules.map((rule, index) => (
                <div className="rounded-md border border-slate-200 p-3" key={index}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Rule {index + 1}</span>
                    <button
                      className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                      type="button"
                      onClick={() => setRules(rules.filter((_, ruleIndex) => ruleIndex !== index))}
                      title="Remove rule"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <textarea
                    className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Replace this text"
                    value={rule.old_text}
                    onChange={(event) => updateRule(index, { old_text: event.target.value })}
                  />
                  <textarea
                    className="focus-ring mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="With this text"
                    value={rule.new_text}
                    onChange={(event) => updateRule(index, { new_text: event.target.value })}
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select
                      className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                      value={rule.match_type}
                      onChange={(event) => updateRule(index, { match_type: event.target.value })}
                    >
                      <option value="exact">Exact</option>
                      <option value="case_insensitive">Case insensitive</option>
                      <option value="fuzzy">Fuzzy</option>
                      <option value="ai">AI assisted</option>
                    </select>
                    <select
                      className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                      value={rule.replace_scope}
                      onChange={(event) => updateRule(index, { replace_scope: event.target.value })}
                    >
                      <option value="first">First</option>
                      <option value="all">All</option>
                      <option value="manual_selected">Manual selected</option>
                    </select>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rule.allow_multiline}
                      onChange={(event) => updateRule(index, { allow_multiline: event.target.checked })}
                    />
                    Allow multiline replacement
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>
        <LocalPdfPreview files={files} />
      </div>
      {error && <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <button className="focus-ring mt-6 rounded-md bg-brand px-5 py-2 font-medium text-white" disabled={busy}>
        {busy ? 'Creating...' : 'Create and continue'}
      </button>
    </form>
  );
};
