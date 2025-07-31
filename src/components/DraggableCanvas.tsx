'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasInteraction } from './canvas/hooks/useCanvasInteraction';
import { usePhysicsEngine } from './canvas/hooks/usePhysicsEngine';
import { useGitHubData } from './canvas/hooks/useGitHubData';
import { calculateTreeLayout } from './canvas/utils/layout-calculator';
import { formatDate } from './canvas/utils/date-formatter';
import { usePerformanceMonitor } from './canvas/utils/performance-monitor';
import { ConnectionLine } from './canvas/components/ConnectionLine';
import { CanvasNode } from './canvas/components/CanvasNode';
import { Position } from './canvas/types/canvas';

// Constants
const NODE_RADIUS = 30; // Node radius for branch creation preview

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

// Remove duplicate type definitions - they're now imported from types











interface DraggableCanvasProps {
  owner?: string;
  repo?: string;
  githubToken?: string; // Add support for GitHub token
}

/**
 * DraggableCanvas - Interactive GitHub Repository Visualization
 * 
 * A comprehensive React component that provides an interactive canvas for visualizing
 * GitHub repository data including branches, commits, pull requests, and their relationships.
 * Features include pan/zoom interactions, physics-based animations, and real-time data fetching.
 * 
 * @param props - Configuration options for the canvas
 * @param props.owner - GitHub repository owner (default: "facebook")
 * @param props.repo - GitHub repository name (default: "react")
 * @param props.githubToken - Optional GitHub API token for authenticated requests
 * 
 * @example
 * ```tsx
 * <DraggableCanvas 
 *   owner="facebook" 
 *   repo="react" 
 *   githubToken="your-github-token"
 * />
 * ```
 * 
 * @returns A fully interactive canvas component for GitHub repository visualization
 */
