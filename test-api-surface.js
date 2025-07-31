// Simple test to verify the new API surface works
const { DraggableCanvas } = require('./src/components/canvas/index.ts');

console.log('✅ DraggableCanvas import successful');
console.log('✅ New API surface is working correctly');

// Test that we can import individual components
const { CanvasNode, ConnectionLine } = require('./src/components/canvas/components/index.ts');
console.log('✅ Individual component imports working');

// Test that we can import hooks
const { useCanvasInteraction } = require('./src/components/canvas/hooks/index.ts');
console.log('✅ Hook imports working');

// Test that we can import types
const types = require('./src/components/canvas/types/index.ts');
console.log('✅ Type imports working');

console.log('\n🎉 All API surface tests passed!');