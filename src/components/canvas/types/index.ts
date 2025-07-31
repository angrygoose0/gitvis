/**
 * Canvas types - centralized exports
 * 
 * This module exports all TypeScript type definitions used throughout
 * the canvas system for type safety and developer experience.
 */

/**
 * GitHub-related type definitions for API responses and data structures
 * @see github
 */
export type {
  PullRequest,
  Issue,
  Branch,
  Collaborator,
  BranchConnection,
} from './github';

/**
 * Canvas and positioning type definitions for coordinate systems and physics
 * @see canvas
 */
export type {
  Position,
  Velocity,
  CanvasState,
  NodePhysics,
  DragState,
  CardPhysics,
} from './canvas';

/**
 * Component props type definitions for all canvas components
 * @see components
 */
export type {
  DraggableCardProps,
  CanvasNodeProps,
  ConnectionLineProps,
  DraggableCanvasProps,
  CommitNodeProps,
} from './components';