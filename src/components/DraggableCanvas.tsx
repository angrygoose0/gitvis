'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

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
  isMerged?: boolean; // Added merged status
  mergedAt?: string; // Added merge date
  commits?: Array<{
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        date: string;
      };
    };
  }>; // Added commits array
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

// Helper function to format dates
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minutes ago`;
    }
    return `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 30) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
};

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
  onStartDrag,
  onDrag,
  onEndDrag,
  onDoubleClick
}) => {
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);

  // Calculate screen position from world position
  const screenPosition = {
    x: position.x * scale + offset.x,
    y: position.y * scale + offset.y
  };

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
    if (branch.isMerged) return 'bg-gray-700';
    if (branch.depth === 0) return 'bg-green-400';
    if (branch.depth === 1) return 'bg-blue-400';
    return 'bg-purple-400';
  };

  const getNodeGlowColor = () => {
    if (isDragTarget) return 'rgba(251, 146, 60, 0.9)'; // Orange glow when drag target
    if (branch.isMerged) return 'rgba(156, 163, 175, 0.6)';
    if (branch.depth === 0) return 'rgba(74, 222, 128, 0.8)';
    if (branch.depth === 1) return 'rgba(96, 165, 250, 0.8)';
    return 'rgba(196, 181, 253, 0.8)';
  };

  const getNodeBorderColor = () => {
    if (isDragTarget) return 'border-orange-300/80'; // Orange border when drag target
    if (isDragging) return 'border-white/50';
    if (branch.isMerged) return 'border-gray-600';
    if (branch.depth === 0) return 'border-green-300/50';
    if (branch.depth === 1) return 'border-blue-300/50';
    return 'border-purple-300/50';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging node if space is NOT pressed
    if (!isSpacePressed) {
      e.stopPropagation(); // Prevent canvas pan
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
          const worldPosition = {
            x: (moveEvent.clientX - dragOffset.x - offset.x) / scale,
            y: (moveEvent.clientY - dragOffset.y - offset.y) / scale
          };
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
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDoubleClick) {
      onDoubleClick(id);
    }
  };

  // Calculate positions for commit nodes in a circle around the branch
  const getCommitNodePosition = (index: number, total: number) => {
    const angleStep = (2 * Math.PI) / total;
    const angle = angleStep * index - Math.PI / 2; // Start from top
    const distance = 60; // Distance from branch center
    
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
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
    >
      {/* Node circle */}
      <div
        className={`absolute inset-0 rounded-full ${getNodeColor()} ${getNodeBorderColor()} border transition-all duration-200 ${
          branch.isMerged ? 'opacity-40' : ''
        }`}
        style={{
          boxShadow: isDragTarget 
            ? `0 0 40px ${getNodeGlowColor()}, 0 0 80px ${getNodeGlowColor()}, inset 0 0 30px ${getNodeGlowColor()}` // Bigger glow for drag target
            : isDragging 
            ? `0 0 30px ${getNodeGlowColor()}, 0 0 60px ${getNodeGlowColor()}, inset 0 0 20px ${getNodeGlowColor()}`
            : `0 0 20px ${getNodeGlowColor()}, 0 0 40px ${getNodeGlowColor()}, inset 0 0 15px ${getNodeGlowColor()}`,
          transform: isDragTarget ? 'scale(1.5)' : isDragging ? 'scale(1.3)' : 'scale(1)', // Bigger scale for drag target
          background: `radial-gradient(circle at 30% 30%, ${
            branch.isMerged ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)'
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
              {branch.isMerged && (
                <p className="text-xs text-gray-500">Merged</p>
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
            const commitPos = getCommitNodePosition(index, Math.min(branch.commits?.length || 0, 8));
            
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
                <svg
                  className="absolute"
                  style={{
                    left: `${scaledCommitRadius}px`,
                    top: `${scaledCommitRadius}px`,
                    width: `${Math.abs(commitPos.x * scale)}px`,
                    height: `${Math.abs(commitPos.y * scale)}px`,
                    transform: `translate(${commitPos.x * scale < 0 ? commitPos.x * scale : 0}px, ${commitPos.y * scale < 0 ? commitPos.y * scale : 0}px)`,
                    pointerEvents: 'none',
                  }}
                >
                  <line
                    x1={commitPos.x * scale < 0 ? Math.abs(commitPos.x * scale) : 0}
                    y1={commitPos.y * scale < 0 ? Math.abs(commitPos.y * scale) : 0}
                    x2={commitPos.x * scale < 0 ? 0 : Math.abs(commitPos.x * scale)}
                    y2={commitPos.y * scale < 0 ? 0 : Math.abs(commitPos.y * scale)}
                    stroke="rgba(156, 163, 175, 0.3)"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                </svg>
                
                {/* Commit node circle - also made glowing */}
                <div
                  className="absolute inset-0 rounded-full bg-gray-600 border border-gray-500/50 transition-all duration-200"
                  style={{
                    boxShadow: '0 0 8px rgba(156, 163, 175, 0.5), inset 0 0 4px rgba(156, 163, 175, 0.3)',
                    background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2), rgba(156, 163, 175, 0.8))',
                  }}
                  title={commit.commit.message}
                >
                  {/* Show first letter of commit message or hash */}
                  <div className="flex items-center justify-center h-full text-xs text-gray-200 font-mono"
                       style={{ fontSize: `${Math.max(8, 10 * scale)}px` }}>
                    {commit.sha.substring(0, 2)}
                  </div>
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

// Helper function to calculate branch relationships
const calculateBranchTree = async (
  branches: Branch[],
  owner: string,
  repo: string,
  defaultBranch: string,
  headers: HeadersInit,
  existingRelationships: Record<string, string> = {}
): Promise<{ branches: Branch[], connections: BranchConnection[] }> => {
  const branchMap = new Map<string, Branch>();
  const connections: BranchConnection[] = [];
  
  // Initialize branch map
  branches.forEach(branch => {
    branchMap.set(branch.name, { ...branch, children: [] });
  });

  // Set default branch as root
  const rootBranch = branchMap.get(defaultBranch);
  if (rootBranch) {
    rootBranch.depth = 0;
  }

  const updatedBranches = Array.from(branchMap.values());
  
  try {
    // Create a map to store branch relationships
    const branchRelationships = new Map<string, string>(); // child -> parent
    const mergedBranches = new Map<string, { mergedInto: string, aheadBy: number }>(); // Track merged branches with details
    
    // First pass: Identify all merged branches
    for (const branch of updatedBranches) {
      if (branch.name === defaultBranch) continue;
      
      // Check if branch is merged into default branch
      try {
        const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${defaultBranch}...${branch.name}`;
        const response = await fetch(compareUrl, { headers });
        
        if (response.ok) {
          const compareData = await response.json();
          if (compareData.ahead_by === 0 && compareData.behind_by >= 0) {
            mergedBranches.set(branch.name, { mergedInto: defaultBranch, aheadBy: 0 });
          }
        }
      } catch (error) {
        console.warn(`Error comparing ${branch.name} with ${defaultBranch}:`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit delay
    }
    
    // Sort branches by name to ensure consistent ordering
    const sortedBranches = updatedBranches
      .filter(b => b.name !== defaultBranch)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Second pass: Determine parent-child relationships
    for (const branch of sortedBranches) {
      // Check if we have an existing relationship for this branch
      if (existingRelationships[branch.name]) {
        // Verify the parent still exists
        const existingParent = existingRelationships[branch.name];
        if (updatedBranches.some(b => b.name === existingParent)) {
          branchRelationships.set(branch.name, existingParent);
          
          // Mark branch as merged if detected
          const branchToUpdate = branchMap.get(branch.name);
          if (branchToUpdate && mergedBranches.has(branch.name)) {
            branchToUpdate.isMerged = true;
          }
          continue; // Skip to next branch
        }
      }
      
      let bestParent = defaultBranch;
      let bestScore = -Infinity;
      let shortestDistance = Infinity;
      
      // Skip if this branch is already identified as merged
      const mergedInfo = mergedBranches.get(branch.name);
      
      // Compare with all potential parent branches
      const potentialParents = updatedBranches.filter(b => 
        b.name !== branch.name && 
        !mergedBranches.has(b.name) // Don't use merged branches as parents
      );
      
      for (const candidate of potentialParents) {
        try {
          const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${candidate.name}...${branch.name}`;
          const response = await fetch(compareUrl, { headers });
          
          if (response.ok) {
            const compareData = await response.json();
            
            // If branch is ahead and not behind, it's a potential child
            if (compareData.ahead_by > 0 && compareData.behind_by === 0) {
              // Prefer parents with fewer commits between (shorter distance)
              if (compareData.ahead_by < shortestDistance) {
                shortestDistance = compareData.ahead_by;
                bestParent = candidate.name;
                bestScore = -compareData.ahead_by;
              }
            } else if (compareData.ahead_by === 0 && compareData.behind_by >= 0 && !mergedInfo) {
              // Branch is fully merged into this candidate
              mergedBranches.set(branch.name, { mergedInto: candidate.name, aheadBy: 0 });
              bestParent = candidate.name;
              break;
            }
          }
        } catch (error) {
          console.warn(`Error comparing ${branch.name} with ${candidate.name}:`, error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit delay
      }
      
      // Set the parent relationship
      branchRelationships.set(branch.name, bestParent);
      
      // Mark branch as merged if detected
      const branchToUpdate = branchMap.get(branch.name);
      if (branchToUpdate && mergedBranches.has(branch.name)) {
        branchToUpdate.isMerged = true;
      }
    }
    
    // Build the tree structure based on relationships
    updatedBranches.forEach(branch => {
      if (branch.name === defaultBranch) return;
      
      const parent = branchRelationships.get(branch.name) || defaultBranch;
      branch.parent = parent;
      
      // Calculate depth
      let depth = 1;
      let currentParent: string | undefined = parent;
      const visited = new Set<string>(); // Prevent infinite loops
      
      while (currentParent && currentParent !== defaultBranch && !visited.has(currentParent)) {
        visited.add(currentParent);
        depth++;
        currentParent = branchRelationships.get(currentParent);
      }
      branch.depth = Math.min(depth, 5); // Cap depth at 5 for visualization
      
      // Get commit count for this connection (will be calculated later when commits are fetched)
      connections.push({ 
        from: branch.name,  // Changed: from child
        to: parent,         // Changed: to parent
        commitCount: 0 // Will be updated when commits are fetched
      });
      
      // Update parent's children
      const parentBranch = branchMap.get(parent);
      if (parentBranch) {
        parentBranch.children = parentBranch.children || [];
        parentBranch.children.push(branch.name);
      }
    });
    
  } catch (error) {
    console.error('Error analyzing branch relationships:', error);
    
    // Fallback: Simple heuristic based on branch names
    const fallbackPatterns = {
      develop: /^(develop|dev|development)$/i,
      feature: /^(feature|feat)\//i,
      bugfix: /^(bugfix|fix|hotfix)\//i,
      release: /^(release|rel)\//i,
    };
    
    updatedBranches.forEach(branch => {
      if (branch.name === defaultBranch) return;
      
      let parent = defaultBranch;
      let depth = 1;
      
      // Check if there's a develop branch and this might branch from it
      const developBranch = updatedBranches.find(b => fallbackPatterns.develop.test(b.name));
      if (developBranch && (fallbackPatterns.feature.test(branch.name) || fallbackPatterns.bugfix.test(branch.name))) {
        parent = developBranch.name;
        depth = 2;
      }
      
      branch.parent = parent;
      branch.depth = depth;
      connections.push({ from: parent, to: branch.name });
      
      const parentBranch = branchMap.get(parent);
      if (parentBranch) {
        parentBranch.children = parentBranch.children || [];
        parentBranch.children.push(branch.name);
      }
    });
  }

  return { branches: updatedBranches, connections };
};

// Helper function to calculate tree layout positions
const calculateTreeLayout = (
  branches: Branch[],
  canvasWidth: number = 1200,
  canvasHeight: number = 800
): Record<string, Position> => {
  const positions: Record<string, Position> = {};
  const horizontalSpacing = 200; // Reduced spacing for smaller nodes
  const verticalSpacing = 150; // Reduced spacing for smaller nodes
  const startX = 100;
  const startY = 100;

  // Group branches by depth
  const branchesByDepth = new Map<number, Branch[]>();
  branches.forEach(branch => {
    const depth = branch.depth || 0;
    if (!branchesByDepth.has(depth)) {
      branchesByDepth.set(depth, []);
    }
    branchesByDepth.get(depth)?.push(branch);
  });

  // Position branches level by level
  branchesByDepth.forEach((branchesAtDepth, depth) => {
    const y = startY + depth * verticalSpacing;
    const totalWidth = (branchesAtDepth.length - 1) * horizontalSpacing;
    const startXForDepth = (canvasWidth - totalWidth) / 2;

    branchesAtDepth.forEach((branch, index) => {
      const x = startXForDepth + index * horizontalSpacing;
      positions[branch.name] = { x, y };
    });
  });

  return positions;
};

// Component to draw connection lines between branches
interface ConnectionLineProps {
  from: Position;
  to: Position;
  scale: number;
  offset: Position;
  isMerged?: boolean;
  pullRequest?: PullRequest;
  commitCount?: number; // Number of commits this connection represents
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ from, to, scale, offset, isMerged, pullRequest, commitCount = 1 }) => {
  // Calculate screen positions (center of nodes)
  const fromScreen = {
    x: from.x * scale + offset.x,
    y: from.y * scale + offset.y
  };
  
  const toScreen = {
    x: to.x * scale + offset.x,
    y: to.y * scale + offset.y
  };

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
      if (pullRequest.draft) return "156, 163, 175"; // Gray for draft
      if (pullRequest.mergeable_state === 'blocked') return "239, 68, 68"; // Red for blocked
      return "34, 197, 94"; // Green for active PR
    }
    return isMerged ? "156, 163, 175" : "99, 102, 241";
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
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
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
        stroke={pullRequest ? `url(#pr-pulse-${pullRequest.id})` : `url(#line-gradient-${from.x}-${from.y}-${to.x}-${to.y})`}
        strokeWidth={pullRequest ? 2 : 1.5}
        strokeLinecap="round"
        opacity={isMerged ? 0.4 : 0.8}
      />
      
      {/* Animated energy pulses for active connections - one per commit */}
      {!isMerged && commitCount > 0 && (
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
      {commitCount > 1 && !pullRequest && (
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
}

export default function DraggableCanvas({ 
  owner = "facebook", 
  repo = "react", 
  githubToken 
}: DraggableCanvasProps) {
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

  // PR creation modal state
  const [showPRModal, setShowPRModal] = useState(false);
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

      // Update positions based on velocity
      cardIds.forEach(id => {
        const card = newPhysics[id];
        if (!card.isDragging) {
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
      });

      // Removed all collision detection and pushing logic

      return newPhysics;
    });

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
          const treePositions = calculateTreeLayout(treeBranches);
          
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
        const treePositions = calculateTreeLayout(treeBranches);
        
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
  }, [owner, repo, githubToken]);

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
        
        // Update connections with pull request information
        setConnections(prevConnections => {
          const updatedConnections = [...prevConnections];
          
          // Create a map of PR connections for quick lookup
          const prConnectionMap = new Map<string, PullRequest>();
          
          pullRequestsData.forEach(pr => {
            const key = `${pr.head.ref}-${pr.base.ref}`;
            prConnectionMap.set(key, pr);
          });
          
          // Update existing connections with PR data
          return updatedConnections.map(connection => {
            const key = `${connection.from}-${connection.to}`;
            const pr = prConnectionMap.get(key);
            
            if (pr) {
              // If we don't have a commit count or it's 0, try to fetch it
              if (!connection.commitCount || connection.commitCount === 0) {
                // We'll update this async after the map
                return { ...connection, pullRequest: pr, needsCommitCount: true, prNumber: pr.number };
              }
              return { ...connection, pullRequest: pr };
            }
            return connection;
          });
        });
        
        // Fetch commit counts for connections that need them
        const connectionsNeedingCounts = connections.filter((c: any) => c.needsCommitCount);
        if (connectionsNeedingCounts.length > 0) {
          for (const conn of connectionsNeedingCounts) {
            try {
              const prCommitsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${(conn as any).prNumber}/commits`;
              const commitsResponse = await fetch(prCommitsUrl, { headers });
              
              if (commitsResponse.ok) {
                const commitsData = await commitsResponse.json();
                const commitCount = Math.min(commitsData.length, 5); // Cap at 5 for performance
                
                // Update the connection with the commit count
                setConnections(prev => prev.map(c => 
                  (c.from === conn.from && c.to === conn.to) 
                    ? { ...c, commitCount, needsCommitCount: undefined, prNumber: undefined } 
                    : c
                ));
              }
            } catch (error) {
              console.warn(`Could not get commit count for PR #${(conn as any).prNumber}`);
            }
          }
        }
        
        // Add new connections for PRs that don't have existing branch relationships
        const existingConnectionKeys = new Set(
          connections.map(c => `${c.from}-${c.to}`)
        );
        
        const newConnections: BranchConnection[] = [];
        
        // Fetch commit counts for PR branches
        for (const pr of pullRequestsData) {
          const key = `${pr.head.ref}-${pr.base.ref}`;
          
          // Check if both branches exist and connection doesn't already exist
          const headBranchExists = branches.some(b => b.name === pr.head.ref);
          const baseBranchExists = branches.some(b => b.name === pr.base.ref);
          
          if (headBranchExists && baseBranchExists && !existingConnectionKeys.has(key)) {
            // Try to get commit count from the PR
            let commitCount = 1;
            try {
              // Get the branch's commits if available
              const headBranch = branches.find(b => b.name === pr.head.ref);
              if (headBranch?.commits) {
                commitCount = headBranch.commits.length;
              } else {
                // Fetch commit count from GitHub API for this PR
                const prCommitsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/commits`;
                const commitsResponse = await fetch(prCommitsUrl, { headers });
                
                if (commitsResponse.ok) {
                  const commitsData = await commitsResponse.json();
                  commitCount = Math.min(commitsData.length, 5); // Cap at 5 for performance
                }
              }
            } catch (error) {
              console.warn(`Could not get commit count for PR #${pr.number}`);
            }
            
            newConnections.push({
              from: pr.head.ref,
              to: pr.base.ref,
              pullRequest: pr,
              commitCount
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

  // Fetch collaborators when component mounts
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
        
        // Update the branch with commits
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
      
      // Update the branch with unique commits
      setBranches(prevBranches => 
        prevBranches.map(b => 
          b.name === branchName 
            ? { ...b, commits: sortedUniqueCommits.slice(0, 10) } 
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
        velocity: { x: 0, y: 0 }
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
    
    if (targetBranch) {
      console.log(`Dropped branch "${id}" onto branch "${targetBranch}"`);
      
      // Show PR creation modal
      setPRDetails({
        sourceBranch: id,
        targetBranch: targetBranch,
        title: `Merge ${id} into ${targetBranch}`,
        body: ''
      });
      setShowPRModal(true);
      setPRError(null);
    }
    
    setDraggingBranch(null); // Clear dragging branch
    setDragTargetBranch(null); // Clear drag target
    dragTargetRef.current = null; // Clear ref
    setCardPhysics(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        isDragging: false,
        lastDragPosition: undefined
      }
    }));
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

  // Create a pull request
  const createPullRequest = async () => {
    setIsCreatingPR(true);
    setPRError(null);
    
    try {
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      };
      
      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
      }
      
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: prDetails.title,
          body: prDetails.body,
          head: prDetails.sourceBranch,
          base: prDetails.targetBranch,
          draft: false
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to create PR: ${response.status}`);
      }
      
      const prData = await response.json();
      console.log('Pull request created:', prData);
      
      // Close modal and refresh PR list
      setShowPRModal(false);
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
          let commitCount = 1;
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
    }
  };

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
      className={`relative w-full h-screen bg-[#000d1a] overflow-hidden ${
        isPanning ? 'cursor-grabbing' : (isSpacePressed ? 'cursor-grab' : 'cursor-default')
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
          {branches.filter(b => b.isMerged).length > 0 && (
            <span className="text-gray-500">
              {' '}• {branches.filter(b => b.isMerged).length} merged
            </span>
          )}
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
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
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
      {showTreeView && connections.map((connection, index) => {
        const fromPhysics = cardPhysics[connection.from];
        const toPhysics = cardPhysics[connection.to];
        const fromBranch = branches.find(b => b.name === connection.from);  // Changed: check fromBranch for merged status
        
        if (!fromPhysics || !toPhysics) return null;
        if (!showMergedBranches && fromBranch?.isMerged) return null;  // Changed: check fromBranch
        
        return (
          <ConnectionLine
            key={`${connection.from}-${connection.to}-${index}`}
            from={fromPhysics.position}
            to={toPhysics.position}
            scale={scale}
            offset={offset}
            isMerged={fromBranch?.isMerged}  // Changed: use fromBranch
            pullRequest={connection.pullRequest}
            commitCount={connection.commitCount || 1}
          />
        );
      })}
      
      {/* Draggable Branch Cards */}
      {branches.map((branch) => {
        const physics = cardPhysics[branch.name];
        if (!physics) return null;
        if (!showMergedBranches && branch.isMerged) return null;

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
              onStartDrag={handleStartDrag}
              onDrag={handleDrag}
              onEndDrag={handleEndDrag}
              onDoubleClick={handleDoubleClick}
            />
          </div>
        );
      })}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-sm text-gray-500 pointer-events-none">
        Drag cards to move them • Double-click to view commits • Hold Space + drag to navigate • Scroll to zoom
      </div>

      {/* View controls */}
      <div className="absolute bottom-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setShowMergedBranches(!showMergedBranches)}
          className={`bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-lg text-sm hover:bg-gray-700/80 transition-colors pointer-events-auto flex items-center gap-2 ${
            showMergedBranches ? 'text-gray-300' : 'text-gray-500'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
              showMergedBranches 
                ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            } />
          </svg>
          {showMergedBranches ? 'Hide Merged' : 'Show Merged'}
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
              const treePositions = calculateTreeLayout(branches);
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
      </div>

      {/* PR Creation Modal */}
      {showPRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isCreatingPR && setShowPRModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 p-6 max-w-lg w-full shadow-2xl"
               style={{
                 boxShadow: '0 0 50px rgba(59, 130, 246, 0.15), 0 0 100px rgba(59, 130, 246, 0.1)'
               }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Create Pull Request</h2>
              <button
                onClick={() => !isCreatingPR && setShowPRModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={isCreatingPR}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Branch info */}
            <div className="mb-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">From:</span>
                <span className="text-blue-400 font-mono">{prDetails.sourceBranch}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="text-gray-400">Into:</span>
                <span className="text-green-400 font-mono">{prDetails.targetBranch}</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={(e) => { e.preventDefault(); createPullRequest(); }}>
              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={prDetails.title}
                  onChange={(e) => setPRDetails(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                  placeholder="Add a title"
                  required
                  disabled={isCreatingPR}
                />
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={prDetails.body}
                  onChange={(e) => setPRDetails(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors resize-none custom-scrollbar"
                  placeholder="Add a description (optional)"
                  rows={4}
                  disabled={isCreatingPR}
                />
              </div>

              {/* Error message */}
              {prError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
                  <p className="text-sm text-red-400">{prError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPRModal(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  disabled={isCreatingPR}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPR || !prDetails.title}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium"
                  style={{
                    boxShadow: !isCreatingPR && prDetails.title ? '0 0 20px rgba(59, 130, 246, 0.4)' : 'none'
                  }}
                >
                  {isCreatingPR ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Pull Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 