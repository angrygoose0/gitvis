/**
 * ConnectionLine component for rendering connections between branch nodes
 * Handles pull request status visualization and commit flow animations
 */

import React, { memo } from 'react';
import { ConnectionLineProps } from '../types/components';
import { worldToScreen } from '../utils/coordinate-transformer';

// Constants for node sizing (matching main component)
const NODE_RADIUS = 8;

/**
 * ConnectionLine component renders animated lines between branch nodes
 * Features:
 * - Pull request status visualization with different colors
 * - Animated energy pulses representing commit flow
 * - Glowing effects and gradients
 * - PR information display
 */
const ConnectionLineComponent: React.FC<ConnectionLineProps> = ({ 
  from, 
  to, 
  scale, 
  offset, 
  pullRequest, 
  commitCount = 0 
}) => {
  // Memoize screen position calculations
  const fromScreen = React.useMemo(() => worldToScreen(from, scale, offset), [from, scale, offset]);
  const toScreen = React.useMemo(() => worldToScreen(to, scale, offset), [to, scale, offset]);

  // Memoize geometric calculations
  const { dx, dy, distance, angle, nodeRadius, fromEdge, toEdge } = React.useMemo(() => {
    const dx = toScreen.x - fromScreen.x;
    const dy = toScreen.y - fromScreen.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const nodeRadius = NODE_RADIUS * scale;
    
    return {
      dx,
      dy,
      distance,
      angle,
      nodeRadius,
      fromEdge: {
        x: fromScreen.x + Math.cos(angle) * nodeRadius,
        y: fromScreen.y + Math.sin(angle) * nodeRadius
      },
      toEdge: {
        x: toScreen.x - Math.cos(angle) * nodeRadius,
        y: toScreen.y - Math.sin(angle) * nodeRadius
      }
    };
  }, [fromScreen, toScreen, scale]);

  // Memoize stroke color calculation
  const strokeColorRGB = React.useMemo(() => {
    if (pullRequest) {
      if (pullRequest.draft) return "156, 163, 175"; // Gray for draft PRs
      if (pullRequest.mergeable_state === 'blocked') return "239, 68, 68"; // Red for blocked PRs
      return "34, 197, 94"; // Green for ready PRs
    }
    return "99, 102, 241"; // Blue for regular connections
  }, [pullRequest]);

  const glowIntensity = pullRequest ? 0.8 : 0.5;

  // Memoize pulse calculations
  const { numPulses, pulseDelay } = React.useMemo(() => {
    const numPulses = Math.min(commitCount, 5);
    const pulseDelay = numPulses > 0 ? 3 / numPulses : 0;
    return { numPulses, pulseDelay };
  }, [commitCount]);

  // Memoize unique IDs for gradients and filters
  const { gradientId, prPulseId, glowId, pathId } = React.useMemo(() => ({
    gradientId: `line-gradient-${from.x}-${from.y}-${to.x}-${to.y}`,
    prPulseId: `pr-pulse-${pullRequest?.id || 'default'}`,
    glowId: `glow-${from.x}-${from.y}-${to.x}-${to.y}`,
    pathId: `path-${from.x}-${from.y}-${to.x}-${to.y}`
  }), [from.x, from.y, to.x, to.y, pullRequest?.id]);

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
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={`rgba(${strokeColorRGB}, 0)`} />
          <stop offset="10%" stopColor={`rgba(${strokeColorRGB}, ${glowIntensity})`} />
          <stop offset="50%" stopColor={`rgba(${strokeColorRGB}, ${glowIntensity})`} />
          <stop offset="90%" stopColor={`rgba(${strokeColorRGB}, ${glowIntensity})`} />
          <stop offset="100%" stopColor={`rgba(${strokeColorRGB}, 0)`} />
        </linearGradient>

        {/* Animated gradient for pull requests */}
        {pullRequest && (
          <linearGradient id={prPulseId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={`rgba(${strokeColorRGB}, 0)`}>
              <animate 
                attributeName="stop-color"
                values={`rgba(${strokeColorRGB}, 0);rgba(${strokeColorRGB}, 0.8);rgba(${strokeColorRGB}, 0)`}
                dur="2s"
                repeatCount="indefinite" 
              />
            </stop>
            <stop offset="50%" stopColor={`rgba(${strokeColorRGB}, 0.8)`}>
              <animate 
                attributeName="stop-color"
                values={`rgba(${strokeColorRGB}, 0.8);rgba(${strokeColorRGB}, 0);rgba(${strokeColorRGB}, 0.8)`}
                dur="2s"
                repeatCount="indefinite" 
              />
            </stop>
            <stop offset="100%" stopColor={`rgba(${strokeColorRGB}, 0)`}>
              <animate 
                attributeName="stop-color"
                values={`rgba(${strokeColorRGB}, 0);rgba(${strokeColorRGB}, 0.8);rgba(${strokeColorRGB}, 0)`}
                dur="2s"
                repeatCount="indefinite" 
              />
            </stop>
          </linearGradient>
        )}

        {/* Glow filter */}
        <filter id={glowId}>
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
        filter={`url(#${glowId})`}
      />

      {/* Main line */}
      <line
        x1={fromEdge.x}
        y1={fromEdge.y}
        x2={toEdge.x}
        y2={toEdge.y}
        stroke={pullRequest ? `url(#${prPulseId})` : `url(#${gradientId})`}
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
              filter={`url(#${glowId})`}
            >
              <animateMotion
                dur="3s"
                repeatCount="indefinite"
                begin={`${index * pulseDelay}s`}
              >
                <mpath href={`#${pathId}`} />
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
        id={pathId}
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
            fill="rgba(0, 0, 0, 0.6)"
            stroke={`rgba(${strokeColorRGB}, 0.4)`}
            strokeWidth="1"
            rx="12"
            ry="12"
            filter={`url(#${glowId})`}
          />
          <text
            x={fromScreen.x + (toScreen.x - fromScreen.x) / 2}
            y={fromScreen.y + (toScreen.y - fromScreen.y) / 2 + 4}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={`rgba(${strokeColorRGB}, 1)`}
            fontSize="11"
            fontFamily="monospace"
            filter={`url(#${glowId})`}
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

// Memoize the component to prevent unnecessary re-renders
export const ConnectionLine = memo(ConnectionLineComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.from.x === nextProps.from.x &&
    prevProps.from.y === nextProps.from.y &&
    prevProps.to.x === nextProps.to.x &&
    prevProps.to.y === nextProps.to.y &&
    prevProps.scale === nextProps.scale &&
    prevProps.offset.x === nextProps.offset.x &&
    prevProps.offset.y === nextProps.offset.y &&
    prevProps.commitCount === nextProps.commitCount &&
    prevProps.pullRequest?.id === nextProps.pullRequest?.id &&
    prevProps.pullRequest?.draft === nextProps.pullRequest?.draft &&
    prevProps.pullRequest?.mergeable_state === nextProps.pullRequest?.mergeable_state
  );
});