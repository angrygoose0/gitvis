'use client';

import React, { useState, useRef } from 'react';
import { worldToScreen, screenToWorld, mouseToWorld } from '../utils/coordinate-transformer';
import { CommitNode } from './CommitNode';
import { Position, Branch } from '../types';

export interface CanvasNodeProps {
  id: string;
  branch: Branch;
  position: Position;
  isDragging: boolean;
  scale: number;
  offset: Position;
  isSpacePressed: boolean;
  isExpanded: boolean;
  isLoadingCommits: boolean;
  isDragTarget: boolean;
  animationTime: number;
  onStartDrag: (id: string, position: Position) => void;
  onDrag: (id: string, position: Position) => void;
  onEndDrag: (id: string) => void;
  onDoubleClick?: (id: string) => void;
}

const NODE_RADIUS = 8; // Base radius for nodes - much smaller for tiny glowing balls
const COMMIT_NODE_RADIUS = 4; // Base radius for commit nodes - also smaller
const MIN_SCALE_FOR_TEXT = 0.8; // Minimum scale to show text - adjusted for smaller nodes
const MAX_SCALE_FOR_FULL_TEXT = 2; // Scale at which text is fully visible
const MIN_SCALE_FOR_COMMIT_TEXT = 1.5; // Minimum scale to show commit text - adjusted

/**
 * CanvasNode component renders individual branch nodes with their visual styling,
 * interaction handlers, and integrated commit nodes
 */