export default function DraggableCanvas({
  owner = "facebook",
  repo = "react",
  githubToken
}: DraggableCanvasProps) {
  // Initialize hooks
  const canvasInteraction = useCanvasInteraction({
    minScale: 0.1,
    maxScale: 5,
    zoomSensitivity: 0.1,
  });

  const physicsEngine = usePhysicsEngine({
    enableCollisions: false,
    enableBounceBack: true,
  });

  const githubData = useGitHubData({
    owner,
    repo,
    githubToken,
  });

  // Performance monitoring
  const performanceMonitor = usePerformanceMonitor();

  // Start performance monitoring on mount
  useEffect(() => {
    performanceMonitor.startMonitoring();
    return () => {
      performanceMonitor.stopMonitoring();
    };
  }, [performanceMonitor]);

  // Layout and UI state
  const LAYOUT_OPTIONS = [
    { value: 'horizontal', label: 'Horizontal Tree' },
    { value: 'vertical', label: 'Vertical Tree' },
    { value: 'radial', label: 'Radial' },
  ];
  const [layoutAlignment, setLayoutAlignment] = useState<'horizontal' | 'vertical' | 'radial'>('horizontal');
  const [showTreeView, setShowTreeView] = useState<boolean>(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showMergedBranches, setShowMergedBranches] = useState<boolean>(true);
  
  // Drag and drop state
  const [dragTargetBranch, setDragTargetBranch] = useState<string | null>(null);
  const dragTargetRef = useRef<string | null>(null);

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
  const [showIssuesContainer, setShowIssuesContainer] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'prs' | 'issues'>('prs');

  // Branch creation drag state
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [branchCreationStart, setBranchCreationStart] = useState<{ branchName: string; position: Position } | null>(null);
  const [branchCreationMousePos, setBranchCreationMousePos] = useState<Position>({ x: 0, y: 0 });

  // Extract data and methods from hooks
  const { 
    scale, 
    offset, 
    isSpacePressed,
    isPanning,
    canvasRef, 
    handleCanvasMouseDown,
    screenToWorldCoords,
    mouseToWorldCoords,
    setScale,
    setOffset
  } = canvasInteraction;
  
  const { 
    cardPhysics, 
    animationTime, 
    getDistance,
    setCardPhysics,
    startDrag,
    updateDrag,
    endDrag,
    initializeCard,
    updateCardPhysics
  } = physicsEngine;
  
  const {
    data: {
      branches,
      pullRequests,
      issues,
      collaborators,
      connections,
      defaultBranch
    },
    loading: {
      isLoading: loading,
      progress: loadingProgress,
      loadingCommits
    },
    error: {
      error
    },
    fetchBranchCommits,
    createPullRequest: createPullRequestHook,
    createBranch: createBranchHook
  } = githubData;

  // Initialize physics positions when branches are loaded
  useEffect(() => {
    if (branches.length > 0) {
      // Calculate tree layout positions
      const treePositions = calculateTreeLayout(branches, 1200, 800, layoutAlignment);

      // Initialize physics with tree layout
      branches.forEach((branch) => {
        const position = treePositions[branch.name] || { x: 100, y: 100 };
        // Only initialize if the card doesn't exist yet
        setCardPhysics(prev => {
          if (!prev[branch.name]) {
            return {
              ...prev,
              [branch.name]: {
                position,
                velocity: { x: 0, y: 0 },
                isDragging: false,
                isExpanded: false,
                isLoadingCommits: false,
                isDragTarget: false,
                animationTime: 0
              }
            };
          }
          return prev;
        });
      });
    }
  }, [branches, layoutAlignment, setCardPhysics]);

  // Data is now managed by the GitHub data hook - no manual fetching needed

  // Use the hook method for fetching commits
  const fetchCommitsForBranch = fetchBranchCommits;

  const handleStartDrag = (id: string, position: Position) => {
    startDrag(id, position);
  };

  const handleDrag = (id: string, position: Position) => {
    // Use the physics engine hook method
    updateDrag(id, position);

    // Check if we're dragging over another branch
    let newDragTarget: string | null = null;
    const dragThreshold = (30 * 1.5) / scale; // Slightly larger threshold for drag detection (30 is collision radius)

    Object.entries(cardPhysics).forEach(([branchId, physics]) => {
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
  };

  const handleEndDrag = (id: string) => {
    // Use ref for immediate access to the current drag target
    const targetBranch = dragTargetRef.current;
    let returnToPosition = undefined;

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
      // Set return position for bounce back
      const currentCard = cardPhysics[id];
      if (currentCard?.originalPosition) {
        returnToPosition = currentCard.originalPosition;
      }
    }

    setDragTargetBranch(null); // Clear drag target
    dragTargetRef.current = null; // Clear ref
    
    // Use the physics engine hook method
    endDrag(id, returnToPosition);
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

  // Create a pull request using the hook
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

      // Use the hook method to create the pull request
      await createPullRequestHook({
        title: prDetails.title.trim(),
        body: prDetails.body.trim() || undefined,
        head: prDetails.sourceBranch,
        base: prDetails.targetBranch,
        draft: false
      });

      // Close the PR container and reset form
      setShowPRContainer(false);
      setPRDetails({
        sourceBranch: '',
        targetBranch: '',
        title: '',
        body: ''
      });

    } catch (error) {
      console.error('Error creating pull request:', error);
      setPRError(error instanceof Error ? error.message : 'Failed to create pull request');
    } finally {
      setIsCreatingPR(false);
      setIsValidatingBranches(false);
    }
  };

  // Create a new branch using the hook
  const createBranch = async () => {
    setIsCreatingNewBranch(true);
    setBranchCreationError(null);

    try {
      // Get the SHA of the source branch
      const sourceBranch = branches.find(b => b.name === newBranchDetails.sourceBranch);
      if (!sourceBranch) {
        throw new Error('Source branch not found');
      }

      // Use the hook method to create the branch
      await createBranchHook(newBranchDetails.branchName, sourceBranch.commit.sha);

      // Close form and reset
      setShowBranchCreationForm(false);
      setNewBranchDetails({
        sourceBranch: '',
        branchName: ''
      });

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

  // Track render performance
  useEffect(() => {
    performanceMonitor.startRender();
    const nodeCount = branches.filter(branch => showMergedBranches || branch.aheadBy !== 0).length;
    const connectionCount = connections.filter(connection => {
      const fromBranch = branches.find(b => b.name === connection.from);
      const toBranch = branches.find(b => b.name === connection.to);
      return (showMergedBranches || fromBranch?.aheadBy !== 0) &&
        (showMergedBranches || toBranch?.aheadBy !== 0);
    }).length;
    
    performanceMonitor.endRender(nodeCount, connectionCount);
  });

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
      onMouseDown={handleCanvasMouseDown}
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
            <CanvasNode
              key={branch.name}
              id={branch.name}
              branch={branch}
              position={physics.position}
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
              Object.keys(cardPhysics).forEach(branchName => {
                const position = treePositions[branchName];
                if (position) {
                  updateCardPhysics(branchName, {
                    position,
                    velocity: { x: 0, y: 0 }
                  });
                }
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
              Object.keys(cardPhysics).forEach(branchName => {
                const position = treePositions[branchName];
                if (position) {
                  updateCardPhysics(branchName, {
                    position,
                    velocity: { x: 0, y: 0 }
                  });
                }
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
                  {false ? (
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