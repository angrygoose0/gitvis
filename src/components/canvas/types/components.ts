/**
 * Component props type definitions
 */

import { Position, Velocity } from './canvas';
import { Branch, PullRequest } from './github';

export interface DraggableCardProps {
  id: string;
  branch: Branch;
  position: Position;
  velocity: Velocity;
  isDragging: boolean;
  scale: number;
  offset: Position;
  isSpacePressed: boolean;
  isExpanded: boolean;
  isLoadingCommits: boolean;
  isDragTarget: boolean; // Add this prop
  animationTime: number; // Add animation time for orbiting commits
  onStartDrag: (id: string, position: Position) => void;
  onDrag: (id: string, position: Position) => void;
  onEndDrag: (id: string) => void;
  onDoubleClick?: (id: string) => void;
}

export interface ConnectionLineProps {
  from: Position;
  to: Position;
  scale: number;
  offset: Position;
  pullRequest?: PullRequest;
  commitCount?: number; // Number of commits this connection represents
}

export interface DraggableCanvasProps {
  owner?: string;
  repo?: string;
}