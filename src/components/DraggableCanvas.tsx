'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { formatDate } from './canvas/utils/date-formatter';
import { worldToScreen, screenToWorld, mouseToWorld, getNodeBounds } from './canvas/utils/coordinate-transformer';
import { calculateTreeLayout } from './canvas/utils/layout-calculator';
import { calculateBranchTree } from './canvas/services/branch-analyzer';

// Add custom styles for scrollbar
const customStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

interface Position {
  x: number;
  y: number;
}

interface Velocity {
  x: number;
  y: number;
}


interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string; // source branch
    sha: string;
  };
  base: {
    ref: string; // target branch
    sha: string;
  };
  draft: boolean;
  merged: boolean;
  mergeable?: boolean;
  mergeable_state?: string;
}

interface Issue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  labels: Array<{
    name: string;
    color: string;
  }>;
  milestone?: {
    title: string;
  };
  comments: number;
  pull_request?: {
    url: string;
  };
}

interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
  parent?: string; // Added parent branch reference
  depth?: number; // Added depth in tree
  children?: string[]; // Added children branches
  mergedAt?: string; // Added merge date
  aheadBy?: number; // Number of commits ahead of parent (0 = not ahead, >0 = ahead, <0 = behind, undefined = unknown)
  commits?: Array<{
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        date: string;
      };
    };
  }>;
}

interface Collaborator {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  type: string;
  site_admin: boolean;
  permissions?: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
}

interface BranchConnection {
  from: string;
  to: string;
  pullRequest?: PullRequest; // Added pull request info
  commitCount?: number; // Added commit count for the connection
}

