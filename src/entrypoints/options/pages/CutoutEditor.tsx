import { useRef, useEffect, useState, useCallback } from "react";

const CHECKER = 12;

interface Props {
  originalUrl: string;
  cutoutUrl: string;
  onConfirm: (finalUrl: string) => void;
  onCancel: () => void;
}

function makeCheckerCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < h; y += CHECKER) {
    for (let x = 0; x < w; x += CHECKER) {
      ctx.fillStyle = ((x / CHECKER + y / CHECKER) % 2 === 0) ? "#ebebeb" : "#d0d0d0";
      ctx.fillRect(x, y, CHECKER, CHECKER);
    }
  }
  return c;
}

export default function CutoutEditor({ originalUrl, cutoutUrl, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // GPU-side canvases — no ImageData in the hot path
  const workRef = useRef<HTMLCanvasElement | null>(null);    // current cutout (mutable)
  const origRef = useRef<HTMLCanvasElement | null>(null);    // original photo (for restore)
  const tmpRef  = useRef<HTMLCanvasElement | null>(null);    // scratch canvas for restore blend
  const checkerRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef  = useRef<number | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef   = useRef<{ x: number; y: number } | null>(null);
  const rectRef      = useRef<DOMRect | null>(null);         // cached bounding rect

  const [mode, setMode] = useState<"erase" | "restore">("erase");
  const [brushSize, setBrushSize] = useState(20);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);

  const modeRef  = useRef(mode);
  const brushRef = useRef(brushSize);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { brushRef.current = brushSize; }, [brushSize]);
  // Invalidate cached rect when zoom changes (CSS canvas size changes)
  useEffect(() => { rectRef.current = null; }, [zoom]);

  const redraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const canvas  = canvasRef.current;
      const work    = workRef.current;
      const checker = checkerRef.current;
      if (!canvas || !work || !checker) return;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(checker, 0, 0);
      ctx.drawImage(work, 0, 0);
    });
  }, []);

  // Load images, build GPU canvases
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let loaded = 0;
    const cutImg  = new Image();
    const origImg = new Image();

    const onLoad = () => {
      if (++loaded < 2) return;
      const MAX_DIM = 1500;
      const scale = Math.min(1, MAX_DIM / Math.max(cutImg.width, cutImg.height));
      const cw = Math.round(cutImg.width * scale);
      const ch = Math.round(cutImg.height * scale);

      canvas.width  = cw;
      canvas.height = ch;

      const make = (src: HTMLImageElement) => {
        const c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        c.getContext("2d")!.drawImage(src, 0, 0, cw, ch);
        return c;
      };
      workRef.current    = make(cutImg);
      origRef.current    = make(origImg);
      const tmp          = document.createElement("canvas");
      tmp.width = cw; tmp.height = ch;
      tmpRef.current     = tmp;
      checkerRef.current = makeCheckerCanvas(cw, ch);

      redraw();
      const fitZoom = Math.min((window.innerWidth - 32) / cw, (window.innerHeight - 80) / ch);
      setZoom(Math.round(fitZoom * 100) / 100);
      setReady(true);
    };

    cutImg.onload  = onLoad;
    origImg.onload = onLoad;
    cutImg.src  = cutoutUrl;
    origImg.src = originalUrl;
  }, [cutoutUrl, originalUrl, redraw]);

  // Native mouse listeners — lower latency than React synthetic events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPos = (e: MouseEvent) => {
      if (!rectRef.current) rectRef.current = canvas.getBoundingClientRect();
      const rect = rectRef.current;
      return {
        x: (e.clientX - rect.left) * (canvas.width  / rect.width),
        y: (e.clientY - rect.top)  * (canvas.height / rect.height),
      };
    };

    const paintStroke = (x1: number, y1: number) => {
      const work = workRef.current;
      const orig = origRef.current;
      const tmp  = tmpRef.current;
      if (!work || !orig || !tmp) return;

      const r    = brushRef.current;
      const last = lastPosRef.current;
      const workCtx = work.getContext("2d")!;

      if (modeRef.current === "erase") {
        // GPU composite: punch transparent hole along stroke
        workCtx.globalCompositeOperation = "destination-out";
        workCtx.lineWidth  = r * 2;
        workCtx.lineCap    = "round";
        workCtx.lineJoin   = "round";
        workCtx.beginPath();
        if (last) {
          workCtx.moveTo(last.x, last.y);
          workCtx.lineTo(x1, y1);
          workCtx.stroke();
        } else {
          workCtx.arc(x1, y1, r, 0, Math.PI * 2);
          workCtx.fill();
        }
        workCtx.globalCompositeOperation = "source-over";
      } else {
        // Restore: mask original image into the brush stroke shape, paint onto work
        const tmpCtx = tmp.getContext("2d")!;
        tmpCtx.globalCompositeOperation = "source-over";
        tmpCtx.clearRect(0, 0, tmp.width, tmp.height);
        tmpCtx.fillStyle   = "#000";
        tmpCtx.strokeStyle = "#000";
        tmpCtx.lineWidth   = r * 2;
        tmpCtx.lineCap     = "round";
        tmpCtx.lineJoin    = "round";
        tmpCtx.beginPath();
        if (last) {
          tmpCtx.moveTo(last.x, last.y);
          tmpCtx.lineTo(x1, y1);
          tmpCtx.stroke();
        } else {
          tmpCtx.arc(x1, y1, r, 0, Math.PI * 2);
          tmpCtx.fill();
        }
        // Clip to stroke shape, then pull in original pixels
        tmpCtx.globalCompositeOperation = "source-in";
        tmpCtx.drawImage(orig, 0, 0);
        tmpCtx.globalCompositeOperation = "source-over";
        workCtx.drawImage(tmp, 0, 0);
      }

      lastPosRef.current = { x: x1, y: y1 };
      redraw();
    };

    const onMouseDown = (e: MouseEvent) => {
      isDrawingRef.current = true;
      lastPosRef.current   = null;
      rectRef.current      = canvas.getBoundingClientRect();
      const p = getPos(e);
      paintStroke(p.x, p.y);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const p = getPos(e);
      paintStroke(p.x, p.y);
    };
    const onStop = () => { isDrawingRef.current = false; lastPosRef.current = null; };

    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mouseup",    onStop);
    canvas.addEventListener("mouseleave", onStop);
    return () => {
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mouseup",    onStop);
      canvas.removeEventListener("mouseleave", onStop);
    };
  }, [redraw]);

  const handleConfirm = () => {
    const work = workRef.current;
    if (!work) return;
    onConfirm(work.toDataURL("image/png"));
  };

  const canvasW = workRef.current?.width  ?? 0;
  const canvasH = workRef.current?.height ?? 0;

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setMode("erase")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
            mode === "erase"
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
          }`}
        >
          ✏️ Erase
        </button>
        <button
          onClick={() => setMode("restore")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
            mode === "restore"
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
          }`}
        >
          🖌️ Restore
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Brush</span>
          <input
            type="range" min={4} max={60} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-24 accent-orange-500"
          />
          <span className="text-xs text-gray-500 w-6">{brushSize}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(0.1, Math.round((z - 0.25) * 100) / 100))}
            className="px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-100"
          >−</button>
          <input
            type="range" min={10} max={400} step={5} value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
            className="w-24 accent-orange-500"
          />
          <button
            onClick={() => setZoom(z => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
            className="px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-100"
          >+</button>
          <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:border-gray-400 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!ready}
            className="px-4 py-1.5 rounded-lg text-sm bg-orange-500 text-white font-medium hover:bg-orange-600 transition disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center"
        style={{ cursor: mode === "erase" ? "crosshair" : "cell" }}
      >
        {!ready && <p className="text-gray-400 text-sm">Loading...</p>}
        <canvas
          ref={canvasRef}
          style={{
            display: ready ? "block" : "none",
            width:  Math.round(canvasW * zoom),
            height: Math.round(canvasH * zoom),
          }}
        />
      </div>
    </div>
  );
}
