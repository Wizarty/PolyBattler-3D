import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../store';

/**
 * High-performance 2D Canvas Floating Damage Renderer.
 * Zero DOM element thrashing, zero React reconciliation overhead.
 * Smooth 60 FPS floating arcade numbers.
 */
export function FloatingDamage() {
  const { camera, gl } = useThree();
  const damageNumbers = useGameStore((state) => state.damageNumbers);
  const removeDamageNumber = useGameStore((state) => state.removeDamageNumber);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempVec = useRef(new Vector3());

  // Attach overlay canvas to container on mount
  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '15';
    parent.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
    };
  }, [gl]);

  // Render numbers each frame
  useFrame((state) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (damageNumbers.length === 0) return;

    const now = Date.now();
    const w = canvas.width;
    const h = canvas.height;

    for (let i = 0; i < damageNumbers.length; i++) {
      const item = damageNumbers[i];
      const age = now - item.id;
      if (age > 650) {
        removeDamageNumber(item.id);
        continue;
      }

      const progress = age / 650;
      const rise = progress * 1.6;
      const opacity = 1 - Math.pow(progress, 2);

      // Project 3D position to 2D screen coordinates
      tempVec.current.set(item.position.x, item.position.y + rise, item.position.z);
      tempVec.current.project(camera);

      // If behind camera, skip
      if (tempVec.current.z > 1) continue;

      const sx = (tempVec.current.x * 0.5 + 0.5) * w;
      const sy = (-tempVec.current.y * 0.5 + 0.5) * h;

      ctx.save();
      ctx.globalAlpha = Math.max(0, opacity);

      // Scale bounce on pop
      const scale = item.isCrit ? (1.4 - progress * 0.3) : (1.1 - progress * 0.2);
      ctx.translate(sx, sy);
      ctx.scale(scale, scale);

      ctx.font = item.isCrit ? '900 24px monospace' : '800 17px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Dark drop shadow
      ctx.fillStyle = '#000000';
      ctx.fillText(item.isCrit ? `💥${item.value}` : `${item.value}`, 2, 2);

      // Glowing text
      ctx.fillStyle = item.color || '#ffffff';
      ctx.shadowColor = item.color || '#ffffff';
      ctx.shadowBlur = item.isCrit ? 12 : 6;
      ctx.fillText(item.isCrit ? `💥${item.value}` : `${item.value}`, 0, 0);

      ctx.restore();
    }
  });

  return null;
}