interface DraggableCardProps {
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

const NODE_RADIUS = 8; // Base radius for nodes - much smaller for tiny glowing balls
const COMMIT_NODE_RADIUS = 4; // Base radius for commit nodes - also smaller
const MIN_SCALE_FOR_TEXT = 0.8; // Minimum scale to show text - adjusted for smaller nodes
const MAX_SCALE_FOR_FULL_TEXT = 2; // Scale at which text is fully visible
const MIN_SCALE_FOR_COMMIT_TEXT = 1.5; // Minimum scale to show commit text - adjusted
const COLLISION_RADIUS = 30; // Effective radius for collision detection between nodes - reduced
const FRICTION = 0.95; // Deceleration factor
const MIN_VELOCITY = 0.1; // Minimum velocity before stopping



const DraggableNode: React.FC<DraggableCardProps> = ({
  id,
  branch,
  position,
  velocity,
  isDragging,
  scale,
  offset,
  isSpacePressed,
  isExpanded,
  isLoadingCommits,
  isDragTarget, // Add this
  animationTime, // Add animation time
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
          if ((window as any).onBranchCreationStart) {
            (window as any).onBranchCreationStart(id, worldPosition, { x: e.clientX, y: e.clientY });
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

  // Calculate positions for commit nodes in a circle around the branch with orbiting animation
  const getCommitNodePosition = (index: number, total: number, animationTime: number = 0) => {
    const angleStep = (2 * Math.PI) / total;
    const baseAngle = angleStep * index - Math.PI / 2; // Start from top

    // Add smooth orbiting animation with varying speeds for organic feel


    const orbitSpeed = 0.00015;
    const animationAngle = animationTime * orbitSpeed;

    const finalAngle = baseAngle + animationAngle;
    const distance = 30;

    return {
      x: Math.cos(finalAngle) * distance,
      y: Math.sin(finalAngle) * distance
    };
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
          {branch.commits.slice(0, 8).map((commit, index) => {
            const commitPos = getCommitNodePosition(index, Math.min(branch.commits?.length || 0, 8), animationTime);

            return (
              <div
                key={commit.sha}
                className="absolute pointer-events-none"
                style={{
                  left: `${scaledRadius + commitPos.x * scale - scaledCommitRadius}px`,
                  top: `${scaledRadius + commitPos.y * scale - scaledCommitRadius}px`,
                  width: `${scaledCommitRadius * 2}px`,
                  height: `${scaledCommitRadius * 2}px`,
                  opacity: textOpacity > 0.3 ? 1 : 0,
                  transition: 'opacity 0.3s ease-in-out',
                }}
              >
                {/* Connecting line to parent */}
                {/* (REMOVED: SVG dotted line to parent) */}

                {/* Commit node circle - also made glowing */}
                <div
                  className="absolute inset-0 rounded-full bg-gray-600 border border-gray-500/50 transition-all duration-200"
                  style={{
                    boxShadow: '0 0 8px rgba(156, 163, 175, 0.5), inset 0 0 4px rgba(156, 163, 175, 0.3)',
                    background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2), rgba(156, 163, 175, 0.8))',
                  }}
                  title={commit.commit.message}
                >
                </div>

                {/* Commit text - appears when zoomed in */}
                <div
                  className="absolute left-1/2 transform -translate-x-1/2 pointer-events-none whitespace-nowrap"
                  style={{
                    top: `${scaledCommitRadius * 2 + 4}px`,
                    opacity: commitTextOpacity,
                    transition: 'opacity 0.2s ease-in-out',
                  }}
                >
                  <div className="bg-gray-900/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-gray-700/50">
                    <p className="text-xs text-gray-300 max-w-[150px] truncate">
                      {commit.commit.message.split('\n')[0]}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {commit.sha.substring(0, 7)} • {commit.commit.author.name.split(' ')[0]}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};





// Component to draw connection lines between branches
interface ConnectionLineProps {
  from: Position;
  to: Position;
  scale: number;
  offset: Position;
  pullRequest?: PullRequest;
  commitCount?: number; // Number of commits this connection represents
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ from, to, scale, offset, pullRequest, commitCount = 0 }) => {
  // Calculate screen positions (center of nodes)
  const fromScreen = worldToScreen(from, scale, offset);
  const toScreen = worldToScreen(to, scale, offset);

  // Calculate the angle and distance
  const dx = toScreen.x - fromScreen.x;
  const dy = toScreen.y - fromScreen.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // Adjust start and end points to be at the edge of the nodes - using smaller radius
  const nodeRadius = NODE_RADIUS * scale;
  const fromEdge = {
    x: fromScreen.x + Math.cos(angle) * nodeRadius,
    y: fromScreen.y + Math.sin(angle) * nodeRadius
  };
  const toEdge = {
    x: toScreen.x - Math.cos(angle) * nodeRadius,
    y: toScreen.y - Math.sin(angle) * nodeRadius
  };

  // Determine stroke color based on pull request state
  const getStrokeColor = () => {
    if (pullRequest) {
      if (pullRequest.draft) return "156, 163, 175";
      if (pullRequest.mergeable_state === 'blocked') return "239, 68, 68";
      return "34, 197, 94";
    }
    return "99, 102, 241";
  };

  const strokeColorRGB = getStrokeColor();
  const glowIntensity = pullRequest ? 0.8 : 0.5;

  // Calculate number of pulses to show (max 5 for performance)
  const numPulses = Math.min(commitCount, 5);
  const pulseDelay = 3 / numPulses; // Distribute pulses evenly over animation duration

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}
    >
      <defs>
        {/* Define gradient for the glowing line */}
        <linearGradient id={`line-gradient-${from.x}-${from.y}-${to.x}-${to.y}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={`rgba(${strokeColorRGB}, 0)`} />
          <stop offset="10%" stopColor={`rgba(${strokeColorRGB}, ${glowIntensity})`} />
          <stop offset="50%" stopColor={`rgba(${strokeColorRGB}, ${glowIntensity})`} />
          <stop offset="90%" stopColor={`rgba(${strokeColorRGB}, ${glowIntensity})`} />
          <stop offset="100%" stopColor={`rgba(${strokeColorRGB}, 0)`} />
        </linearGradient>

        {/* Animated gradient for pull requests */}
        {pullRequest && (
          <linearGradient id={`pr-pulse-${pullRequest.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={`rgba(${strokeColorRGB}, 0)`}>
              <animate attributeName="stop-color"
                values={`rgba(${strokeColorRGB}, 0);rgba(${strokeColorRGB}, 0.8);rgba(${strokeColorRGB}, 0)`}
                dur="2s"
                repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor={`rgba(${strokeColorRGB}, 0.8)`}>
              <animate attributeName="stop-color"
                values={`rgba(${strokeColorRGB}, 0.8);rgba(${strokeColorRGB}, 0);rgba(${strokeColorRGB}, 0.8)`}
                dur="2s"
                repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={`rgba(${strokeColorRGB}, 0)`}>
              <animate attributeName="stop-color"
                values={`rgba(${strokeColorRGB}, 0);rgba(${strokeColorRGB}, 0.8);rgba(${strokeColorRGB}, 0)`}
                dur="2s"
                repeatCount="indefinite" />
            </stop>
          </linearGradient>
        )}

        {/* Glow filter */}
        <filter id={`glow-${from.x}-${from.y}-${to.x}-${to.y}`}>
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow layer - wider and more blurred */}
      <line
        x1={fromEdge.x}
        y1={fromEdge.y}
        x2={toEdge.x}
        y2={toEdge.y}
        stroke={`rgba(${strokeColorRGB}, ${glowIntensity * 0.3})`}
        strokeWidth={pullRequest ? 8 : 6}
        filter={`url(#glow-${from.x}-${from.y}-${to.x}-${to.y})`}
      />

      {/* Main line */}
      <line
        x1={fromEdge.x}
        y1={fromEdge.y}
        x2={toEdge.x}
        y2={toEdge.y}
        stroke={pullRequest ? `url(#pr-pulse-${pullRequest?.id})` : `url(#line-gradient-${from.x}-${from.y}-${to.x}-${to.y})`}
        strokeWidth={pullRequest ? 2 : 1.5}
        strokeLinecap="round"
        opacity={0.8}
      />

      {/* Animated energy pulses for active connections - one per commit */}
      {commitCount > 0 && (
        <>
          {Array.from({ length: numPulses }).map((_, index) => (
            <circle
              key={`pulse-${index}`}
              r="3"
              fill={`rgba(${strokeColorRGB}, 0.8)`}
              filter={`url(#glow-${from.x}-${from.y}-${to.x}-${to.y})`}
            >
              <animateMotion
                dur="3s"
                repeatCount="indefinite"
                begin={`${index * pulseDelay}s`}
              >
                <mpath href={`#path-${from.x}-${from.y}-${to.x}-${to.y}`} />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="3s"
                repeatCount="indefinite"
                begin={`${index * pulseDelay}s`}
              />
              <animate
                attributeName="r"
                values="2;4;4;2"
                dur="3s"
                repeatCount="indefinite"
                begin={`${index * pulseDelay}s`}
              />
            </circle>
          ))}
        </>
      )}

      {/* Hidden path for animation */}
      <path
        id={`path-${from.x}-${from.y}-${to.x}-${to.y}`}
        d={`M ${fromEdge.x} ${fromEdge.y} L ${toEdge.x} ${toEdge.y}`}
        fill="none"
        stroke="none"
      />

      {/* Pull request info - floating in the middle */}
      {pullRequest && (
        <g>
          {/* Glowing background */}
          <rect
            x={fromScreen.x + (toScreen.x - fromScreen.x) / 2 - 40}
            y={fromScreen.y + (toScreen.y - fromScreen.y) / 2 - 12}
            width="80"
            height="24"
            fill={`rgba(0, 0, 0, 0.6)`}
            stroke={`rgba(${strokeColorRGB}, 0.4)`}
            strokeWidth="1"
            rx="12"
            ry="12"
            filter={`url(#glow-${from.x}-${from.y}-${to.x}-${to.y})`}
          />
          <text
            x={fromScreen.x + (toScreen.x - fromScreen.x) / 2}
            y={fromScreen.y + (toScreen.y - fromScreen.y) / 2 + 4}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={`rgba(${strokeColorRGB}, 1)`}
            fontSize="11"
            fontFamily="monospace"
            filter={`url(#glow-${from.x}-${from.y}-${to.x}-${to.y})`}
          >
            PR #{pullRequest.number}
          </text>
        </g>
      )}

      {/* Commit count indicator */}
      {commitCount > 0 && !pullRequest && (
        <text
          x={fromScreen.x + (toScreen.x - fromScreen.x) / 2}
          y={fromScreen.y + (toScreen.y - fromScreen.y) / 2 - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={`rgba(${strokeColorRGB}, 0.8)`}
          fontSize="10"
          fontFamily="monospace"
          opacity="0.6"
        >
          {commitCount} commit{commitCount > 1 ? 's' : ''}
        </text>
      )}
    </svg>
  );
};

interface DraggableCanvasProps {
  owner?: string;
  repo?: string;
  githubToken?: string; // Add support for GitHub token
}

interface CardPhysics {
  position: Position;
  velocity: Velocity;
  isDragging: boolean;
  lastDragPosition?: Position;
  originalPosition?: Position; // Store original position for bounce-back
  returnTo?: Position; // Target position to return to (for bounce)
}

export default function DraggableCanvas({
  owner = "facebook",
  repo = "react",
  githubToken
}: DraggableCanvasProps) {
  // Move these lines to the very top of the component
  const LAYOUT_OPTIONS = [
    { value: 'horizontal', label: 'Horizontal Tree' },
    { value: 'vertical', label: 'Vertical Tree' },
    { value: 'radial', label: 'Radial' },
  ];
  const [layoutAlignment, setLayoutAlignment] = useState<'horizontal' | 'vertical' | 'radial'>('horizontal');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [cardPhysics, setCardPhysics] = useState<Record<string, CardPhysics>>({});
  const [connections, setConnections] = useState<BranchConnection[]>([]);
  const [defaultBranch, setDefaultBranch] = useState<string>('main');
  const [showTreeView, setShowTreeView] = useState<boolean>(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [loadingCommits, setLoadingCommits] = useState<Set<string>>(new Set());
  const [showMergedBranches, setShowMergedBranches] = useState<boolean>(true);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [dragTargetBranch, setDragTargetBranch] = useState<string | null>(null); // Add this state
  const [draggingBranch, setDraggingBranch] = useState<string | null>(null); // Add this state
  const dragTargetRef = useRef<string | null>(null); // Add ref for immediate access
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // PR creation state - changed from modal to inline container
  const [showPRContainer, setShowPRContainer] = useState(false);
  const [prContainerPosition, setPRContainerPosition] = useState<Position>({ x: 0, y: 0 });
  const [prDetails, setPRDetails] = useState<{
    sourceBranch: string;
    targetBranch: string;
    title: string;
    body: string;
  }>({
    sourceBranch: '',
    targetBranch: '',
    title: '',
    body: ''
  });
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prError, setPRError] = useState<string | null>(null);
  const [isValidatingBranches, setIsValidatingBranches] = useState(false);
  const prContainerRef = useRef<HTMLDivElement>(null);

  // Branch creation form state
  const [showBranchCreationForm, setShowBranchCreationForm] = useState(false);
  const [branchCreationFormPosition, setBranchCreationFormPosition] = useState<Position>({ x: 0, y: 0 });
  const [newBranchDetails, setNewBranchDetails] = useState<{
    sourceBranch: string;
    branchName: string;
  }>({
    sourceBranch: '',
    branchName: ''
  });
  const [isCreatingNewBranch, setIsCreatingNewBranch] = useState(false);
  const [branchCreationError, setBranchCreationError] = useState<string | null>(null);
  const branchCreationFormRef = useRef<HTMLDivElement>(null);

  // Issues and container state
  const [issues, setIssues] = useState<Issue[]>([]);
  const [showIssuesContainer, setShowIssuesContainer] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'prs' | 'issues'>('prs');
  const [loadingIssues, setLoadingIssues] = useState<boolean>(false);

  // Branch creation drag state
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [branchCreationStart, setBranchCreationStart] = useState<{ branchName: string; position: Position } | null>(null);
  const [branchCreationMousePos, setBranchCreationMousePos] = useState<Position>({ x: 0, y: 0 });

  // Animation time for orbiting commit nodes
  const [animationTime, setAnimationTime] = useState<number>(0);

  // Calculate distance between two points
  const getDistance = (p1: Position, p2: Position): number => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle space key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.1, scale * zoomFactor), 5);

    // Calculate new offset to zoom towards mouse position
    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;

    const newOffset = {
      x: mouseX - worldX * newScale,
      y: mouseY - worldY * newScale
    };

    setScale(newScale);
    setOffset(newOffset);
  }, [scale, offset]);

  // Handle panning - only when space is pressed
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if we're clicking on a card
    const target = e.target as HTMLElement;
    const isCard = target.closest('[data-card]');

    // Only pan if space is pressed or if not clicking on a card
    if (isSpacePressed || !isCard) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }, [offset, isSpacePressed]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Set up event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseMove, handleMouseUp]);

  // Physics update loop
  const updatePhysics = useCallback(() => {
    setCardPhysics(prevPhysics => {
      const newPhysics = { ...prevPhysics };
      const cardIds = Object.keys(newPhysics);

      // Update positions based on velocity and handle bounce-back
      cardIds.forEach(id => {
        const card = newPhysics[id];
        if (!card.isDragging) {
          // Bounce-back logic
          if (card.returnTo) {
            const dx = card.returnTo.x - card.position.x;
            const dy = card.returnTo.y - card.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1) {
              // Snap to target and clear returnTo
              card.position = { ...card.returnTo };
              card.velocity = { x: 0, y: 0 };
              delete card.returnTo;
              delete card.originalPosition;
            } else {
              // Move toward returnTo with spring effect
              const spring = 0.2;
              card.velocity.x = dx * spring;
              card.velocity.y = dy * spring;
              card.position.x += card.velocity.x;
              card.position.y += card.velocity.y;
            }
          } else {
            // Apply velocity
            card.position.x += card.velocity.x;
            card.position.y += card.velocity.y;
            // Apply friction
            card.velocity.x *= FRICTION;
            card.velocity.y *= FRICTION;
            // Stop if velocity is too small
            if (Math.abs(card.velocity.x) < MIN_VELOCITY) card.velocity.x = 0;
            if (Math.abs(card.velocity.y) < MIN_VELOCITY) card.velocity.y = 0;
          }
        }
      });
      // Removed all collision detection and pushing logic
      return newPhysics;
    });

    // Update animation time for orbiting commit nodes
    setAnimationTime(prevTime => prevTime + 16); // Increment by ~16ms (60fps)

    animationFrameRef.current = requestAnimationFrame(updatePhysics);
  }, []);

  // Start physics simulation
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updatePhysics);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updatePhysics]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check cache first
        const cacheKey = `gitvis-branches-${owner}-${repo}`;
        const cacheTimeKey = `${cacheKey}-time`;
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(cacheTimeKey);

        // Cache TTL: 5 minutes
        const cacheTTL = 5 * 60 * 1000;
        const now = Date.now();

        if (cachedData && cacheTime && (now - parseInt(cacheTime)) < cacheTTL) {
          // Use cached data
          const { branches: cachedBranches, defaultBranch: cachedDefaultBranch } = JSON.parse(cachedData);

          setDefaultBranch(cachedDefaultBranch);

          // Load existing relationships
          const relationshipsCacheKey = `${cacheKey}-relationships`;
          const cachedRelationships = localStorage.getItem(relationshipsCacheKey);
          let existingRelationships: Record<string, string> = {};

          if (cachedRelationships) {
            try {
              existingRelationships = JSON.parse(cachedRelationships);
            } catch (e) {
              console.warn('Failed to parse cached relationships:', e);
            }
          }

          // Calculate tree structure
          const { branches: treeBranches, connections: treeConnections } = await calculateBranchTree(
            cachedBranches,
            owner,
            repo,
            cachedDefaultBranch,
            {},
            existingRelationships
          );

          setBranches(treeBranches);
          setConnections(treeConnections);

          // Calculate tree layout positions
          const treePositions = calculateTreeLayout(treeBranches, 1200, 800, 'horizontal');

          // Initialize physics with tree layout
          const physics: Record<string, CardPhysics> = {};
          treeBranches.forEach((branch) => {
            const position = treePositions[branch.name] || { x: 100, y: 100 };
            physics[branch.name] = {
              position,
              velocity: { x: 0, y: 0 },
              isDragging: false
            };
          });
          setCardPhysics(physics);
          setLoading(false);
          return;
        }

        // Prepare headers for GitHub API
        const headers: HeadersInit = {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        };

        if (githubToken) {
          headers['Authorization'] = `Bearer ${githubToken}`;
        }

        // First, get repository info to find default branch
        const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
        const repoResponse = await fetch(repoUrl, { headers });

        if (!repoResponse.ok) {
          if (repoResponse.status === 403) {
            throw new Error('Rate limit exceeded. Please add a GitHub token or try again later.');
          }
          throw new Error(`HTTP error! status: ${repoResponse.status}`);
        }

        const repoData = await repoResponse.json();
        const defaultBranchName = repoData.default_branch || 'main';
        setDefaultBranch(defaultBranchName);

        // Fetch all branches in parallel with pagination
        const fetchAllBranches = async () => {
          const allBranches: any[] = [];

          // First, get the total number of branches from the first page
          const firstPageUrl = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=1`;
          const firstPageResponse = await fetch(firstPageUrl, { headers });

          if (!firstPageResponse.ok) {
            if (firstPageResponse.status === 403) {
              throw new Error('Rate limit exceeded. Please add a GitHub token or try again later.');
            }
            throw new Error(`HTTP error! status: ${firstPageResponse.status}`);
          }

          const firstPageData = await firstPageResponse.json();
          allBranches.push(...firstPageData);

          // Check if there are more pages
          const linkHeader = firstPageResponse.headers.get('Link');
          let totalPages = 1;

          if (linkHeader) {
            const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
            if (lastPageMatch) {
              totalPages = parseInt(lastPageMatch[1], 10);
            }
          }

          // Update progress
          setLoadingProgress({ current: 1, total: totalPages });

          // If there are more pages, fetch them in parallel
          if (totalPages > 1) {
            const pagePromises = [];
            for (let page = 2; page <= totalPages; page++) {
              const pageUrl = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=${page}`;
              pagePromises.push(
                fetch(pageUrl, { headers })
                  .then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch page ${page}`);
                    return res.json();
                  })
                  .then(data => {
                    // Update progress as pages complete
                    setLoadingProgress(prev => ({ ...prev, current: prev.current + 1 }));
                    return data;
                  })
              );
            }

            // Fetch all pages in parallel
            const pageResults = await Promise.all(pagePromises);
            pageResults.forEach(pageData => {
              allBranches.push(...pageData);
            });
          }

          return allBranches;
        };

        const allBranches = await fetchAllBranches();

        // Cache the data
        localStorage.setItem(cacheKey, JSON.stringify({
          branches: allBranches,
          defaultBranch: defaultBranchName
        }));
        localStorage.setItem(cacheTimeKey, now.toString());

        // Check if we have existing branch relationships cached
        const relationshipsCacheKey = `${cacheKey}-relationships`;
        const cachedRelationships = localStorage.getItem(relationshipsCacheKey);
        let existingRelationships: Record<string, string> = {};

        if (cachedRelationships) {
          try {
            existingRelationships = JSON.parse(cachedRelationships);
          } catch (e) {
            console.warn('Failed to parse cached relationships:', e);
          }
        }

        // Calculate tree structure
        const { branches: treeBranches, connections: treeConnections } = await calculateBranchTree(
          allBranches,
          owner,
          repo,
          defaultBranchName,
          headers,
          existingRelationships
        );

        // Save the relationships for future use
        const newRelationships: Record<string, string> = {};
        treeBranches.forEach(branch => {
          if (branch.parent) {
            newRelationships[branch.name] = branch.parent;
          }
        });
        localStorage.setItem(relationshipsCacheKey, JSON.stringify(newRelationships));

        setBranches(treeBranches);
        setConnections(treeConnections);

        // Calculate tree layout positions
        const treePositions = calculateTreeLayout(treeBranches, 1200, 800, 'horizontal');

        // Initialize physics with tree layout
        const physics: Record<string, CardPhysics> = {};
        treeBranches.forEach((branch) => {
          const position = treePositions[branch.name] || { x: 100, y: 100 };
          physics[branch.name] = {
            position,
            velocity: { x: 0, y: 0 },
            isDragging: false
          };
        });
        setCardPhysics(physics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, [owner, repo, githubToken, layoutAlignment]);

  // Fetch pull requests when branches are loaded
  useEffect(() => {
    const fetchPullRequests = async () => {
      if (branches.length === 0 || loading) return;

      try {
        // Prepare headers for GitHub API
        const headers: HeadersInit = {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        };

        if (githubToken) {
          headers['Authorization'] = `Bearer ${githubToken}`;
        }

        // Fetch open pull requests
        const pullsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`;
        const response = await fetch(pullsUrl, { headers });

        if (!response.ok) {
          console.error('Failed to fetch pull requests:', response.status);
          return;
        }

        const pullRequestsData: PullRequest[] = await response.json();
        setPullRequests(pullRequestsData);

        // --- NEW LOGIC: Fetch ahead_by for each PR ---
        // This will be used as commitCount for the PR connection
        const prAheadByMap: Record<number, number> = {};
        await Promise.all(
          pullRequestsData.map(async (pr) => {
            try {
              const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${pr.base.ref}...${pr.head.ref}`;
              const compareRes = await fetch(compareUrl, { headers });
              if (compareRes.ok) {
                const compareData = await compareRes.json();
                prAheadByMap[pr.id] = compareData.ahead_by;
              } else {
                prAheadByMap[pr.id] = 0;
              }
            } catch (err) {
              prAheadByMap[pr.id] = 0;
            }
          })
        );
        // --- END NEW LOGIC ---

        // Update connections with pull request information
        setConnections(prevConnections => {
          const updatedConnections = [...prevConnections];

          // Create a map of PR connections for quick lookup
          const prConnectionMap = new Map<string, PullRequest>();
          pullRequestsData.forEach(pr => {
            const key = `${pr.head.ref}-${pr.base.ref}`;
            prConnectionMap.set(key, pr);
          });

          // Update existing connections with PR data and ahead_by
          return updatedConnections.map(connection => {
            const key = `${connection.from}-${connection.to}`;
            const pr = prConnectionMap.get(key);
            if (pr) {
              return {
                ...connection,
                pullRequest: pr,
                commitCount: prAheadByMap[pr.id] ?? connection.commitCount ?? 0
              };
            }
            return connection;
          });
        });

        // Add new connections for PRs that don't have existing branch relationships
        const existingConnectionKeys = new Set(
          connections.map(c => `${c.from}-${c.to}`)
        );

        const newConnections: BranchConnection[] = [];
        for (const pr of pullRequestsData) {
          const key = `${pr.head.ref}-${pr.base.ref}`;
          const headBranchExists = branches.some(b => b.name === pr.head.ref);
          const baseBranchExists = branches.some(b => b.name === pr.base.ref);
          if (headBranchExists && baseBranchExists && !existingConnectionKeys.has(key)) {
            newConnections.push({
              from: pr.head.ref,
              to: pr.base.ref,
              pullRequest: pr,
              commitCount: prAheadByMap[pr.id] ?? 0
            });
          }
        }
        if (newConnections.length > 0) {
          setConnections(prev => [...prev, ...newConnections]);
        }
      } catch (error) {
        console.error('Error fetching pull requests:', error);
      }
    };

    fetchPullRequests();
  }, [branches, loading, owner, repo, githubToken]);

  //Fetch collaborators when component mounts
  useEffect(() => {
    const fetchCollaborators = async () => {
      if (loading) return;

      try {
        // Prepare headers for GitHub API
        const headers: HeadersInit = {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        };

        if (githubToken) {
          headers['Authorization'] = `Bearer ${githubToken}`;
        }

        // Fetch collaborators
        const collaboratorsUrl = `https://api.github.com/repos/${owner}/${repo}/collaborators?per_page=10`;
        const response = await fetch(collaboratorsUrl, { headers });

        if (!response.ok) {
          console.error('Failed to fetch collaborators:', response.status);
          return;
        }

        const collaboratorsData: Collaborator[] = await response.json();
        setCollaborators(collaboratorsData);
      } catch (error) {
        console.error('Error fetching collaborators:', error);
      }
    };

    fetchCollaborators();
  }, [loading, owner, repo, githubToken]);

  // Fetch issues when component mounts
  useEffect(() => {
    const fetchIssues = async () => {
      if (loading) return;

      try {
        setLoadingIssues(true);

        // Prepare headers for GitHub API
        const headers: HeadersInit = {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        };

        if (githubToken) {
          headers['Authorization'] = `Bearer ${githubToken}`;
        }

        // Fetch open issues (excluding pull requests)
        const issuesUrl = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=50`;
        const response = await fetch(issuesUrl, { headers });

        if (!response.ok) {
          console.error('Failed to fetch issues:', response.status);
          return;
        }

        const issuesData: Issue[] = await response.json();

        // Filter out pull requests (issues with pull_request property)
        const actualIssues = issuesData.filter(issue => !issue.pull_request);
        setIssues(actualIssues);
      } catch (error) {
        console.error('Error fetching issues:', error);
      } finally {
        setLoadingIssues(false);
      }
    };

    fetchIssues();
  }, [loading, owner, repo, githubToken]);

  // Function to fetch commits for a specific branch
  const fetchCommitsForBranch = async (branchName: string) => {
    try {
      // Add to loading state
      setLoadingCommits(prev => new Set(prev).add(branchName));

      // Prepare headers for GitHub API
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };

      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
      }

      // Find the branch and its parent hierarchy
      const branch = branches.find(b => b.name === branchName);
      if (!branch) {
        throw new Error(`Branch ${branchName} not found`);
      }

      // Collect all parent branches up to the root
      const parentBranches: string[] = [];
      let currentBranch = branch;
      while (currentBranch.parent) {
        parentBranches.push(currentBranch.parent);
        currentBranch = branches.find(b => b.name === currentBranch.parent) || { name: '', commit: { sha: '', url: '' }, protected: false };
        if (!currentBranch.name) break;
      }

      // Fetch commits for the branch (increase limit to get more commits for filtering)
      const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branchName}&per_page=50`;
      const response = await fetch(commitsUrl, { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch commits: ${response.status}`);
      }

      const branchCommits = await response.json();

      // If this is the default branch (no parents), show all commits
      if (parentBranches.length === 0) {
        // Sort commits by date (newest first)
        const sortedCommits = branchCommits.sort((a: any, b: any) =>
          new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()
        );

        // Update the branch with commits and preserve hasUniqueCommits flag
        setBranches(prevBranches =>
          prevBranches.map(b =>
            b.name === branchName
              ? { ...b, commits: sortedCommits.slice(0, 10) }
              : b
          )
        );
        return;
      }

      // Fetch commits from all parent branches to exclude them
      const parentCommitShas = new Set<string>();

      for (const parentName of parentBranches) {
        try {
          const parentCommitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${parentName}&per_page=100`;
          const parentResponse = await fetch(parentCommitsUrl, { headers });

          if (parentResponse.ok) {
            const parentCommits = await parentResponse.json();
            parentCommits.forEach((commit: any) => {
              parentCommitShas.add(commit.sha);
            });
          }
        } catch (error) {
          console.warn(`Error fetching commits for parent branch ${parentName}:`, error);
        }
      }

      // Filter out commits that exist in parent branches
      const uniqueCommits = branchCommits.filter((commit: any) =>
        !parentCommitShas.has(commit.sha)
      );

      // Sort unique commits by date (newest first)
      const sortedUniqueCommits = uniqueCommits.sort((a: any, b: any) =>
        new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()
      );

      // Update the branch with unique commits and preserve hasUniqueCommits flag if already set
      setBranches(prevBranches =>
        prevBranches.map(b =>
          b.name === branchName
            ? {
              ...b,
              commits: sortedUniqueCommits.slice(0, 10),
              // Only update hasUniqueCommits if it wasn't already determined
              aheadBy: b.aheadBy !== undefined ? b.aheadBy : (uniqueCommits.length > 0 ? uniqueCommits.length : 0)
            }
            : b
        )
      );

      // Update connection commit count
      setConnections(prevConnections =>
        prevConnections.map(conn => {
          if (conn.from === branchName && !conn.pullRequest) {  // Changed: check from instead of to
            return { ...conn, commitCount: uniqueCommits.length };
          }
          return conn;
        })
      );
    } catch (error) {
      console.error(`Error fetching commits for ${branchName}:`, error);
    } finally {
      // Remove from loading state
      setLoadingCommits(prev => {
        const newSet = new Set(prev);
        newSet.delete(branchName);
        return newSet;
      });
    }
  };

  const handleStartDrag = (id: string, position: Position) => {
    setDraggingBranch(id); // Set the dragging branch
    setCardPhysics(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        isDragging: true,
        lastDragPosition: position,
        velocity: { x: 0, y: 0 },
        originalPosition: prev[id]?.position // Store the original position
      }
    }));
  };

  const handleDrag = (id: string, position: Position) => {
    setCardPhysics(prev => {
      const card = prev[id];
      const velocity = card.lastDragPosition ? {
        x: position.x - card.lastDragPosition.x,
        y: position.y - card.lastDragPosition.y
      } : { x: 0, y: 0 };

      // Check if we're dragging over another branch
      let newDragTarget: string | null = null;
      const dragThreshold = (COLLISION_RADIUS * 1.5) / scale; // Slightly larger threshold for drag detection

      Object.entries(prev).forEach(([branchId, physics]) => {
        if (branchId !== id) { // Don't check against self
          const distance = getDistance(position, physics.position);
          if (distance < dragThreshold) {
            newDragTarget = branchId;
          }
        }
      });

      // Always update drag target (including when it's null)
      setDragTargetBranch(newDragTarget);
      dragTargetRef.current = newDragTarget; // Update ref for immediate access

      return {
        ...prev,
        [id]: {
          ...card,
          position,
          velocity,
          lastDragPosition: position
        }
      };
    });
  };

  const handleEndDrag = (id: string) => {
    // Use ref for immediate access to the current drag target
    const targetBranch = dragTargetRef.current;
    let bounceBack = false;

    if (targetBranch) {
      console.log(`Dropped branch "${id}" onto branch "${targetBranch}"`);
      // Get the position of the target branch for the PR container
      const targetPhysics = cardPhysics[targetBranch];
      if (targetPhysics) {
        // Convert world position to screen position
        const screenPosition = {
          x: targetPhysics.position.x * scale + offset.x,
          y: targetPhysics.position.y * scale + offset.y
        };
        setPRContainerPosition(screenPosition);
        setPRDetails({
          sourceBranch: id,
          targetBranch: targetBranch,
          title: `Merge ${id} into ${targetBranch}`,
          body: ''
        });
        setShowPRContainer(true);
        setPRError(null);
      }
      bounceBack = true; // Bounce back if dropped on another branch
    }

    setDraggingBranch(null); // Clear dragging branch
    setDragTargetBranch(null); // Clear drag target
    dragTargetRef.current = null; // Clear ref
    setCardPhysics(prev => {
      const card = prev[id];
      let newCard = {
        ...card,
        isDragging: false,
        lastDragPosition: undefined
      };
      if (bounceBack && card.originalPosition) {
        newCard = {
          ...newCard,
          returnTo: card.originalPosition
        };
      }
      return {
        ...prev,
        [id]: newCard
      };
    });
  };

  const handleDoubleClick = (id: string) => {
    // Toggle expanded state
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);

        // Fetch commits if not already loaded
        const branch = branches.find(b => b.name === id);
        if (branch && !branch.commits) {
          fetchCommitsForBranch(id);
        }
      }
      return newSet;
    });
  };

  // Helper function to check if source branch is ahead of target branch
  const checkBranchAhead = async (sourceBranch: string, targetBranch: string): Promise<boolean> => {
    try {
      console.log(`Checking if ${sourceBranch} is ahead of ${targetBranch}...`);

      const headers: HeadersInit = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };

      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
      }

      const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${targetBranch}...${sourceBranch}`;
      console.log('Compare URL:', compareUrl);

      const response = await fetch(compareUrl, { headers });

      if (!response.ok) {
        console.warn(`Failed to compare branches: ${response.status} - ${response.statusText}`);
        const errorText = await response.text();
        console.warn('Error response:', errorText);
        return false;
      }

      const compareData = await response.json();
      console.log('Compare data:', compareData);

      const isAhead = compareData.ahead_by > 0;
      console.log(`${sourceBranch} is ${isAhead ? 'ahead' : 'not ahead'} of ${targetBranch} (ahead_by: ${compareData.ahead_by}, behind_by: ${compareData.behind_by})`);

      return isAhead;
    } catch (error) {
      console.warn('Error checking branch comparison:', error);
      return false;
    }
  };

  // Create a pull request
  const createPullRequest = async () => {
    setIsCreatingPR(true);
    setIsValidatingBranches(true);
    setPRError(null);

    try {
      // Validate input data before making API call
      if (!prDetails.title || prDetails.title.trim() === '') {
        throw new Error('Pull request title is required');
      }

      if (!prDetails.sourceBranch || !prDetails.targetBranch) {
        throw new Error('Source and target branches are required');
      }

      if (prDetails.sourceBranch === prDetails.targetBranch) {
        throw new Error('Source and target branches cannot be the same');
      }

      // Check if branches exist
      const sourceBranch = branches.find(b => b.name === prDetails.sourceBranch);
      const targetBranch = branches.find(b => b.name === prDetails.targetBranch);

      if (!sourceBranch) {
        throw new Error(`Source branch "${prDetails.sourceBranch}" not found`);
      }

      if (!targetBranch) {
        throw new Error(`Target branch "${prDetails.targetBranch}" not found`);
      }

      // Check if a PR already exists between these branches
      const existingPR = pullRequests.find(pr =>
        pr.head.ref === prDetails.sourceBranch && pr.base.ref === prDetails.targetBranch
      );

      if (existingPR) {
        throw new Error(`A pull request already exists from "${prDetails.sourceBranch}" to "${prDetails.targetBranch}"`);
      }

      // Check if source branch is ahead of target branch
      const isAhead = await checkBranchAhead(prDetails.sourceBranch, prDetails.targetBranch);
      if (!isAhead) {
        throw new Error(`Source branch "${prDetails.sourceBranch}" is not ahead of target branch "${prDetails.targetBranch}". No commits to merge.`);
      }

      setIsValidatingBranches(false);

      const headers: HeadersInit = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      };

      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
      }

      const requestBody = {
        title: prDetails.title.trim(),
        body: prDetails.body.trim() || undefined, // Only send body if not empty
        head: prDetails.sourceBranch,
        base: prDetails.targetBranch,
        draft: false
      };

      console.log('Creating pull request with data:', requestBody);

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('GitHub API error response:', errorData);

        // Provide more specific error messages based on common validation failures
        if (errorData.message === 'Validation Failed') {
          if (errorData.errors && Array.isArray(errorData.errors)) {
            const errorMessages = errorData.errors.map((err: any) => {
              if (err.code === 'custom') {
                return err.message;
              } else if (err.field === 'head') {
                return `Source branch "${prDetails.sourceBranch}" is not ahead of target branch "${prDetails.targetBranch}"`;
              } else if (err.field === 'base') {
                return `Target branch "${prDetails.targetBranch}" does not exist`;
              } else if (err.field === 'title') {
                return 'Pull request title is invalid';
              } else {
                return err.message || `Field "${err.field}" is invalid`;
              }
            });
            throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
          } else {
            throw new Error('Validation failed: Please check that the source branch has commits ahead of the target branch');
          }
        } else {
          throw new Error(errorData.message || `Failed to create PR: ${response.status}`);
        }
      }

      const prData = await response.json();
      console.log('Pull request created:', prData);

      // Close modal and refresh PR list
      setShowPRContainer(false);
      setPRDetails({
        sourceBranch: '',
        targetBranch: '',
        title: '',
        body: ''
      });

      // Refresh pull requests
      const pullsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`;
      const pullsResponse = await fetch(pullsUrl, { headers });
      if (pullsResponse.ok) {
        const pullRequestsData: PullRequest[] = await pullsResponse.json();
        setPullRequests(pullRequestsData);

        // Update connections with the new PR
        const existingConnection = connections.find(
          c => c.from === prDetails.sourceBranch && c.to === prDetails.targetBranch
        );

        if (existingConnection) {
          // Update existing connection with PR info
          setConnections(prevConnections =>
            prevConnections.map(c =>
              (c.from === prDetails.sourceBranch && c.to === prDetails.targetBranch)
                ? { ...c, pullRequest: prData }
                : c
            )
          );
        } else {
          // Get commit count for the new PR
          let commitCount = 0;
          try {
            // First check if the source branch has commits loaded
            const sourceBranch = branches.find(b => b.name === prDetails.sourceBranch);
            if (sourceBranch?.commits) {
              commitCount = sourceBranch.commits.length;
            } else {
              // Fetch commit count from the PR API
              const prCommitsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prData.number}/commits`;
              const commitsResponse = await fetch(prCommitsUrl, { headers });

              if (commitsResponse.ok) {
                const commitsData = await commitsResponse.json();
                commitCount = Math.min(commitsData.length, 5); // Cap at 5 for performance
              }
            }
          } catch (error) {
            console.warn(`Could not get commit count for new PR #${prData.number}`);
          }

          // Add new connection for the PR
          setConnections(prevConnections => [...prevConnections, {
            from: prDetails.sourceBranch,
            to: prDetails.targetBranch,
            pullRequest: prData,
            commitCount
          }]);
        }
      }

    } catch (error) {
      console.error('Error creating pull request:', error);
      setPRError(error instanceof Error ? error.message : 'Failed to create pull request');
    } finally {
      setIsCreatingPR(false);
      setIsValidatingBranches(false);
    }
  };

  // Create a new branch
  const createBranch = async () => {
    setIsCreatingNewBranch(true);
    setBranchCreationError(null);

    try {
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      };

      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
      }

      // Get the SHA of the source branch
      const sourceBranch = branches.find(b => b.name === newBranchDetails.sourceBranch);
      if (!sourceBranch) {
        throw new Error('Source branch not found');
      }

      // Create the reference (branch)
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${newBranchDetails.branchName}`,
          sha: sourceBranch.commit.sha
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to create branch: ${response.status}`);
      }

      const branchData = await response.json();
      console.log('Branch created:', branchData);

      // Create the new branch object
      const newBranch: Branch = {
        name: newBranchDetails.branchName,
        commit: {
          sha: sourceBranch.commit.sha,
          url: sourceBranch.commit.url
        },
        protected: false,
        parent: newBranchDetails.sourceBranch,
        depth: (sourceBranch.depth || 0) + 1,
        aheadBy: 0, // New branch starts with no unique commits
        children: []
      };

      // Add the new branch to the branches array
      setBranches(prevBranches => [...prevBranches, newBranch]);

      // Add the new branch to physics state with a position near the source branch
      const sourcePhysics = cardPhysics[newBranchDetails.sourceBranch];
      if (sourcePhysics) {
        // Calculate a better position based on tree layout principles
        const sourceBranch = branches.find(b => b.name === newBranchDetails.sourceBranch);
        const newDepth = (sourceBranch?.depth || 0) + 1;

        // Find other branches at the same depth to calculate spacing
        const branchesAtSameDepth = branches.filter(b => b.depth === newDepth);
        const horizontalSpacing = 200;
        const verticalSpacing = 150;

        // Calculate position based on tree layout
        let newX: number;
        let newY: number;

        if (branchesAtSameDepth.length === 0) {
          // First branch at this depth, position it below the parent
          newX = sourcePhysics.position.x;
          newY = sourcePhysics.position.y + verticalSpacing;
        } else {
          // Position it to the right of existing branches at this depth
          const maxX = Math.max(...branchesAtSameDepth.map(b => {
            const physics = cardPhysics[b.name];
            return physics ? physics.position.x : 0;
          }));
          newX = maxX + horizontalSpacing;
          newY = sourcePhysics.position.y + verticalSpacing;
        }

        setCardPhysics(prev => ({
          ...prev,
          [newBranchDetails.branchName]: {
            position: { x: newX, y: newY },
            velocity: { x: 0, y: 0 },
            isDragging: false
          }
        }));
      }

      // Add connection from source branch to new branch
      setConnections(prevConnections => [...prevConnections, {
        from: newBranchDetails.sourceBranch,
        to: newBranchDetails.branchName,
        commitCount: 0
      }]);

      // Update the source branch's children
      setBranches(prevBranches =>
        prevBranches.map(branch =>
          branch.name === newBranchDetails.sourceBranch
            ? { ...branch, children: [...(branch.children || []), newBranchDetails.branchName] }
            : branch
        )
      );

      // Close form
      setShowBranchCreationForm(false);
      setNewBranchDetails({
        sourceBranch: '',
        branchName: ''
      });

      // Clear cache to ensure fresh data on next load
      const cacheKey = `gitvis-branches-${owner}-${repo}`;
      const cacheTimeKey = `${cacheKey}-time`;
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheTimeKey);

    } catch (error) {
      console.error('Error creating branch:', error);
      setBranchCreationError(error instanceof Error ? error.message : 'Failed to create branch');
    } finally {
      setIsCreatingNewBranch(false);
    }
  };

  // Handle click outside PR container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (prContainerRef.current && !prContainerRef.current.contains(event.target as Node)) {
        setShowPRContainer(false);
      }
    };

    if (showPRContainer) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPRContainer]);

  // Handle click outside branch creation form
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (branchCreationFormRef.current && !branchCreationFormRef.current.contains(event.target as Node)) {
        setShowBranchCreationForm(false);
      }
    };

    if (showBranchCreationForm) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBranchCreationForm]);

  // Branch creation handlers
  const handleBranchCreationStart = useCallback((branchName: string, worldPosition: Position, screenPosition: Position) => {
    setIsCreatingBranch(true);
    setBranchCreationStart({ branchName, position: worldPosition });
    setBranchCreationMousePos(screenPosition);

    // Set up global mouse move and up handlers
    const handleMouseMove = (e: MouseEvent) => {
      setBranchCreationMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) { // Right mouse button
        // Calculate final world position
        const finalWorldPosition = {
          x: (e.clientX - offset.x) / scale,
          y: (e.clientY - offset.y) / scale
        };

        console.log('Branch creation ended:', {
          sourceBranch: branchName,
          startPosition: worldPosition,
          endPosition: finalWorldPosition,
          screenPosition: { x: e.clientX, y: e.clientY }
        });

        // Show branch creation form at the release position
        setBranchCreationFormPosition({ x: e.clientX, y: e.clientY });
        setNewBranchDetails({
          sourceBranch: branchName,
          branchName: ''
        });
        setShowBranchCreationForm(true);
        setBranchCreationError(null);

        // Clean up
        setIsCreatingBranch(false);
        setBranchCreationStart(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [offset, scale]);

  // Set the handler on window so DraggableNode can access it
  useEffect(() => {
    (window as any).onBranchCreationStart = handleBranchCreationStart;
    return () => {
      delete (window as any).onBranchCreationStart;
    };
  }, [handleBranchCreationStart]);

  if (loading) {
    return (
      <div className="relative w-full h-screen bg-[#000d1a] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
          {loadingProgress.total > 0 && (
            <div className="text-center">
              <p className="text-gray-400 mb-2">Loading branches...</p>
              <p className="text-gray-500 text-sm">
                {loadingProgress.current} / {loadingProgress.total} pages
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-screen bg-[#000d1a] flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-medium text-red-300 mb-2">Error loading branches</h3>
          <p className="text-red-400 mb-4">{error}</p>
          {error.includes('Rate limit') && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
              <h4 className="text-blue-300 font-medium mb-2">Need a GitHub Token?</h4>
              <p className="text-blue-400 text-sm mb-3">
                To avoid rate limiting and get detailed branch relationships, you can provide a GitHub personal access token.
              </p>
              <p className="text-gray-400 text-xs">
                Create one at: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">github.com/settings/tokens</a>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className={`relative w-full h-screen bg-[#000d1a] overflow-hidden ${isPanning ? 'cursor-grabbing' : (isSpacePressed ? 'cursor-grab' : 'cursor-default')
        }`}
      onMouseDown={handleMouseDown}
    >
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />

      {/* Canvas background pattern */}
      <div
        className="absolute inset-0 opacity-10 canvas-background pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Crect x='28' y='28' width='4' height='4'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: `${60 * scale}px ${60 * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
          transform: 'translateZ(0)' // Force GPU acceleration
        }}
      />

      {/* Header */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h1 className="text-2xl font-bold text-white">
          {owner}/{repo} Branches
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {branches.length} branch{branches.length !== 1 ? 'es' : ''}
          {pullRequests.length > 0 && (
            <span className="text-green-400">
              {' '}• {pullRequests.length} open PR{pullRequests.length !== 1 ? 's' : ''}
            </span>
          )}
          {' '}• Hold Space to navigate • Scroll to zoom
        </p>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-4 right-16 z-10 bg-gray-800/80 backdrop-blur-sm rounded-lg px-3 py-2 pointer-events-none">
        <p className="text-gray-300 text-sm font-mono">{Math.round(scale * 100)}%</p>
      </div>

      {/* Collaborators and GitHub button */}
      <div className="absolute top-4 right-32 z-10 flex items-center gap-3 pointer-events-auto">
        {/* Collaborators */}
        {collaborators.length > 0 && (
          <div className="flex items-center -space-x-2">
            {collaborators.slice(0, 5).map((collaborator) => (
              <a
                key={collaborator.id}
                href={collaborator.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative group"
                title={collaborator.login}
              >
                <img
                  src={collaborator.avatar_url}
                  alt={collaborator.login}
                  className="w-8 h-8 rounded-full border-2 border-gray-800 hover:border-blue-500 transition-colors hover:z-10"
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {collaborator.login}
                  {collaborator.permissions?.admin && (
                    <span className="text-yellow-400 ml-1">Admin</span>
                  )}
                </div>
              </a>
            ))}
            {collaborators.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center text-xs text-gray-300">
                +{collaborators.length - 5}
              </div>
            )}
          </div>
        )}

        {/* GitHub button */}
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-800/80 backdrop-blur-sm p-2 rounded-lg hover:bg-gray-700/80 transition-colors"
          title="View on GitHub"
        >
          <svg
            className="w-5 h-5 text-gray-300"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
      </div>

      {/* Space indicator */}
      {isSpacePressed && (
        <div className="absolute top-16 right-16 z-10 bg-blue-600/80 backdrop-blur-sm rounded-lg px-3 py-2 pointer-events-none">
          <p className="text-white text-sm font-medium">Pan Mode</p>
        </div>
      )}

      {/* Connection Lines */}
      {showTreeView && connections
        .filter(connection => {
          // Only show connections where both branches are visible
          const fromBranch = branches.find(b => b.name === connection.from);
          const toBranch = branches.find(b => b.name === connection.to);
          return (showMergedBranches || fromBranch?.aheadBy !== 0) &&
            (showMergedBranches || toBranch?.aheadBy !== 0);
        })
        .map((connection, index) => {
          const fromPhysics = cardPhysics[connection.from];
          const toPhysics = cardPhysics[connection.to];
          const fromBranch = branches.find(b => b.name === connection.from);

          if (!fromPhysics || !toPhysics) return null;

          return (
            <ConnectionLine
              key={`${connection.from}-${connection.to}-${index}`}
              from={fromPhysics.position}
              to={toPhysics.position}
              scale={scale}
              offset={offset}
              pullRequest={connection.pullRequest}
              commitCount={
                connection.pullRequest
                  ? Math.max(0, Math.min(5, connection.commitCount || 0))
                  : Math.max(0, Math.min(5, fromBranch?.aheadBy ?? 0))
              }
            />
          );
        })}

      {/* Draggable Branch Cards */}
      {branches
        .filter(branch => showMergedBranches || branch.aheadBy !== 0) // Filter branches based on showMergedBranches state
        .map((branch) => {
          const physics = cardPhysics[branch.name];
          if (!physics) return null;

          return (
            <div key={branch.name} data-card="true">
              <DraggableNode
                id={branch.name}
                branch={branch}
                position={physics.position}
                velocity={physics.velocity}
                isDragging={physics.isDragging}
                scale={scale}
                offset={offset}
                isSpacePressed={isSpacePressed}
                isExpanded={expandedCards.has(branch.name)}
                isLoadingCommits={loadingCommits.has(branch.name)}
                isDragTarget={dragTargetBranch === branch.name} // Use the drag target state
                animationTime={animationTime} // Pass animation time for orbiting commits
                onStartDrag={handleStartDrag}
                onDrag={handleDrag}
                onEndDrag={handleEndDrag}
                onDoubleClick={handleDoubleClick}
              />
            </div>
          );
        })}

      {/* Branch Creation Preview */}
      {isCreatingBranch && branchCreationStart && (
        <>
          {/* Connection line from source branch to mouse */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 100
            }}
          >
            <line
              x1={branchCreationStart.position.x * scale + offset.x}
              y1={branchCreationStart.position.y * scale + offset.y}
              x2={branchCreationMousePos.x}
              y2={branchCreationMousePos.y}
              stroke="rgba(156, 163, 175, 0.5)"
              strokeWidth="2"
              strokeDasharray="4,4"
            />
          </svg>

          {/* Gray preview node at mouse position */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${branchCreationMousePos.x - NODE_RADIUS * scale}px`,
              top: `${branchCreationMousePos.y - NODE_RADIUS * scale}px`,
              width: `${NODE_RADIUS * scale * 2}px`,
              height: `${NODE_RADIUS * scale * 2}px`,
              zIndex: 101
            }}
          >
            <div
              className="absolute inset-0 rounded-full bg-gray-700 border border-gray-600 opacity-60"
              style={{
                boxShadow: '0 0 20px rgba(156, 163, 175, 0.6), 0 0 40px rgba(156, 163, 175, 0.6), inset 0 0 15px rgba(156, 163, 175, 0.6)',
                background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2), rgba(156, 163, 175, 0.8))',
              }}
            >
              {/* Inner glow effect */}
              <div
                className="absolute inset-1 rounded-full"
                style={{
                  background: 'radial-gradient(circle at center, rgba(156, 163, 175, 0.6), transparent)',
                  filter: 'blur(2px)',
                }}
              />
            </div>

            {/* "New Branch" text */}
            <div
              className="absolute left-1/2 transform -translate-x-1/2 whitespace-nowrap"
              style={{
                top: `${NODE_RADIUS * scale * 2 + 4}px`,
              }}
            >
              <div className="bg-gray-900/90 backdrop-blur-sm px-2 py-1 rounded-md border border-gray-700/50">
                <p className="text-gray-400 text-sm">New Branch</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-sm text-gray-500 pointer-events-none">
        Drag cards to move them • Double-click to view commits • Right-click drag to create branch • Hold Space + drag to navigate • Scroll to zoom
      </div>

      {/* View controls */}
      <div className="absolute bottom-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setShowMergedBranches(!showMergedBranches)}
          className={`bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-lg text-sm hover:bg-gray-700/80 transition-colors pointer-events-auto flex items-center gap-2 ${showMergedBranches ? 'text-gray-300' : 'text-gray-500'
            }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
              showMergedBranches
                ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            } />
          </svg>
          {showMergedBranches ? 'Hide Branches w/o Unique Commits' : 'Show All Branches'}
        </button>
        <button
          onClick={() => {
            // Clear cache and refresh
            const cacheKey = `gitvis-branches-${owner}-${repo}`;
            const cacheTimeKey = `${cacheKey}-time`;
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimeKey);

            // Trigger re-fetch by updating a dummy state
            window.location.reload();
          }}
          className="bg-gray-800/80 backdrop-blur-sm text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-700/80 transition-colors pointer-events-auto flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
        <button
          onClick={() => {
            setShowTreeView(!showTreeView);
            if (!showTreeView) {
              // Reset to tree layout
              const treePositions = calculateTreeLayout(branches, 1200, 800, layoutAlignment);
              setCardPhysics(prev => {
                const newPhysics = { ...prev };
                Object.keys(newPhysics).forEach(branchName => {
                  const position = treePositions[branchName];
                  if (position) {
                    newPhysics[branchName] = {
                      ...newPhysics[branchName],
                      position,
                      velocity: { x: 0, y: 0 }
                    };
                  }
                });
                return newPhysics;
              });
            }
          }}
          className="bg-gray-800/80 backdrop-blur-sm text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-700/80 transition-colors pointer-events-auto flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showTreeView ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m0 0l-4-4m4 4l4-4" />
            )}
          </svg>
          {showTreeView ? 'Free Layout' : 'Tree View'}
        </button>
        <button
          onClick={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}
          className="bg-gray-800/80 backdrop-blur-sm text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-700/80 transition-colors pointer-events-auto"
        >
          Reset View
        </button>
        {/* Layout alignment dropdown */}
        <select
          value={layoutAlignment}
          onChange={e => {
            const value = e.target.value as 'horizontal' | 'vertical' | 'radial';
            setLayoutAlignment(value);
            if (showTreeView) {
              // Reset to new layout
              const treePositions = calculateTreeLayout(branches, 1200, 800, value);
              setCardPhysics(prev => {
                const newPhysics = { ...prev };
                Object.keys(newPhysics).forEach(branchName => {
                  const position = treePositions[branchName];
                  if (position) {
                    newPhysics[branchName] = {
                      ...newPhysics[branchName],
                      position,
                      velocity: { x: 0, y: 0 }
                    };
                  }
                });
                return newPhysics;
              });
            }
          }}
          className="bg-gray-800/80 backdrop-blur-sm text-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-700/80 transition-colors pointer-events-auto mr-2"
          style={{ minWidth: 140 }}
        >
          {LAYOUT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* PR Creation Container - positioned at target branch */}
      {showPRContainer && (
        <div
          ref={prContainerRef}
          className="absolute z-50 bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 p-4 shadow-2xl max-w-sm"
          style={{
            left: `${prContainerPosition.x + 50}px`, // Offset from branch center
            top: `${prContainerPosition.y - 100}px`, // Position above branch
            boxShadow: '0 0 50px rgba(59, 130, 246, 0.15), 0 0 100px rgba(59, 130, 246, 0.1)',
            transform: 'translateZ(0)' // Force GPU acceleration
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Create Pull Request</h3>
            <button
              onClick={() => setShowPRContainer(false)}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isCreatingPR}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Branch info */}
          <div className="mb-4 p-2 bg-gray-800/50 rounded border border-gray-700/50">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400">From:</span>
              <span className="text-blue-400 font-mono">{prDetails.sourceBranch}</span>
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-gray-400">Into:</span>
              <span className="text-green-400 font-mono">{prDetails.targetBranch}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={(e) => { e.preventDefault(); createPullRequest(); }}>
            {/* Title */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={prDetails.title}
                onChange={(e) => setPRDetails(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                placeholder="Add a title"
                required
                disabled={isCreatingPR}
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={prDetails.body}
                onChange={(e) => setPRDetails(prev => ({ ...prev, body: e.target.value }))}
                className="w-full px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors resize-none text-sm"
                placeholder="Add a description (optional)"
                rows={3}
                disabled={isCreatingPR}
              />
            </div>

            {/* Error message */}
            {prError && (
              <div className="mb-3 p-2 bg-red-900/20 border border-red-700/50 rounded text-xs">
                <p className="text-red-400">{prError}</p>
              </div>
            )}

            {/* Validation info */}
            {isValidatingBranches && (
              <div className="mb-3 p-2 bg-blue-900/20 border border-blue-700/50 rounded text-xs">
                <p className="text-blue-400">Checking if source branch has commits ahead of target branch...</p>
              </div>
            )}

            {/* Help text */}
            {!isValidatingBranches && !isCreatingPR && !prError && (
              <div className="mb-3 p-2 bg-gray-800/20 border border-gray-700/50 rounded text-xs">
                <p className="text-gray-400">
                  <strong>Tip:</strong> A pull request can only be created when the source branch has commits that are ahead of the target branch.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowPRContainer(false)}
                className="px-3 py-1 text-gray-300 hover:text-white transition-colors text-sm"
                disabled={isCreatingPR}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingPR || isValidatingBranches || !prDetails.title}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-all duration-200 flex items-center gap-1 text-sm font-medium"
                style={{
                  boxShadow: !isCreatingPR && !isValidatingBranches && prDetails.title ? '0 0 15px rgba(59, 130, 246, 0.4)' : 'none'
                }}
              >
                {isValidatingBranches ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Validating...
                  </>
                ) : isCreatingPR ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create PR
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branch Creation Form - positioned at mouse release */}
      {showBranchCreationForm && (
        <div
          ref={branchCreationFormRef}
          className="absolute z-50 bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 p-4 shadow-2xl max-w-sm"
          style={{
            left: `${branchCreationFormPosition.x - 150}px`, // Center the form on cursor
            top: `${branchCreationFormPosition.y - 50}px`,
            boxShadow: '0 0 50px rgba(156, 163, 175, 0.15), 0 0 100px rgba(156, 163, 175, 0.1)',
            transform: 'translateZ(0)' // Force GPU acceleration
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Create Branch</h3>
            <button
              onClick={() => setShowBranchCreationForm(false)}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isCreatingNewBranch}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Branch info */}
          <div className="mb-4 p-2 bg-gray-800/50 rounded border border-gray-700/50">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400">Branching from:</span>
              <span className="text-blue-400 font-mono">{newBranchDetails.sourceBranch}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={(e) => { e.preventDefault(); createBranch(); }}>
            {/* Branch name */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Branch Name
              </label>
              <input
                type="text"
                value={newBranchDetails.branchName}
                onChange={(e) => setNewBranchDetails(prev => ({ ...prev, branchName: e.target.value }))}
                className="w-full px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gray-500/50 focus:ring-1 focus:ring-gray-500/50 transition-colors text-sm"
                placeholder="feature/new-branch"
                required
                disabled={isCreatingNewBranch}
                autoFocus
                pattern="^[a-zA-Z0-9/._-]+$"
                title="Branch name can only contain letters, numbers, hyphens, underscores, dots, and forward slashes"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use forward slashes for folders (e.g., feature/my-branch)
              </p>
            </div>

            {/* Error message */}
            {branchCreationError && (
              <div className="mb-3 p-2 bg-red-900/20 border border-red-700/50 rounded text-xs">
                <p className="text-red-400">{branchCreationError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowBranchCreationForm(false)}
                className="px-3 py-1 text-gray-300 hover:text-white transition-colors text-sm"
                disabled={isCreatingNewBranch}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingNewBranch || !newBranchDetails.branchName}
                className="px-4 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-all duration-200 flex items-center gap-1 text-sm font-medium"
                style={{
                  boxShadow: !isCreatingNewBranch && newBranchDetails.branchName ? '0 0 15px rgba(156, 163, 175, 0.4)' : 'none'
                }}
              >
                {isCreatingNewBranch ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Branch
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Issues and Pull Requests Container - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-20">
        {/* Toggle Button */}
        <button
          onClick={() => setShowIssuesContainer(!showIssuesContainer)}
          className="bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-lg p-3 hover:bg-gray-800/90 transition-all duration-200 group"
          style={{
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.1), 0 0 40px rgba(59, 130, 246, 0.05)',
            transform: 'translateZ(0)'
          }}
        >
          <div className="relative">
            <svg className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>

            {/* Notification badges */}
            {(pullRequests.length > 0 || issues.length > 0) && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-medium">
                  {pullRequests.length + issues.length > 9 ? '9+' : pullRequests.length + issues.length}
                </span>
              </div>
            )}
          </div>
        </button>

        {/* Container */}
        {showIssuesContainer && (
          <div
            className="absolute bottom-16 right-0 w-80 bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-2xl"
            style={{
              boxShadow: '0 0 50px rgba(59, 130, 246, 0.15), 0 0 100px rgba(59, 130, 246, 0.1)',
              transform: 'translateZ(0)'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
              <h3 className="text-lg font-semibold text-white">Issues & PRs</h3>
              <button
                onClick={() => setShowIssuesContainer(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700/50">
              <button
                onClick={() => setActiveTab('prs')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${activeTab === 'prs'
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Pull Requests
                  {pullRequests.length > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {pullRequests.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('issues')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${activeTab === 'issues'
                    ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/10'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Issues
                  {issues.length > 0 && (
                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {issues.length}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {activeTab === 'prs' ? (
                <div className="p-4 space-y-3">
                  {pullRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-400 text-sm">No open pull requests</p>
                    </div>
                  ) : (
                    pullRequests.map((pr) => (
                      <a
                        key={pr.id}
                        href={pr.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:bg-gray-700/50 hover:border-blue-500/50 transition-all duration-200 group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300">
                              #{pr.number}
                            </span>
                            {pr.draft && (
                              <span className="px-1.5 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">
                                Draft
                              </span>
                            )}
                            {pr.mergeable_state === 'blocked' && (
                              <span className="px-1.5 py-0.5 bg-red-600 text-white text-xs rounded">
                                Blocked
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <img
                              src={pr.user.avatar_url}
                              alt={pr.user.login}
                              className="w-4 h-4 rounded-full"
                            />
                            <span>{pr.user.login}</span>
                          </div>
                        </div>
                        <h4 className="text-sm text-white font-medium mb-2 line-clamp-2">
                          {pr.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <div className="flex items-center gap-3">
                            <span>{pr.head.ref} → {pr.base.ref}</span>
                            <span>{formatDate(pr.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span>0</span>
                          </div>
                        </div>
                      </a>
                    ))
                  )}
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {loadingIssues ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400 mx-auto mb-3"></div>
                      <p className="text-gray-400 text-sm">Loading issues...</p>
                    </div>
                  ) : issues.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <p className="text-gray-400 text-sm">No open issues</p>
                    </div>
                  ) : (
                    issues.map((issue) => (
                      <a
                        key={issue.id}
                        href={issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:bg-gray-700/50 hover:border-orange-500/50 transition-all duration-200 group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-orange-400 group-hover:text-orange-300">
                              #{issue.number}
                            </span>
                            {issue.labels.length > 0 && (
                              <div className="flex gap-1">
                                {issue.labels.slice(0, 2).map((label, index) => (
                                  <span
                                    key={index}
                                    className="px-1.5 py-0.5 text-xs rounded"
                                    style={{
                                      backgroundColor: `#${label.color}`,
                                      color: parseInt(label.color, 16) > 0x888888 ? '#000' : '#fff'
                                    }}
                                  >
                                    {label.name}
                                  </span>
                                ))}
                                {issue.labels.length > 2 && (
                                  <span className="px-1.5 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">
                                    +{issue.labels.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <img
                              src={issue.user.avatar_url}
                              alt={issue.user.login}
                              className="w-4 h-4 rounded-full"
                            />
                            <span>{issue.user.login}</span>
                          </div>
                        </div>
                        <h4 className="text-sm text-white font-medium mb-2 line-clamp-2">
                          {issue.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <div className="flex items-center gap-3">
                            {issue.assignees.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span>Assigned to:</span>
                                <div className="flex -space-x-1">
                                  {issue.assignees.slice(0, 2).map((assignee, index) => (
                                    <img
                                      key={index}
                                      src={assignee.avatar_url}
                                      alt={assignee.login}
                                      className="w-3 h-3 rounded-full border border-gray-700"
                                      title={assignee.login}
                                    />
                                  ))}
                                  {issue.assignees.length > 2 && (
                                    <span className="text-xs">+{issue.assignees.length - 2}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            <span>{formatDate(issue.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span>{issue.comments}</span>
                          </div>
                        </div>
                      </a>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 