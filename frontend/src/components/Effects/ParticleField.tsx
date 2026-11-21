import React, { useEffect, useRef } from "react";

const REPEL_RADIUS = 90;
const REPEL_STRENGTH = 0.22;

function countFor(width: number): number {
  if (width < 640) return 20;
  if (width < 1024) return 36;
  return 54;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  sway: number;
  colorType: "emerald" | "mint" | "cyan";
}

export const ParticleField: React.FC<{ className?: string }> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowMemory = "deviceMemory" in navigator && Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8) <= 2;
    const lowCpu = "hardwareConcurrency" in navigator && navigator.hardwareConcurrency <= 4;
    const constrainedDevice = lowMemory || lowCpu;
    const dpr = Math.min(window.devicePixelRatio || 1, constrainedDevice ? 1 : 2);

    let mouse = { x: -9999, y: -9999 };
    let particles: Particle[] = [];
    let W = 0;
    let H = 0;
    let raf = 0;

    const colors = {
      emerald: "16, 185, 129",
      mint: "52, 211, 153",
      cyan: "45, 212, 191",
    };

    const makeParticle = (): Particle => {
      const types: ("emerald" | "mint" | "cyan")[] = ["emerald", "mint", "cyan"];
      const colorType = types[Math.floor(Math.random() * types.length)];
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.8 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        phase: Math.random() * Math.PI * 2,
        sway: 0.15 + Math.random() * 0.35,
        colorType,
      };
    };

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.scale(dpr, dpr);
      const count = countFor(W);
      particles = Array.from({ length: count }, makeParticle);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseLeave = () => {
      mouse = { x: -9999, y: -9999 };
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    let t = 0;
    const render = () => {
      t += 0.012;
      ctx.clearRect(0, 0, W, H);

      // Draw connection lines for close particle pairs
      const maxDist = 95;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.12;
            ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update particles
      for (const p of particles) {
        if (!reduced) {
          p.x += p.vx + Math.sin(t + p.phase) * p.sway * 0.12;
          p.y += p.vy + Math.cos(t + p.phase) * p.sway * 0.12;

          // Mouse repel
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < REPEL_RADIUS && dist > 0) {
            const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
            p.x += (dx / dist) * force * 4;
            p.y += (dy / dist) * force * 4;
          }

          // Wrap edges
          if (p.x < -10) p.x = W + 10;
          if (p.x > W + 10) p.x = -10;
          if (p.y < -10) p.y = H + 10;
          if (p.y > H + 10) p.y = -10;
        }

        const alpha = 0.25 + Math.sin(t * 1.5 + p.phase) * 0.15;
        ctx.fillStyle = `rgba(${colors[p.colorType]}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-0 opacity-40 transition-opacity duration-1000 ${className}`}
      aria-hidden="true"
    />
  );
};

export default ParticleField;

