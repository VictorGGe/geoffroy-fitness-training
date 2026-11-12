"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  /** Image PNG de la signature (fond transparent), ou null si le cadre est vide. */
  toDataURL: () => string | null;
  clear: () => void;
}

/** Image recadrée autour du trait (la signature remplit mieux son cadre dans le PDF). */
function trimmed(c: HTMLCanvasElement): string {
  const ctx = c.getContext("2d")!;
  const { width: w, height: h } = c;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return c.toDataURL("image/png");
  const pad = Math.round(Math.max(w, h) * 0.02);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/** Cadre de signature au doigt / à la souris / au stylet. */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void; height?: number }>(function SignaturePad(
  { onChange, height = 170 },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);
  const [empty, setEmpty] = useState(true);

  // Taille réelle en pixels (écrans haute densité) et redimensionnement
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      const prev = strokes.current ? c.toDataURL() : null;
      c.width = Math.round(w * ratio);
      c.height = Math.round(height * ratio);
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0b1f4d";
      ctx.lineWidth = 2.4;
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, height);
        img.src = prev;
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [height]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e: React.PointerEvent) {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#0b1f4d";
    ctx.fill();
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const p = pos(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    strokes.current += 1;
    if (empty) {
      setEmpty(false);
      onChange?.(false);
    }
  }

  function clear() {
    const c = canvas.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    strokes.current = 0;
    setEmpty(true);
    onChange?.(true);
  }

  useImperativeHandle(ref, () => ({
    toDataURL: () => (strokes.current && canvas.current ? trimmed(canvas.current) : null),
    clear,
  }));

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        style={{ height, touchAction: "none" }}
        className="block w-full cursor-crosshair rounded-xl border-2 border-dashed border-royal-400/60 bg-white"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        aria-label="Zone de signature"
      />
      {empty && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">Signe ici avec ton doigt</p>
      )}
      <div className="pointer-events-none absolute bottom-7 left-5 right-5 border-b border-slate-300" />
      {!empty && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          <Eraser className="h-3.5 w-3.5" /> Effacer
        </button>
      )}
    </div>
  );
});
