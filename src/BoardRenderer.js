 import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sampleTrail } from './trails/trailSchema';
import DebugHUD from './DebugHUD'; // modular HUD

const BoardRenderer = () => {
  const canvasRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const [pulseCount, setPulseCount] = useState(0);
  const [collisions, setCollisions] = useState(0);
  const [fps, setFps] = useState(0);

  const easeInOutQuad = t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  const applyGlow = (ctx, color, intensity) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = intensity;
  };

  const checkCollision = (pulseA, pulseB) => {
    const dx = pulseA.x - pulseB.x;
    const dy = pulseA.y - pulseB.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < 8;
  };

  const drawPulseWithTrail = useCallback((ctx, pulse, fromNode, toNode) => {
    if (!fromNode || !toNode) return;
    const t = easeInOutQuad(pulse.progress);
    pulse.x = fromNode.x + (toNode.x - fromNode.x) * t;
    pulse.y = fromNode.y + (toNode.y - fromNode.y) * t;

    pulse.trail.push({ x: pulse.x, y: pulse.y, opacity: pulse.opacity });
    if (pulse.trail.length > 20) pulse.trail.shift();

    pulse.trail.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(${pulse.baseHue}, 100%, 50%, ${point.opacity * (index / pulse.trail.length)})`;
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = pulse.color;
    applyGlow(ctx, pulse.color, 20);
    ctx.fill();
  }, []);

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

    const MAX_PULSES = 50;
    let animationFrameId;
    let lastFrameTime = performance.now();
    let totalCollisions = 0;

    const animate = () => {
      if (paused) {
        cancelAnimationFrame(animationFrameId);
        return;
      }

      // FPS calculation
      const now = performance.now();
      const delta = now - lastFrameTime;
      const currentFps = Math.round(1000 / delta);
      lastFrameTime = now;
      setFps(currentFps);

      // Background feedback
      const activityLevel = pulses.reduce((sum, p) => sum + p.speed * p.opacity, 0);
      const hue = Math.min(200, Math.floor(activityLevel * 50));
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
        ctx.fillStyle = node.hitCount > 1 ? 'purple' : node.flashColor || 'blue';
        ctx.fill();
        ctx.restore();
        node.hitCount = 0;
      });

      // Update pulses
      pulses.forEach(pulse => {
        pulse.progress += pulse.speed;
        if (pulse.progress > 1) {
          pulse.progress = 0;
          if (pulse.toNode) {
            pulse.toNode.flash = Math.min(50, 30 + pulse.speed * 200);
            pulse.toNode.flashColor = pulse.color;
            pulse.toNode.hitCount += 1;
          }
        }
        drawPulseWithTrail(ctx, pulse, pulse.fromNode, pulse.toNode);
      });

      // Collision detection
      for (let i = 0; i < pulses.length; i++) {
        for (let j = i + 1; j < pulses.length; j++) {
          if (checkCollision(pulses[i], pulses[j])) {
            totalCollisions += 1;
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

            if (Math.random() < 0.3 && pulses.length < MAX_PULSES) {
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

      // Lifecycle management
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
              fromNode: pulse.toNode || sampleTrail.nodes[0],
              toNode: sampleTrail.nodes[Math.floor(Math.random() * sampleTrail.nodes.length)],
              baseHue: Math.floor(Math.random() * 360),
              color: `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`,
            }];
          }
        }
        return [pulse];
      });

      // Adaptive difficulty
      if (pulses.length < 5) {
        pulses.forEach(pulse => { pulse.speed *= 1.2; });
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

      // ✅ Update HUD state
      setPulseCount(pulses.length);
      setCollisions(totalCollisions);

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationFrameId);
  }, [paused, debugMode, drawPulseWithTrail]); // ✅ included dependency

  return (
  <div style={{ position: 'relative' }}>
    <canvas ref={canvasRef} width={400} height={400} />
    {debugMode && (
      <DebugHUD pulseCount={pulseCount} collisions={collisions} fps={fps} />
    )}
    <div style={{ marginTop: '10px' }}>
      <button onClick={() => setPaused(prev => !prev)}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button onClick={() => setDebugMode(prev => !prev)} style={{ marginLeft: '10px' }}>
        {debugMode ? 'Disable Debug' : 'Enable Debug'}
      </button>
    </div>
  </div>
);
};

export default BoardRenderer;