export const CanvasNode: React.FC<CanvasNodeProps> = ({
  id,
  branch,
  position,
  isDragging,
  scale,
  offset,
  isSpacePressed,
  isExpanded,
  isLoadingCommits,
  isDragTarget,
  animationTime,
  onStartDrag,
  onDrag,
  onEndDrag,
  onDoubleClick
}) => {
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);

  // Calculate screen position from world position
  const screenPosition = worldToScreen(position, scale, offset);

  // Calculate scaled radius
  const scaledRadius = NODE_RADIUS * scale;
  const scaledCommitRadius = COMMIT_NODE_RADIUS * scale;

  // Calculate text opacity based on scale
  const textOpacity = scale < MIN_SCALE_FOR_TEXT ? 0 :
    scale > MAX_SCALE_FOR_FULL_TEXT ? 1 :
      (scale - MIN_SCALE_FOR_TEXT) / (MAX_SCALE_FOR_FULL_TEXT - MIN_SCALE_FOR_TEXT);

  // Calculate commit text opacity
  const commitTextOpacity = scale < MIN_SCALE_FOR_COMMIT_TEXT ? 0 :
    scale > MAX_SCALE_FOR_FULL_TEXT ? 1 :
      (scale - MIN_SCALE_FOR_COMMIT_TEXT) / (MAX_SCALE_FOR_FULL_TEXT - MIN_SCALE_FOR_COMMIT_TEXT);

  // Determine node color based on branch status
  const getNodeColor = () => {
    if (isDragTarget) return 'bg-orange-400'; // Orange when drag target
    if (branch.aheadBy === 0) return 'bg-gray-700'; // Grey when not ahead
    if (branch.depth === 0) return 'bg-green-400';
    if (branch.depth === 1) return 'bg-blue-400';
    return 'bg-purple-400';
  };

  const getNodeGlowColor = () => {
    if (isDragTarget) return 'rgba(251, 146, 60, 0.9)'; // Orange glow when drag target
    if (branch.aheadBy === 0) return 'rgba(156, 163, 175, 0.6)'; // Grey glow when not ahead
    if (branch.depth === 0) return 'rgba(74, 222, 128, 0.8)';
    if (branch.depth === 1) return 'rgba(96, 165, 250, 0.8)';
    return 'rgba(196, 181, 253, 0.8)';
  };

  const getNodeBorderColor = () => {
    if (isDragTarget) return 'border-orange-300/80'; // Orange border when drag target
    if (isDragging) return 'border-white/50';
    if (branch.aheadBy === 0) return 'border-gray-600'; // Grey border when not ahead
    if (branch.depth === 0) return 'border-green-300/50';
    if (branch.depth === 1) return 'border-blue-300/50';
    return 'border-purple-300/50';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging node if space is NOT pressed
    if (!isSpacePressed) {
      e.stopPropagation(); // Prevent canvas pan

      // Check if it's a right click
      if (e.button === 2) {
        // Right click - start branch creation
        e.preventDefault();
        const rect = nodeRef.current?.getBoundingClientRect();
        if (rect) {
          const worldPosition = screenToWorld({ x: e.clientX, y: e.clientY }, scale, offset);

          // Notify parent about branch creation start
          if ((window as unknown as { onBranchCreationStart?: Function }).onBranchCreationStart) {
            (window as unknown as { onBranchCreationStart: Function }).onBranchCreationStart(id, worldPosition, { x: e.clientX, y: e.clientY });
          }
        }
        return;
      }

      // Left click - normal drag
      if (e.button === 0) {
        const rect = nodeRef.current?.getBoundingClientRect();
        if (rect) {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          setDragOffset({
            x: e.clientX - centerX,
            y: e.clientY - centerY
          });

          // Set up mouse event handlers immediately with captured values
          const handleMouseMove = (moveEvent: MouseEvent) => {
            // Convert screen coordinates to world coordinates
            const worldPosition = mouseToWorld(moveEvent.clientX, moveEvent.clientY, scale, offset, dragOffset);
            onDrag(id, worldPosition);
          };

          const handleMouseUp = () => {
            onEndDrag(id);
            // Clean up event listeners
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };

          // Add event listeners
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);

          onStartDrag(id, position);
        }
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDoubleClick) {
      onDoubleClick(id);
    }
  };

  return (
    <div
      ref={nodeRef}
      className="absolute"
      style={{
        left: `${screenPosition.x - scaledRadius}px`,
        top: `${screenPosition.y - scaledRadius}px`,
        width: `${scaledRadius * 2}px`,
        height: `${scaledRadius * 2}px`,
        cursor: isDragging ? 'move' : (isSpacePressed ? 'grab' : 'pointer'),
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => e.preventDefault()} // Prevent context menu
    >
      {/* Node circle */}
      <div
        className={`absolute inset-0 rounded-full ${getNodeColor()} ${getNodeBorderColor()} border transition-all duration-200 ${branch.aheadBy === 0 ? 'opacity-40' : ''
          }`}
        style={{
          boxShadow: isDragTarget
            ? `0 0 40px ${getNodeGlowColor()}, 0 0 80px ${getNodeGlowColor()}, inset 0 0 30px ${getNodeGlowColor()}` // Bigger glow for drag target
            : isDragging
              ? `0 0 30px ${getNodeGlowColor()}, 0 0 60px ${getNodeGlowColor()}, inset 0 0 20px ${getNodeGlowColor()}`
              : `0 0 20px ${getNodeGlowColor()}, 0 0 40px ${getNodeGlowColor()}, inset 0 0 15px ${getNodeGlowColor()}`,
          transform: isDragTarget ? 'scale(1.5)' : isDragging ? 'scale(1.3)' : 'scale(1)', // Bigger scale for drag target
          background: `radial-gradient(circle at 30% 30%, ${branch.aheadBy === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)'
            }, ${getNodeColor().replace('bg-', 'rgba(').replace('400', '400, 1)').replace('700', '700, 1)').replace('green', '74, 222, 128').replace('blue', '96, 165, 250').replace('purple', '196, 181, 253').replace('gray', '156, 163, 175').replace('orange', '251, 146, 60')})`,
        }}
      >
        {/* Inner glow effect */}
        <div
          className="absolute inset-1 rounded-full"
          style={{
            background: `radial-gradient(circle at center, ${getNodeGlowColor()}, transparent)`,
            filter: 'blur(2px)',
          }}
        />

        {/* Protected badge - made smaller */}
        {branch.protected && (
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center"
            style={{ boxShadow: '0 0 10px rgba(250, 204, 21, 0.8)' }}>
            <svg className="w-2 h-2 text-yellow-900" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        {/* Loading indicator for commits - made smaller */}
        {isLoadingCommits && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-white/80"></div>
          </div>
        )}
      </div>

      {/* Floating text label - adjusted positioning for smaller nodes */}
      <div
        className="absolute left-1/2 transform -translate-x-1/2 pointer-events-none whitespace-nowrap"
        style={{
          top: `${scaledRadius * 2 + 4}px`,
          opacity: textOpacity,
          transition: 'opacity 0.2s ease-in-out',
        }}
      >
        <div className="bg-gray-900/90 backdrop-blur-sm px-2 py-1 rounded-md border border-gray-700/50">
          <p className="text-white text-sm font-medium">{branch.name}</p>
          <p className="text-gray-400 text-xs font-mono">
            {branch.commit.sha.substring(0, 7)}
          </p>
          {/* Show additional info at higher zoom levels */}
          {scale > 1.5 && (
            <div className="mt-1 space-y-0.5">
              {branch.aheadBy === 0 && (
                <p className="text-xs text-gray-500">No unique commits</p>
              )}
              {branch.children && branch.children.length > 0 && (
                <p className="text-xs text-blue-400">{branch.children.length} branches</p>
              )}
              {isExpanded && branch.commits && (
                <p className="text-xs text-green-400">{branch.commits.length} commits</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Commit nodes - shown as small circles around the branch */}
      {isExpanded && branch.commits && branch.commits.length > 0 && !isLoadingCommits && (
        <>
          {branch.commits.slice(0, 8).map((commit, index) => (
            <CommitNode
              key={commit.sha}
              commit={commit}
              index={index}
              totalCommits={Math.min(branch.commits?.length || 0, 8)}
              animationTime={animationTime}
              scale={scale}
              branchPosition={position}
              scaledRadius={scaledRadius}
              scaledCommitRadius={scaledCommitRadius}
              textOpacity={textOpacity}
              commitTextOpacity={commitTextOpacity}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default CanvasNode;