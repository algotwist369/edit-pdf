import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const formatBytes = (bytes) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const PdfPreviewItem = ({ file, index }) => {
  const pagesRef = useRef(null);
  const [message, setMessage] = useState('Rendering preview...');

  useEffect(() => {
    let cancelled = false;
    let renderTask;

    const render = async () => {
      const container = pagesRef.current;
      if (!container) return;
      container.replaceChildren();
      setMessage('Rendering preview...');

      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.55 });
        if (cancelled) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'mx-auto max-w-full bg-white shadow-sm';
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);

        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
        await renderTask.promise;
      }
      if (!cancelled) setMessage(`${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}`);
    };

    render().catch(() => {
      if (!cancelled) setMessage('Preview unavailable');
    });

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [file]);

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="truncate text-sm font-medium">
          {index + 1}. {file.name}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">{formatBytes(file.size)} - {message}</div>
      </div>
      <div ref={pagesRef} className="max-h-80 space-y-3 overflow-auto bg-slate-100 p-2" />
    </div>
  );
};

export const LocalPdfPreview = ({ files = [] }) => (
  <div className="rounded-md border border-slate-200 bg-white p-3">
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="text-xs font-medium uppercase text-slate-500">Previews</div>
      <div className="text-xs text-slate-500">{files.length} selected</div>
    </div>
    <div className="max-h-[720px] space-y-3 overflow-y-auto rounded-md bg-panel p-2">
      {files.length ? (
        files.map((file, index) => (
          <PdfPreviewItem file={file} index={index} key={`${file.name}-${file.size}-${file.lastModified}`} />
        ))
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Select PDFs to preview
        </div>
      )}
    </div>
  </div>
);
