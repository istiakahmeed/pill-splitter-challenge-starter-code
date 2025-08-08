import { useEffect, useMemo, useRef, useState } from "react";
import type { Rect } from "../types/Rect";
import {
  BOX_BORDER,
  COLORS,
  MIN_SIZE_TO_DRAW,
  MIN_SIZE_TO_SPLIT,
  SHAPE_RADIUS,
} from "../utils/constants";
import { generateId, randomFromArray } from "../utils/helperFun";

export default function PillSplitter() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<Rect[]>([]);
  const [mousePos, setMousePos] = useState({ x: 200, y: 200 });
  const [drawingShape, setDrawingShape] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [dragShape, setDragShape] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const clickDetails = useRef<{
    x: number;
    y: number;
    time: number;
    id?: string;
  }>({
    x: 0,
    y: 0,
    time: 0,
  });

  const getMousePosition = (e: MouseEvent | React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const posX = (e as MouseEvent).clientX ?? (e as React.MouseEvent).clientX;
    const posY = (e as MouseEvent).clientY ?? (e as React.MouseEvent).clientY;
    return {
      x: rect ? posX - rect.left : posX,
      y: rect ? posY - rect.top : posY,
    };
  };

  const moveShapeToTop = (id: string) => {
    setShapes((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index === -1) return prev;
      const selected = prev[index];
      return [...prev.slice(0, index), ...prev.slice(index + 1), selected];
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const element = e.target as HTMLElement;
    const targetId = element.dataset.shapeId;
    const { x, y } = getMousePosition(e);

    clickDetails.current = { x, y, time: Date.now(), id: targetId };

    if (targetId) {
      moveShapeToTop(targetId);
      const shape = shapes.find((s) => s.id === targetId)!;
      setDragShape({
        id: targetId,
        offsetX: x - shape.x,
        offsetY: y - shape.y,
      });
    } else {
      setDrawingShape({ startX: x, startY: y, endX: x, endY: y });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = getMousePosition(e);
      setMousePos({ x, y });

      if (drawingShape) {
        setDrawingShape((d) => (d ? { ...d, endX: x, endY: y } : d));
      }
      if (dragShape) {
        setShapes((prev) =>
          prev.map((s) =>
            s.id === dragShape.id
              ? { ...s, x: x - dragShape.offsetX, y: y - dragShape.offsetY }
              : s
          )
        );
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const { x, y } = getMousePosition(e);
      const distance = Math.hypot(
        x - clickDetails.current.x,
        y - clickDetails.current.y
      );
      const timeDiff = Date.now() - clickDetails.current.time;

      if (drawingShape) {
        const { startX, startY, endX, endY } = drawingShape;
        const posX = Math.min(startX, endX);
        const posY = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        if (width >= MIN_SIZE_TO_DRAW && height >= MIN_SIZE_TO_DRAW) {
          setShapes((prev) => [
            ...prev,
            {
              id: generateId(),
              x: posX,
              y: posY,
              w: width,
              h: height,
              color: randomFromArray(COLORS),
            },
          ]);
        }
        setDrawingShape(null);
      }

      // If dragging
      if (dragShape) {
        setDragShape(null);
        if (distance < 4 && timeDiff < 300) {
          const intersectingIds = new Set(
            shapes.filter((s) => isCrossed(s, x, y)).map((s) => s.id)
          );
          if (intersectingIds.size) {
            splitShapes(x, y, intersectingIds);
          }
        }
        return;
      }

      if (distance < 4 && timeDiff < 300) {
        const intersectingIds = new Set(
          shapes.filter((s) => isCrossed(s, x, y)).map((s) => s.id)
        );
        if (intersectingIds.size) {
          splitShapes(x, y, intersectingIds);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [drawingShape, dragShape, shapes]);

  const isCrossed = (shape: Rect, cx: number, cy: number) =>
    (shape.x < cx && shape.x + shape.w > cx) ||
    (shape.y < cy && shape.y + shape.h > cy);

  const splitShapes = (cx: number, cy: number, only?: Set<string>) => {
    setShapes((prev) => {
      const updated: Rect[] = [];

      for (const shape of prev) {
        if (only && !only.has(shape.id)) {
          updated.push(shape);
          continue;
        }

        const vHit = shape.x < cx && shape.x + shape.w > cx;
        const hHit = shape.y < cy && shape.y + shape.h > cy;
        const leftWidth = cx - shape.x;
        const rightWidth = shape.x + shape.w - cx;
        const topHeight = cy - shape.y;
        const bottomHeight = shape.y + shape.h - cy;

        const canSplitVert =
          vHit &&
          leftWidth >= MIN_SIZE_TO_SPLIT &&
          rightWidth >= MIN_SIZE_TO_SPLIT;
        const canSplitHoriz =
          hHit &&
          topHeight >= MIN_SIZE_TO_SPLIT &&
          bottomHeight >= MIN_SIZE_TO_SPLIT;

        const adjustPosition = (s: Rect) => {
          let nx = s.x;
          let ny = s.y;
          if (vHit && !canSplitVert)
            nx = s.x + s.w / 2 < cx ? cx - s.w - 2 : cx + 2;
          if (hHit && !canSplitHoriz)
            ny = s.y + s.h / 2 < cy ? cy - s.h - 2 : cy + 2;
          return { ...s, x: nx, y: ny };
        };

        if (canSplitVert && canSplitHoriz) {
          updated.push(
            {
              id: generateId(),
              x: shape.x,
              y: shape.y,
              w: leftWidth,
              h: topHeight,
              color: shape.color,
            },
            {
              id: generateId(),
              x: cx,
              y: shape.y,
              w: rightWidth,
              h: topHeight,
              color: shape.color,
            },
            {
              id: generateId(),
              x: shape.x,
              y: cy,
              w: leftWidth,
              h: bottomHeight,
              color: shape.color,
            },
            {
              id: generateId(),
              x: cx,
              y: cy,
              w: rightWidth,
              h: bottomHeight,
              color: shape.color,
            }
          );
        } else if (canSplitHoriz) {
          const top = {
            id: generateId(),
            x: shape.x,
            y: shape.y,
            w: shape.w,
            h: topHeight,
            color: shape.color,
          };
          const bottom = {
            id: generateId(),
            x: shape.x,
            y: cy,
            w: shape.w,
            h: bottomHeight,
            color: shape.color,
          };
          updated.push(
            vHit && !canSplitVert ? adjustPosition(top) : top,
            vHit && !canSplitVert ? adjustPosition(bottom) : bottom
          );
        } else if (canSplitVert) {
          const left = {
            id: generateId(),
            x: shape.x,
            y: shape.y,
            w: leftWidth,
            h: shape.h,
            color: shape.color,
          };
          const right = {
            id: generateId(),
            x: cx,
            y: shape.y,
            w: rightWidth,
            h: shape.h,
            color: shape.color,
          };
          updated.push(
            hHit && !canSplitHoriz ? adjustPosition(left) : left,
            hHit && !canSplitHoriz ? adjustPosition(right) : right
          );
        } else {
          updated.push(vHit || hHit ? adjustPosition(shape) : shape);
        }
      }

      return updated;
    });
  };

  const drawingPreview = useMemo(() => {
    if (!drawingShape) return null;
    const x = Math.min(drawingShape.startX, drawingShape.endX);
    const y = Math.min(drawingShape.startY, drawingShape.endY);
    const w = Math.abs(drawingShape.endX - drawingShape.startX);
    const h = Math.abs(drawingShape.endY - drawingShape.startY);
    return { x, y, w, h };
  }, [drawingShape]);

  return (
    <div
      ref={containerRef}
      className='relative w-full h-[100dvh] bg-[#cfe1fb]'
      onMouseDown={handleMouseDown}
    >
      {shapes.map((shape, idx) => (
        <div
          key={shape.id}
          data-shape-id={shape.id}
          className={`absolute ${BOX_BORDER} shadow-sm cursor-move`}
          style={{
            left: shape.x,
            top: shape.y,
            width: shape.w,
            height: shape.h,
            background: shape.color,
            borderRadius: SHAPE_RADIUS,
            zIndex: 10 + idx,
          }}
        />
      ))}

      {drawingPreview && (
        <div
          className='absolute border-2 border-rose-500/70 border-dashed bg-rose-400/10 pointer-events-none'
          style={{
            left: drawingPreview.x,
            top: drawingPreview.y,
            width: drawingPreview.w,
            height: drawingPreview.h,
            borderRadius: SHAPE_RADIUS,
            zIndex: 40,
          }}
        />
      )}

      <div
        className='absolute top-0 h-full w-[3px] bg-slate-600/80 pointer-events-none'
        style={{
          left: mousePos.x,
          transform: "translateX(-1.5px)",
          zIndex: 50,
        }}
      />
      <div
        className='absolute left-0 w-full h-[3px] bg-slate-600/80 pointer-events-none'
        style={{ top: mousePos.y, transform: "translateY(-1.5px)", zIndex: 50 }}
      />
    </div>
  );
}
