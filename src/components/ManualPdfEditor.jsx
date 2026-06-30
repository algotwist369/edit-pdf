import { MousePointerClick, Save, Square, Type, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { apiRequest } from '../api/client.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const scale = 1.2;

const EditorPage = ({
  pdf,
  pageIndex,
  tool,
  draftText,
  fontSize,
  bold,
  operations,
  setOperations,
  textEdits,
  setTextEdits
}) => {
  const canvasRef = useRef(null);
  const [pageSize, setPageSize] = useState(null);
  const [textBlocks, setTextBlocks] = useState([]);
  const [dragStart, setDragStart] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask;

    const render = async () => {
      const page = await pdf.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale });
      const unitViewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const blocks = content.items
        .filter((item) => item.str?.trim())
        .map((item, index) => {
          const [, , , transformHeight, x, baselineY] = item.transform;
          const height = Math.abs(item.height || transformHeight || 10);
          return {
            id: `${pageIndex}-${index}`,
            pageIndex,
            text: item.str,
            x,
            y: unitViewport.height - baselineY - height,
            width: Math.max(item.width || item.str.length * height * 0.5, 1),
            height,
            fontSize: height,
            bold: /f4|bold|black|heavy|semibold|demi/i.test(item.fontName || '')
          };
        });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageSize({ width: viewport.width, height: viewport.height });
      setTextBlocks(blocks);
      renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
      await renderTask.promise;
    };

    render().catch(() => {});
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [pdf, pageIndex]);

  const getPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale
    };
  };

  const addText = (event) => {
    const point = getPoint(event);
    setOperations((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: 'text',
        pageIndex,
        x: point.x,
        y: point.y,
        width: Math.max(draftText.length * fontSize * 0.55, 80),
        height: fontSize * 1.3,
        text: draftText,
        fontSize,
        bold,
        color: '#000000'
      }
    ]);
  };

  const finishWhiteout = (event) => {
    if (!dragStart || tool !== 'whiteout') return;
    const end = getPoint(event);
    const x = Math.min(dragStart.x, end.x);
    const y = Math.min(dragStart.y, end.y);
    const width = Math.abs(end.x - dragStart.x);
    const height = Math.abs(end.y - dragStart.y);
    setDragStart(null);
    if (width < 2 || height < 2) return;
    setOperations((current) => [
      ...current,
      { id: crypto.randomUUID(), type: 'whiteout', pageIndex, x, y, width, height }
    ]);
  };

  const pageOperations = operations.filter((operation) => operation.pageIndex === pageIndex);

  const updateTextBlock = (block, text) => {
    setTextEdits((current) => {
      const next = { ...current };
      if (text === block.text) delete next[block.id];
      else next[block.id] = { ...block, text };
      return next;
    });
  };

  return (
    <div className="relative mx-auto w-fit bg-white shadow-sm">
      <canvas ref={canvasRef} />
      {pageSize && (
        <div
          className="absolute inset-0"
          onClick={(event) => tool === 'text' && addText(event)}
          onPointerDown={(event) => tool === 'whiteout' && setDragStart(getPoint(event))}
          onPointerUp={finishWhiteout}
        >
          {tool === 'edit' &&
            textBlocks.map((block) => {
              const edited = textEdits[block.id];
              return (
                <input
                  className={`absolute rounded-sm border px-0.5 leading-none caret-brand outline-none transition focus:border-brand focus:bg-white/90 focus:text-slate-950 ${
                    edited
                      ? 'border-brand bg-white/90 text-slate-950'
                      : 'border-transparent bg-transparent text-transparent'
                  }`}
                  key={block.id}
                  onChange={(event) => updateTextBlock(block, event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    left: block.x * scale,
                    top: block.y * scale,
                    width: Math.max(block.width * scale, 14),
                    height: Math.max(block.height * scale * 1.3, 14),
                    fontSize: block.fontSize * scale,
                    fontWeight: block.bold ? 700 : 400
                  }}
                  title={block.text}
                  value={edited?.text ?? block.text}
                />
              );
            })}
          {pageOperations.map((operation) => (
            <div
              className={`absolute border ${
                operation.type === 'whiteout' ? 'border-rose-500 bg-white/80' : 'border-brand bg-teal-50/70'
              }`}
              key={operation.id}
              style={{
                left: operation.x * scale,
                top: operation.y * scale,
                width: operation.width * scale,
                height: operation.height * scale,
                fontSize: operation.fontSize ? operation.fontSize * scale : undefined,
                fontWeight: operation.bold ? 700 : 400
              }}
            >
              {operation.type === 'text' ? operation.text : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ManualPdfEditor = ({ batchId, file, token, variant, onClose, onSaved }) => {
  const [pdf, setPdf] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [tool, setTool] = useState('edit');
  const [draftText, setDraftText] = useState('New text');
  const [fontSize, setFontSize] = useState(10);
  const [bold, setBold] = useState(false);
  const [operations, setOperations] = useState([]);
  const [textEdits, setTextEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let loadingTask;

    const load = async () => {
      const blob = await apiRequest(`/api/pdf-batches/${batchId}/files/${file._id}/${variant}`, {
        token,
        responseType: 'blob'
      });
      const data = await blob.arrayBuffer();
      loadingTask = pdfjsLib.getDocument({ data });
      const loadedPdf = await loadingTask.promise;
      if (cancelled) return;
      setPdf(loadedPdf);
      setPageCount(loadedPdf.numPages);
    };

    load().catch((err) => setError(err.message));
    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
    };
  }, [batchId, file._id, token, variant]);

  const save = async () => {
    const editOperations = Object.values(textEdits).flatMap((block) => {
      const padX = Math.max(block.height * 0.12, 0.6);
      const padY = Math.max(block.height * 0.18, 0.8);
      return [
        {
          type: 'whiteout',
          pageIndex: block.pageIndex,
          x: Math.max(block.x - padX, 0),
          y: Math.max(block.y - padY, 0),
          width: block.width + padX * 2,
          height: block.height + padY * 2
        },
        {
          type: 'text',
          pageIndex: block.pageIndex,
          x: block.x,
          y: block.y,
          width: Math.max(block.width, block.text.length * block.fontSize * 0.55),
          height: block.height,
          text: block.text,
          fontSize: block.fontSize,
          bold: block.bold,
          color: '#000000'
        }
      ];
    });
    const saveOperations = [...operations, ...editOperations];
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/pdf-batches/${batchId}/files/${file._id}/manual-edits`, {
        method: 'POST',
        token,
        body: { baseVariant: variant, operations: saveOperations }
      });
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 text-sm">
        <button
          className={`focus-ring flex items-center gap-2 rounded-md border px-3 py-2 ${
            tool === 'edit' ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white'
          }`}
          type="button"
          onClick={() => setTool('edit')}
        >
          <MousePointerClick size={15} /> Edit text
        </button>
        <button
          className={`focus-ring flex items-center gap-2 rounded-md border px-3 py-2 ${
            tool === 'whiteout' ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white'
          }`}
          type="button"
          onClick={() => setTool('whiteout')}
        >
          <Square size={15} /> White-out
        </button>
        <button
          className={`focus-ring flex items-center gap-2 rounded-md border px-3 py-2 ${
            tool === 'text' ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white'
          }`}
          type="button"
          onClick={() => setTool('text')}
        >
          <Type size={15} /> Text
        </button>
        <input
          className="focus-ring min-w-56 rounded-md border border-slate-300 px-3 py-2"
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
        />
        <input
          className="focus-ring w-20 rounded-md border border-slate-300 px-2 py-2"
          min="4"
          max="72"
          type="number"
          value={fontSize}
          onChange={(event) => setFontSize(Number(event.target.value))}
        />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={bold} onChange={(event) => setBold(event.target.checked)} />
          Bold
        </label>
        <button
          className="focus-ring flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 disabled:opacity-50"
          type="button"
          disabled={!operations.length && !Object.keys(textEdits).length}
          onClick={() => {
            if (operations.length) setOperations((current) => current.slice(0, -1));
            else setTextEdits({});
          }}
        >
          <Undo2 size={15} /> Undo
        </button>
        <button
          className="focus-ring ml-auto flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-white disabled:opacity-50"
          type="button"
          disabled={saving || (!operations.length && !Object.keys(textEdits).length)}
          onClick={save}
        >
          <Save size={15} /> {saving ? 'Saving...' : 'Save PDF'}
        </button>
        <button className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-2" type="button" onClick={onClose}>
          Preview
        </button>
      </div>
      {error && <div className="bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-slate-100 p-4">
        <div className="w-max min-w-full space-y-4 pb-6">
        {pdf
          ? Array.from({ length: pageCount }, (_, index) => (
              <EditorPage
                bold={bold}
                draftText={draftText}
                fontSize={fontSize}
                key={index}
                operations={operations}
                pageIndex={index}
                pdf={pdf}
                setOperations={setOperations}
                setTextEdits={setTextEdits}
                textEdits={textEdits}
                tool={tool}
              />
            ))
          : <div className="text-sm text-slate-500">Loading editor...</div>}
        </div>
      </div>
    </div>
  );
};

