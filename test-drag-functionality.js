// Simple test to verify drag functionality
const { JSDOM } = require('jsdom');

// Mock DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

// Test coordinate transformation
function mouseToWorld(clientX, clientY, scale, offset, dragOffset) {
  const adjustedX = dragOffset ? clientX - dragOffset.x : clientX;
  const adjustedY = dragOffset ? clientY - dragOffset.y : clientY;
  
  return {
    x: (adjustedX - offset.x) / scale,
    y: (adjustedY - offset.y) / scale
  };
}

// Test case
const scale = 1;
const offset = { x: 0, y: 0 };
const dragOffset = { x: 10, y: 10 };

const result = mouseToWorld(150, 150, scale, offset, dragOffset);
console.log('Mouse position (150, 150) with drag offset (10, 10):');
console.log('World position:', result);
console.log('Expected: { x: 140, y: 140 }');
console.log('Test passed:', result.x === 140 && result.y === 140);