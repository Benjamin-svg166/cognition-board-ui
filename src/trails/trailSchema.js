// Basic cognition trail schema
export const sampleTrail = {
  id: 'trail-001',
  nodes: [
    { id: 'n1', layer: 0, x: 100, y: 150, timestamp: 0 },
    { id: 'n2', layer: 1, x: 120, y: 180, timestamp: 500 },
    { id: 'n3', layer: 2, x: 140, y: 210, timestamp: 1000 },
  ],
  pulses: [
    { from: 'n1', to: 'n2', type: 'hover' },
    { from: 'n2', to: 'n3', type: 'click' },
  ],
};