'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_COLORS, CATEGORY_OPTIONS, UNIT_OPTIONS, type Category, type Unit } from '@/lib/constants';

type Annotation = {
  id: number;
  page: number;
  x: number;
  y: number;
  value: number;
  unit: string;
  category: string;
  comment: string;
  createdAt: string;
};

type SelectedPoint = {
  page: number;
  x: number;
  y: number;
};

type SummaryGroup = {
  key: string;
  category: string;
  unit: string;
  total: number;
  items: Annotation[];
};

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), {
  ssr: false
});

const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), {
  ssr: false
});

const PDF_FILE = '/202507031530519778.pdf';

const formatNumber = (value: number) => {
  const formatted = value.toFixed(2);
  return formatted.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const getCategoryColor = (category: string): string => {
  return CATEGORY_COLORS[category as Category] ?? '#64748b';
};

const ensurePromiseWithResolversPolyfill = () => {
  const promiseCtor = Promise as PromiseConstructor;
  const withResolvers = (promiseCtor as any).withResolvers as undefined | (() => unknown);

  if (!withResolvers) {
    (promiseCtor as any).withResolvers = () => {
      let resolve!: (value: unknown | PromiseLike<unknown>) => void;
      let reject!: (reason?: unknown) => void;

      const promise = new Promise<unknown>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return { promise, resolve, reject };
    };
  }
};

export default function HomePage() {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [pdfWidth, setPdfWidth] = useState(860);
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [isPdfReady, setIsPdfReady] = useState(false);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<number | null>(null);

  const [category, setCategory] = useState<Category>(CATEGORY_OPTIONS[0]);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<Unit>(UNIT_OPTIONS[0]);
  const [comment, setComment] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pdfHeight = useMemo(() => {
    if (!baseSize) return 640;
    return (baseSize.height / baseSize.width) * pdfWidth;
  }, [baseSize, pdfWidth]);

  const selectedCategoryColor = useMemo(() => getCategoryColor(category), [category]);
  const isEditMode = editingAnnotationId !== null;

  const summaryGroups = useMemo<SummaryGroup[]>(() => {
    const map = new Map<string, SummaryGroup>();

    annotations.forEach((item) => {
      const key = `${item.category}__${item.unit}`;
      const found = map.get(key);
      if (found) {
        found.items.push(item);
        found.total += item.value;
      } else {
        map.set(key, {
          key,
          category: item.category,
          unit: item.unit,
          total: item.value,
          items: [item]
        });
      }
    });

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => a.id - b.id)
      }))
      .sort((a, b) => a.category.localeCompare(b.category, 'ja'));
  }, [annotations]);

  const resetForm = useCallback(() => {
    setEditingAnnotationId(null);
    setSelectedPoint(null);
    setCategory(CATEGORY_OPTIONS[0]);
    setValue('');
    setUnit(UNIT_OPTIONS[0]);
    setComment('');
  }, []);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/annotations', { cache: 'no-store' });

    if (!res.ok) {
      throw new Error('API request failed');
    }

    const annotationsJson = (await res.json()) as Annotation[];
    setAnnotations(annotationsJson);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        ensurePromiseWithResolversPolyfill();
        const { pdfjs } = await import('react-pdf');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs?v=4.8.69';
        if (mounted) {
          setIsPdfReady(true);
        }
      } catch {
        if (mounted) {
          setErrorMessage('PDFライブラリの初期化に失敗しました。');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 920;
      setPdfWidth(Math.max(360, Math.floor(width - 48)));
    });

    if (viewerRef.current) {
      observer.observe(viewerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        await loadData();
      } catch {
        setErrorMessage('初期データの読み込みに失敗しました。');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadData]);

  const handlePdfClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    setSelectedPoint({ page: 1, x, y });
    setErrorMessage(null);
  };

  const handleMarkerSelect = (annotation: Annotation) => {
    const nextCategory = CATEGORY_OPTIONS.includes(annotation.category as Category)
      ? (annotation.category as Category)
      : CATEGORY_OPTIONS[0];
    const nextUnit = UNIT_OPTIONS.includes(annotation.unit as Unit) ? (annotation.unit as Unit) : UNIT_OPTIONS[0];

    setEditingAnnotationId(annotation.id);
    setCategory(nextCategory);
    setUnit(nextUnit);
    setValue(String(annotation.value));
    setComment(annotation.comment ?? '');
    setSelectedPoint({
      page: annotation.page,
      x: annotation.x,
      y: annotation.y
    });
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!selectedPoint) {
      setErrorMessage('PDF上で位置を選択してください。');
      return;
    }

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      setErrorMessage('数値を入力してください。');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const endpoint = isEditMode ? `/api/annotations/${editingAnnotationId}` : '/api/annotations';
      const method = isEditMode ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedPoint,
          value: parsedValue,
          unit,
          category,
          comment
        })
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? '保存に失敗しました。');
      }

      await loadData();
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました。';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || editingAnnotationId === null) {
      return;
    }

    const ok = window.confirm(`マーカー #${editingAnnotationId} を削除しますか？`);
    if (!ok) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/annotations/${editingAnnotationId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? '削除に失敗しました。');
      }

      await loadData();
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : '削除に失敗しました。';
      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
          <h1 className="mb-3 text-lg font-semibold">PDFビュー</h1>
          <div ref={viewerRef} className="h-[75vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="relative mx-auto" style={{ width: pdfWidth, height: pdfHeight }}>
              {isPdfReady ? (
                <PdfDocument
                  file={PDF_FILE}
                  loading={<p className="text-sm text-slate-600">PDFを読み込み中...</p>}
                  error={<p className="text-sm text-rose-600">PDFの読み込みに失敗しました。</p>}
                >
                  <PdfPage
                    pageNumber={1}
                    width={pdfWidth}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    onLoadSuccess={(page: any) => {
                      const viewport = page.getViewport({ scale: 1 });
                      setBaseSize({ width: viewport.width, height: viewport.height });
                    }}
                  />
                </PdfDocument>
              ) : (
                <p className="text-sm text-slate-600">PDFライブラリを初期化中...</p>
              )}

              <button
                type="button"
                className="absolute inset-0 z-0 cursor-crosshair bg-transparent"
                onClick={handlePdfClick}
                aria-label="PDF上の位置を選択"
              />

              {annotations.map((item) => {
                const markerColor = getCategoryColor(item.category);
                const isEditing = item.id === editingAnnotationId;
                return (
                  <div key={item.id} className={`absolute ${isEditing ? 'z-20' : 'z-10'}`} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}>
                    <button
                      type="button"
                      className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMarkerSelect(item);
                      }}
                      aria-label={`マーカー${item.id}`}
                    >
                      <div
                        className={`h-3 w-3 rounded-full border border-white shadow ${isEditing ? 'ring-2 ring-slate-900/40' : ''}`}
                        style={{ backgroundColor: markerColor }}
                      />
                    </button>

                    <button
                      type="button"
                      className="pointer-events-auto absolute left-2 top-2 w-[100px] max-w-[100px] break-words rounded border px-1.5 py-0.5 text-left text-[10px] leading-tight text-slate-800"
                      style={{
                        borderColor: markerColor,
                        backgroundColor: `${markerColor}22`
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMarkerSelect(item);
                      }}
                    >
                      <div>
                        {item.category} {formatNumber(item.value)} {item.unit}
                      </div>
                      {item.comment && <div className="mt-0.5 text-slate-700">{item.comment}</div>}
                    </button>
                  </div>
                );
              })}

              {selectedPoint && (
                <div className="pointer-events-none absolute z-20" style={{ left: `${selectedPoint.x * 100}%`, top: `${selectedPoint.y * 100}%` }}>
                  <div
                    className="h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: isEditMode ? selectedCategoryColor : '#0ea5e9' }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">入力パネル</h2>
            <div className="space-y-3 text-sm">
              {isEditMode && (
                <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span>編集中: マーカー #{editingAnnotationId}</span>
                  <button
                    type="button"
                    className="rounded bg-white px-2 py-1 text-slate-700"
                    onClick={() => {
                      resetForm();
                      setErrorMessage(null);
                    }}
                  >
                    新規作成に戻す
                  </button>
                </div>
              )}

              <div>
                <label className="mb-1 block font-medium">カテゴリ</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as Category)}
                >
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: selectedCategoryColor }} />
                  <span className="text-xs text-slate-700">選択中: {category}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium">数値</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="例: 6.25"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium">単位</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as Unit)}
                >
                  {UNIT_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium">コメント</label>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="任意コメント"
                />
              </div>

              <div className="rounded-lg bg-slate-100 p-2 text-xs text-slate-700">
                {selectedPoint
                  ? isEditMode
                    ? `編集中の位置: page ${selectedPoint.page}, x=${selectedPoint.x.toFixed(3)}, y=${selectedPoint.y.toFixed(3)}（PDFをクリックで移動）`
                    : `選択位置: page ${selectedPoint.page}, x=${selectedPoint.x.toFixed(3)}, y=${selectedPoint.y.toFixed(3)}`
                  : isEditMode
                    ? 'PDF上をクリックして編集中マーカーの位置を更新してください。'
                    : 'PDF上をクリックして位置を選択してください。'}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting || isDeleting}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
                >
                  {isSubmitting ? (isEditMode ? '更新中...' : '保存中...') : isEditMode ? '更新' : '保存'}
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!isEditMode || isSubmitting || isDeleting}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeleting ? '削除中...' : '削除'}
                </button>
              </div>

              {errorMessage && <p className="text-xs text-rose-600">{errorMessage}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">集計パネル（明細 + 合計）</h2>
            {isLoading ? (
              <p className="text-sm text-slate-600">読み込み中...</p>
            ) : summaryGroups.length === 0 ? (
              <p className="text-sm text-slate-600">データがありません。</p>
            ) : (
              <div className="space-y-3">
                {summaryGroups.map((group) => {
                  const rowColor = getCategoryColor(group.category);
                  return (
                    <div key={group.key} className="rounded-lg border-l-4 bg-slate-50 p-2" style={{ borderLeftColor: rowColor }}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium" style={{ color: rowColor }}>
                          {group.category}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: rowColor }}>
                          合計 {formatNumber(group.total)} {group.unit}
                        </span>
                      </div>

                      <ul className="space-y-1 text-xs">
                        {group.items.map((item) => (
                          <li key={item.id} className="rounded bg-white px-2 py-1">
                            <button
                              type="button"
                              className="w-full text-left text-slate-700"
                              onClick={() => handleMarkerSelect(item)}
                            >
                              {group.category} {formatNumber(item.value)} {group.unit}
                              {item.comment ? ` / ${item.comment}` : ''}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">注釈件数: {annotations.length}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
