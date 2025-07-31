/**
 * Components - centralized exports
 * 
 * This module exports all canvas-related React components for building
 * interactive GitHub repository visualizations.
 */

// Main canvas component - exported from parent directory for backward compatibility
export { default as DraggableCanvas } from '../../DraggableCanvas';

/**
 * Individual node component for rendering branch nodes in the canvas
 * @see CanvasNode
 */
export { CanvasNode } from './CanvasNode';

/**
 * Component for rendering individual commit nodes with orbital animations
 * @see CommitNode
 */
export { CommitNode } from './CommitNode';

/**
 * Component for rendering connection lines between nodes with animations
 * @see ConnectionLine
 */
export { ConnectionLine } from './ConnectionLine';