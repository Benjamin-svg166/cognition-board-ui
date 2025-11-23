import React from 'react';

const DebugHUD = ({ pulseCount, collisions, fps }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '12px',
      }}
    >
      <div>Pulse count: {pulseCount}</div>
      <div>Total collisions: {collisions}</div>
      <div>FPS: {fps}</div>
    </div>
  );
};

export default DebugHUD;