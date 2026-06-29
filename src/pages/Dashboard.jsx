import { ArrowRight, FileUp, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard = () => (
  <div>
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Create a batch, add replacement rules, and process up to 50 PDFs.</p>
      </div>
      <Link className="focus-ring flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white" to="/batches/new">
        <FileUp size={17} /> New batch
      </Link>
    </div>
    <section className="mt-8 grid gap-4 md:grid-cols-3">
      {[
        ['Upload', 'Validate PDFs, size limits, names, and hash originals.'],
        ['Analyze', 'Extract text coordinates and prepare matches for each rule.'],
        ['Export', 'Download edited PDFs as a ZIP plus JSON/CSV reports.']
      ].map(([title, body]) => (
        <div className="rounded-md border border-slate-200 bg-white p-5" key={title}>
          <ShieldCheck className="mb-4 text-brand" size={22} />
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">{body}</p>
        </div>
      ))}
    </section>
    <Link className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-brand" to="/history">
      View batch history <ArrowRight size={16} />
    </Link>
  </div>
);
