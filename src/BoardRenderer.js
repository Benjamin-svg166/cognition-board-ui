import React, { useEffect, useRef, useState } from 'react';
import { sampleTrail } from './trails/trailSchema';

const BoardRenderer = () => {
  const canvasRef = useRef(null);
  const [paused, setPaused] = useState(false);

  const easeInOutQuad = t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  // Modular glow function
  function applyGlow(pulse, ctx) {
    const dx = pulse.toNode.x - pulse.x;
    const dy = pulse.toNode.y - pulse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const glow = Math.max(10, 40 - dist / 5);
    ctx.shadowBlur = glow;
    ctx.shadowColor = pulse.color;
  }

  // Collision detection helper
  function checkCollision(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < 12; // threshold for collision
  }

  const drawPulseWithTrail = (ctx, pulse, fromNode, toNode) => {
    const eased = easeInOutQuad(pulse.progress);
    const x = fromNode.x + (toNode.x - fromNode.x) * eased;
    const y = fromNode.y + (toNode.y - fromNode.y) * eased;

    pulse.x = x;
    pulse.y = y;

    // Gradually shift hue based on progress
    const baseHue = pulse.baseHue;
    const hueShift = (pulse.progress * 120) % 360;
    pulse.color = `hsl(${(baseHue + hueShift) % 360}, 100%, 50%)`;

    pulse.trail.push({ x, y, opacity: 1, color: pulse.color });
    if (pulse.trail.length > 20) pulse.trail.shift();

    // Draw trail with blending
    ctx.globalCompositeOperation = 'lighter';
    pulse.trail.forEach(point => {
      ctx.beginPath();
      ctx.globalAlpha = point.opacity * pulse.opacity;
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = point.color;
      ctx.fill();
      point.opacity *= 0.9;
    });
    ctx.globalAlpha = 1;

    // Reset composite mode for main pulse
    ctx.globalCompositeOperation = 'source-over';

    // Draw main pulse with glow
    ctx.save();
    applyGlow(pulse, ctx);

    const radius = 4 + pulse.speed * 100;
    ctx.beginPath();
    ctx.globalAlpha = pulse.opacity;
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = pulse.color;
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const nodes = sampleTrail.nodes.map(node => ({
      ...node,
      flash: 0,
      flashColor: null,
      hitCount: 0,
    }));

    let pulses = sampleTrail.pulses.map(pulse => ({
      ...pulse,
      trail: [],
      progress: 0,
      speed: 0.005 + Math.random() * 0.015,
      fromNode: sampleTrail.nodes.find(n => n.id === pulse.from),
      toNode: sampleTrail.nodes.find(n => n.id === pulse.to),
      baseHue: pulse.type === 'hover' ? 30 : 0,
      color: pulse.type === 'hover' ? 'orange' : 'red',
      x: 0,
      y: 0,
      collisions: 0,
      maxCollisions: 5,
      opacity: 1,
    }));

    let animationFrameId;

    const animate = () => {
      if (!paused) {
        // Environmental feedback: background responds to activity
        const activityLevel = pulses.reduce((sum, p) => sum + p.speed * p.opacity, 0);
        const hue = Math.min(200, Math.floor(activityLevel * 50)); // cap hue at 200
        ctx.fillStyle = `hsl(${hue}, 50%, 10%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw nodes
        nodes.forEach(node => {
          ctx.save();
          if (node.flash > 0) {
            ctx.shadowBlur = node.flash;
            ctx.shadowColor = node.flashColor || 'white';
            node.flash -= 1;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI);

          if (node.hitCount > 1) {
            ctx.fillStyle = 'purple';
          } else if (node.flashColor) {
            ctx.fillStyle = node.flashColor;
          } else {
            ctx.fillStyle = 'blue';
          }

          ctx.fill();
          ctx.restore();

          node.hitCount = 0;
        });

        // Update pulses
        pulses.forEach(pulse => {
          pulse.progress += pulse.speed;
          if (pulse.progress > 1) {
            pulse.progress = 0;
            pulse.toNode.flash = Math.min(50, 30 + pulse.speed * 200);
            pulse.toNode.flashColor = pulse.color;
            pulse.toNode.hitCount += 1;
          }
          drawPulseWithTrail(ctx, pulse, pulse.fromNode, pulse.toNode);
        });

        // Collision detection loop
        for (let i = 0; i < pulses.length; i++) {
          for (let j = i + 1; j < pulses.length; j++) {
            if (checkCollision(pulses[i], pulses[j])) {
              const tempFrom = pulses[i].fromNode;
              const tempTo = pulses[i].toNode;
              pulses[i].fromNode = pulses[j].fromNode;
              pulses[i].toNode = pulses[j].toNode;
              pulses[j].fromNode = tempFrom;
              pulses[j].toNode = tempTo;

              pulses[i].progress = 0;
              pulses[j].progress = 0;

              pulses[i].collisions += 1;
              pulses[j].collisions += 1;

              if (Math.random() < 0.3) {
                pulses.push({
                  ...pulses[i],
                  progress: 0,
                  trail: [],
                  collisions: 0,
                  opacity: 1,
                  toNode: sampleTrail.nodes[Math.floor(Math.random() * sampleTrail.nodes.length)],
                });
              }
            }
          }
        }

        // Lifecycle management with regeneration
        pulses = pulses.flatMap(pulse => {
          if (pulse.collisions >= pulse.maxCollisions) {
            pulse.opacity -= 0.02;
            if (pulse.opacity <= 0) {
              return [{
                ...pulse,
                progress: 0,
                trail: [],
                collisions: 0,
                opacity: 1,
                speed: 0.005 + Math.random() * 0.015,
                fromNode: pulse.toNode,
                toNode: sampleTrail.nodes[Math.floor(Math.random() * sampleTrail.nodes.length)],
                baseHue: Math.floor(Math.random() * 360),
                color: `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`,
              }];
            }
          }
          return [pulse];
        });

        // Adaptive difficulty: ensure minimum activity
        if (pulses.length < 5) {
          pulses.forEach(pulse => {
            pulse.speed *= 1.2;
          });

          for (let i = 0; i < 3; i++) {
            const fromNode = sampleTrail.nodes[Math.floor(Math.random() * sampleTrail.nodes.length)];
            const toNode = sampleTrail.nodes[Math.floor(Math.random() * sampleTrail.nodes.length)];
            pulses.push({
              trail: [],
              progress: 0,
              speed: 0.005 + Math.random() * 0.015,
              fromNode,
              toNode,
              baseHue: Math.floor(Math.random() * 360),
              color: `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`,
              x: fromNode.x,
              y: fromNode.y,
              collisions: 0,
              maxCollisions: 5,
              opacity: 1,
            });
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationFrameId);
  }, [paused]);

  return (
    <div>
      <canvas ref={canvasRef} width={400} height={400} />
      <div style={{ marginTop: '10px' }}>
        <button onClick={() => setPaused(prev => !prev)}>
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  );
};

export default BoardRenderer;