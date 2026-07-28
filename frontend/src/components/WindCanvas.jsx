import { useEffect, useRef } from 'react';

export default function WindCanvas({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const STREAK_COUNT = 45;
    const streaks = Array.from({ length: STREAK_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: 120 + Math.random() * 220,
      speed: 2 + Math.random() * 3.5,
      thickness: 1 + Math.random() * 2.5,
      opacity: 0.15 + Math.random() * 0.35,
      amplitude: 15 + Math.random() * 25,
      frequency: 0.005 + Math.random() * 0.008,
      offset: Math.random() * Math.PI * 2,
    }));

    const MIST_COUNT = 30;
    const mists = Array.from({ length: MIST_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 40 + Math.random() * 80,
      vx: 0.8 + Math.random() * 1.5,
      vy: (Math.random() - 0.5) * 0.3,
      opacity: 0.05 + Math.random() * 0.12,
    }));

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      mists.forEach((m) => {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x - m.radius > width) m.x = -m.radius;
        if (m.y < -m.radius) m.y = height + m.radius;
        if (m.y > height + m.radius) m.y = -m.radius;

        const mistGrad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius);
        mistGrad.addColorStop(0, `rgba(255, 255, 255, ${m.opacity})`);
        mistGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = mistGrad;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      streaks.forEach((s) => {
        s.x += s.speed;
        if (s.x - s.length > width) {
          s.x = -s.length;
          s.y = Math.random() * height;
        }

        ctx.beginPath();
        const startX = s.x;
        const startY = s.y + Math.sin(time + s.offset) * s.amplitude;
        const controlX = startX + s.length * 0.5;
        const controlY = startY + Math.cos(time * 0.8 + s.offset) * (s.amplitude * 0.6);
        const endX = startX + s.length;
        const endY = startY + Math.sin(time * 1.2 + s.offset) * s.amplitude;

        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(controlX, controlY, endX, endY);

        const streakGrad = ctx.createLinearGradient(startX, startY, endX, endY);
        streakGrad.addColorStop(0, `rgba(255, 255, 255, 0)`);
        streakGrad.addColorStop(0.4, `rgba(240, 249, 255, ${s.opacity})`);
        streakGrad.addColorStop(0.8, `rgba(255, 255, 255, ${s.opacity * 0.8})`);
        streakGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);

        ctx.strokeStyle = streakGrad;
        ctx.lineWidth = s.thickness;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        transition: 'opacity 0.5s ease',
      }}
    />
  );
}

