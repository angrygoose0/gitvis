/**
 * Canvas and positioning-related type definitions
 */

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface CanvasState {
  offset: Position;
  scale: number;
  isDragging: boolean;
  isSpacePressed: boolean;
}

export interface NodePhysics {
  position: Position;
  velocity: Velocity;
  isDragging: boolean;
  isExpanded: boolean;
  isLoadingCommits: boolean;
  isDragTarget: boolean;
  animationTime: number;
}

export interface DragState {
  isDragging: boolean;
  dragOffset: Position;
  startPosition: Position;
}

export interface CardPhysics {
  position: Position;
  velocity: Velocity;
  isDragging: boolean;
  isExpanded: boolean;
  isLoadingCommits: boolean;
  isDragTarget: boolean;
  animationTime: number;
}