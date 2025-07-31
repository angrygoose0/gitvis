'use client';

import React, { memo } from 'react';
import { Position } from '../types';

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

export interface CommitNodeProps {
  commit: Commit;
  index: number;
  totalCommits: number;
  animationTime: number;
  scale: number;
  branchPosition: Position;
  scaledRadius: number;
  scaledCommitRadius: number;
  textOpacity: number;
  commitTextOpacity: number;
}

const COMMIT_NODE_RADIUS = 4; // Base radius for commit nodes
const MIN_SCALE_FOR_COMMIT_TEXT = 1.5; // Minimum scale to show commit text

/**
 * Calculate positions for commit nodes in a circle around the branch with orbiting animation
 */
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

/**
 * CommitNode component renders individual commit nodes that orbit around branch nodes
 */
const CommitNodeComponent: React.FC<CommitNodeProps> = ({
  commit,
  index,
  totalCommits,
  animationTime,
  scale,
  branchPosition,
  scaledRadius,
  scaledCommitRadius,
  textOpacity,
  commitTextOpacity
}) => {
  const commitPos = React.useMemo(() => 
    getCommitNodePosition(index, totalCommits, animationTime),
    [index, totalCommits, animationTime]
  );

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
      {/* Commit node circle - glowing effect */}
      <div
        className="absolute inset-0 rounded-full bg-gray-600 border border-gray-500/50 transition-all duration-200"
        style={{
          boxShadow: '0 0 8px rgba(156, 163, 175, 0.5), inset 0 0 4px rgba(156, 163, 175, 0.3)',
          background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2), rgba(156, 163, 175, 0.8))',
        }}
        title={commit.commit.message}
      />

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
};

// Memoize the component to prevent unnecessary re-renders
export const CommitNode = memo(CommitNodeComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.commit.sha === nextProps.commit.sha &&
    prevProps.index === nextProps.index &&
    prevProps.totalCommits === nextProps.totalCommits &&
    prevProps.animationTime === nextProps.animationTime &&
    prevProps.scale === nextProps.scale &&
    prevProps.scaledRadius === nextProps.scaledRadius &&
    prevProps.scaledCommitRadius === nextProps.scaledCommitRadius &&
    prevProps.textOpacity === nextProps.textOpacity &&
    prevProps.commitTextOpacity === nextProps.commitTextOpacity
  );
});

export default CommitNode;