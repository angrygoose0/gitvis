# Canvas Component System Documentation

## Overview

The Canvas Component System is a comprehensive React-based visualization framework for GitHub repository data. It provides an interactive, draggable canvas for visualizing branches, commits, pull requests, and their relationships with real-time physics animations and GitHub API integration.

## Recent Fixes (Latest Update)

### Branch Node Dragging Issues Resolved

**Problem**: Users reported that branch nodes could not be dragged and moved around anymore.

**Root Causes Identified**:
1. **Missing `data-node-id` attribute**: The canvas interaction hook was checking for `data-node-id` attribute to avoid panning when clicking on nodes, but the CanvasNode component wasn't setting this attribute.
2. **Event propagation conflicts**: Potential conflicts between canvas panning and node dragging event handlers.
3. **Coordinate transformation issues**: The drag offset was not being properly captured and used in the mouse move handler.

**Fixes Applied**:
1. **Added `data-node-id` attribute** to CanvasNode component for proper event detection
2. **Fixed drag offset handling** in CanvasNode mouse event handlers to use captured values
3. **Improved event propagation** by ensuring `stopPropagation()` is called in node mouse down handlers
4. **Enhanced z-index management** for dragging nodes to ensure they appear on top
5. **Removed redundant wrapper div** around CanvasNode components that was interfering with event handling
6. **Fixed stale closure issues** in physics engine hooks by removing dependencies on `cardPhysics` state
7. **Prevented physics initialization interference** by removing `cardPhysics` dependency from initialization useEffect
8. **Updated physics engine methods** to use state updater functions instead of relying on stale state

**Key Technical Fixes**:
- **Physics Engine**: Fixed `startDrag` and `updateDrag` methods to use `setCardPhysics(prev => ...)` pattern instead of relying on `cardPhysics` in dependencies
- **Initialization**: Modified physics initialization to only run when branches change, not when physics state updates
- **Event Handling**: Ensured proper event propagation and coordinate transformation

**Verification**: 
- Component integration tests for drag interactions are now passing ✅
- Coordinate transformation functions verified to work correctly ✅
- Event handling conflicts resolved between canvas panning and node dragging ✅
- Physics engine state updates working correctly without stale closures ✅

## Architecture

The system follows a modular architecture with clear separation of concerns:

```
src/components/canvas/
├── components/          # React components
├── hooks/              # Custom React hooks
├── services/           # External API and business logic
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── __tests__/          # Integration tests
```

## Core Components

### 1. DraggableCanvas (Main Component)

**Location**: `src/components/DraggableCanvas.tsx`

**Purpose**: The primary orchestrating component that combines all hooks and renders the interactive canvas.

**Key Features**:
- Pan and zoom interactions with space key navigation
- Real-time GitHub data visualization
- Drag-and-drop branch interactions
- Pull request creation workflow
- Branch creation workflow
- Physics-based animations

**Props**:
```typescript
interface DraggableCanvasProps {
  owner?: string;        // GitHub repository owner (default: "facebook")
  repo?: string;         // GitHub repository name (default: "react")
  githubToken?: string;  // Optional GitHub API token for authenticated requests
}
```

**Usage**:
```tsx
<DraggableCanvas 
  owner="facebook" 
  repo="react" 
  githubToken="your-github-token"
/>
```

**When to Use**: This is the main entry point for the canvas system. Use when you need a complete GitHub repository visualization with all interactive features.

### 2. CanvasNode Component

**Location**: `src/components/canvas/components/CanvasNode.tsx`

**Purpose**: Renders individual branch nodes with interactive capabilities and commit visualization.

**Key Features**:
- Draggable branch nodes with physics integration
- Visual styling based on branch status (ahead/behind, protected, etc.)
- Expandable commit display with orbital animations
- Right-click branch creation
- Hover and drag target highlighting

**Props**:
```typescript
interface CanvasNodeProps {
  id: string;                    // Unique identifier for the branch
  branch: Branch;                // Branch data from GitHub API
  position: Position;            // World coordinates position
  isDragging: boolean;           // Current drag state
  scale: number;                 // Canvas zoom level
  offset: Position;              // Canvas pan offset
  isSpacePressed: boolean;       // Space key state for navigation
  isExpanded: boolean;           // Whether commits are visible
  isLoadingCommits: boolean;     // Loading state for commits
  isDragTarget: boolean;         // Whether this node is a drop target
  animationTime: number;         // Animation time for orbital effects
  onStartDrag: (id: string, position: Position) => void;
  onDrag: (id: string, position: Position) => void;
  onEndDrag: (id: string) => void;
  onDoubleClick?: (id: string) => void;
}
```

**Usage**:
```tsx
<CanvasNode
  id="feature-branch"
  branch={branchData}
  position={{ x: 100, y: 100 }}
  isDragging={false}
  scale={1}
  offset={{ x: 0, y: 0 }}
  isSpacePressed={false}
  isExpanded={false}
  isLoadingCommits={false}
  isDragTarget={false}
  animationTime={1000}
  onStartDrag={handleStartDrag}
  onDrag={handleDrag}
  onEndDrag={handleEndDrag}
  onDoubleClick={handleDoubleClick}
/>
```

**When to Use**: Use when building custom canvas implementations or when you need individual branch node rendering with full interaction capabilities.

### 3. ConnectionLine Component

**Location**: `src/components/canvas/components/ConnectionLine.tsx`

**Purpose**: Renders animated connection lines between branch nodes, showing relationships and pull request status.

**Key Features**:
- Animated connection lines with energy pulses
- Pull request status visualization
- Commit count indicators
- Glowing effects and gradients
- Responsive to canvas transformations

**Props**:
```typescript
interface ConnectionLineProps {
  from: Position;           // Start position in world coordinates
  to: Position;             // End position in world coordinates
  scale: number;            // Canvas zoom level
  offset: Position;         // Canvas pan offset
  pullRequest?: PullRequest; // Optional PR data for styling
  commitCount?: number;     // Number of commits for animation
}
```

**Usage**:
```tsx
<ConnectionLine
  from={{ x: 100, y: 100 }}
  to={{ x: 300, y: 200 }}
  scale={1}
  offset={{ x: 0, y: 0 }}
  pullRequest={prData}
  commitCount={3}
/>
```

**When to Use**: Use when you need to visualize relationships between nodes or when building custom connection visualizations.

### 4. CommitNode Component

**Location**: `src/components/canvas/components/CommitNode.tsx`

**Purpose**: Renders individual commit nodes that orbit around branch nodes with detailed commit information.

**Key Features**:
- Orbital animation around parent branch
- Commit message and author display
- Responsive text based on zoom level
- Glowing visual effects
- Tooltip information

**Props**:
```typescript
interface CommitNodeProps {
  commit: {
    sha: string;
    commit: {
      message: string;
      author: { name: string; date: string; };
    };
  };
  index: number;              // Position in orbit
  totalCommits: number;       // Total commits for spacing
  animationTime: number;      // Animation time for orbital motion
  scale: number;              // Canvas zoom level
  branchPosition: Position;   // Parent branch position
  scaledRadius: number;       // Scaled branch radius
  scaledCommitRadius: number; // Scaled commit radius
  textOpacity: number;        // Text visibility based on zoom
  commitTextOpacity: number;  // Commit text visibility
}
```

**Usage**:
```tsx
<CommitNode
  commit={commitData}
  index={0}
  totalCommits={5}
  animationTime={1000}
  scale={1}
  branchPosition={{ x: 100, y: 100 }}
  scaledRadius={30}
  scaledCommitRadius={12}
  textOpacity={1}
  commitTextOpacity={0.8}
/>
```

**When to Use**: Use when displaying commit details around branch nodes or when building custom commit visualizations.

## Core Hooks

### 1. useCanvasInteraction Hook

**Location**: `src/components/canvas/hooks/useCanvasInteraction.ts`

**Purpose**: Manages canvas pan, zoom, and coordinate transformation operations.

**Key Features**:
- Pan and zoom with mouse/keyboard
- Coordinate system transformations
- Space key navigation mode
- Zoom-to-fit functionality
- Configurable interaction limits

**Configuration**:
```typescript
interface CanvasInteractionConfig {
  minScale?: number;        // Minimum zoom level (default: 0.1)
  maxScale?: number;        // Maximum zoom level (default: 5)
  zoomSensitivity?: number; // Zoom speed (default: 0.1)
  enablePanning?: boolean;  // Enable pan interactions (default: true)
  enableZooming?: boolean;  // Enable zoom interactions (default: true)
}
```

**Usage**:
```typescript
const canvasInteraction = useCanvasInteraction({
  minScale: 0.1,
  maxScale: 5,
  zoomSensitivity: 0.1,
});

const { 
  scale, 
  offset, 
  isPanning,
  isSpacePressed,
  handleCanvasMouseDown,
  screenToWorldCoords,
  mouseToWorldCoords,
  canvasRef 
} = canvasInteraction;
```

**When to Use**: Use when you need canvas interaction capabilities in custom implementations or when building alternative canvas interfaces.

### 2. usePhysicsEngine Hook

**Location**: `src/components/canvas/hooks/usePhysicsEngine.ts`

**Purpose**: Manages node physics, animations, and positioning with collision detection.

**Key Features**:
- Physics-based node positioning
- Drag and drop with momentum
- Collision detection and avoidance
- Bounce-back animations
- Performance-optimized updates

**Configuration**:
```typescript
interface PhysicsEngineConfig {
  enableCollisions?: boolean;   // Enable collision detection
  enableBounceBack?: boolean;   // Enable bounce-back animations
  collisionRadius?: number;     // Collision detection radius
  dampening?: number;           // Movement dampening factor
}
```

**Usage**:
```typescript
const physicsEngine = usePhysicsEngine({
  enableCollisions: false,
  enableBounceBack: true,
});

const { 
  cardPhysics, 
  animationTime,
  startDrag,
  updateDrag,
  endDrag,
  initializeCard,
  getDistance,
  isColliding
} = physicsEngine;
```

**When to Use**: Use when you need physics-based animations and positioning for custom node implementations.

### 3. useGitHubData Hook

**Location**: `src/components/canvas/hooks/useGitHubData.ts`

**Purpose**: Manages GitHub API data fetching, caching, and state management.

**Key Features**:
- Comprehensive GitHub API integration
- Intelligent caching with TTL
- Error handling and retry logic
- Rate limit management
- Real-time data updates

**Configuration**:
```typescript
interface GitHubDataConfig {
  owner: string;        // Repository owner
  repo: string;         // Repository name
  githubToken?: string; // Optional authentication token
}
```

**Usage**:
```typescript
const githubData = useGitHubData({
  owner: "facebook",
  repo: "react",
  githubToken: "your-token",
});

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
    isLoading,
    progress,
    loadingCommits
  },
  error: {
    error
  },
  fetchBranchCommits,
  createPullRequest,
  createBranch
} = githubData;
```

**When to Use**: Use when you need GitHub data integration in custom implementations or when building alternative data visualization interfaces.

## Services

### 1. GitHub API Service

**Location**: `src/components/canvas/services/github-api.ts`

**Purpose**: Handles all GitHub API communications with proper error handling and rate limiting.

**Key Features**:
- RESTful GitHub API integration
- Automatic pagination handling
- Rate limit detection and handling
- Error classification and reporting
- Request caching and optimization

**When to Use**: Use when you need direct GitHub API access outside of the hook system or when building custom API integrations.

### 2. Branch Analyzer Service

**Location**: `src/components/canvas/services/branch-analyzer.ts`

**Purpose**: Analyzes branch relationships and builds tree structures for visualization.

**Key Features**:
- Branch relationship analysis
- Tree structure calculation
- Connection mapping
- Depth calculation for styling
- Parent-child relationship detection

**When to Use**: Use when you need branch relationship analysis for custom visualizations or when building alternative tree structures.

## Utilities

### 1. Coordinate Transformer

**Location**: `src/components/canvas/utils/coordinate-transformer.ts`

**Purpose**: Handles coordinate system transformations between screen and world coordinates.

**Key Functions**:
- `worldToScreen(worldPos, scale, offset)` - Convert world to screen coordinates
- `screenToWorld(screenPos, scale, offset)` - Convert screen to world coordinates
- `mouseToWorld(clientX, clientY, scale, offset, dragOffset?)` - Convert mouse to world coordinates

### 2. Layout Calculator

**Location**: `src/components/canvas/utils/layout-calculator.ts`

**Purpose**: Calculates optimal node layouts and positioning algorithms.

**Key Functions**:
- `calculateTreeLayout(branches, width, height, alignment)` - Calculate tree-based layouts
- Layout algorithms for horizontal, vertical, and radial arrangements

### 3. Performance Monitor

**Location**: `src/components/canvas/utils/performance-monitor.ts`

**Purpose**: Monitors and optimizes canvas performance with metrics tracking.

**Key Features**:
- Render performance tracking
- Memory usage monitoring
- Frame rate optimization
- Performance metrics collection

## Testing

### Test Structure

The testing system uses Vitest and React Testing Library with comprehensive integration tests:

```
src/components/canvas/__tests__/
├── component-integration.test.tsx      # Component interaction tests
├── hooks-integration.test.ts           # Hook coordination tests
├── services-integration.test.ts        # Service integration tests
├── comprehensive-integration.test.tsx  # Full system tests
└── integration-test-summary.md         # Test documentation
```

### Running Tests

**Individual Component Tests**:
```bash
# Test specific components
npm test -- --run component-integration.test.tsx

# Test hooks integration
npm test -- --run hooks-integration.test.ts

# Test services
npm test -- --run services-integration.test.ts
```

**Full Integration Tests**:
```bash
# Run all integration tests
npm test -- --run comprehensive-integration.test.tsx

# Run all canvas tests
npm test -- --run src/components/canvas/__tests__/
```

**Test Coverage**:
```bash
# Generate coverage report
npm test -- --coverage
```

### Test Categories

1. **Component Integration Tests** (`component-integration.test.tsx`):
   - CanvasNode rendering and interactions
   - ConnectionLine visualization
   - CommitNode orbital animations
   - Component coordination and state management

2. **Hook Integration Tests** (`hooks-integration.test.ts`):
   - Canvas interaction and physics coordination
   - GitHub data and physics integration
   - Canvas interaction and GitHub data coordination
   - Performance and memory management

3. **Service Integration Tests** (`services-integration.test.ts`):
   - GitHub API service functionality
   - Branch analyzer service
   - Error handling and retry logic
   - Caching and performance optimization

4. **Comprehensive Integration Tests** (`comprehensive-integration.test.tsx`):
   - Full system workflow testing
   - Error handling scenarios
   - Performance with large datasets
   - Authentication and token handling

### Test Verification

**Before Making Changes**:
```bash
# Verify all tests pass
npm test -- --run src/components/canvas/__tests__/

# Check specific functionality
npm test -- --run component-integration.test.tsx
```

**After Making Changes**:
```bash
# Run affected tests
npm test -- --run [specific-test-file]

# Verify integration still works
npm test -- --run comprehensive-integration.test.tsx
```

### Test Debugging

**Common Test Issues**:
1. **Component rendering issues**: Check props and mock data
2. **Hook coordination problems**: Verify hook dependencies and state updates
3. **API integration failures**: Check mock responses and error handling
4. **Performance test timeouts**: Adjust test timeouts or optimize code

**Debug Commands**:
```bash
# Run tests in debug mode
npm test -- --run [test-file] --reporter=verbose

# Run single test
npm test -- --run [test-file] -t "specific test name"
```

## Usage Examples

### Basic Canvas Implementation

```tsx
import { DraggableCanvas } from './components/canvas';

function App() {
  return (
    <DraggableCanvas 
      owner="facebook" 
      repo="react" 
      githubToken="your-token"
    />
  );
}
```

### Custom Canvas with Hooks

```tsx
import { useCanvasInteraction, usePhysicsEngine, useGitHubData } from './components/canvas/hooks';
import { CanvasNode, ConnectionLine } from './components/canvas/components';

function CustomCanvas() {
  const canvasInteraction = useCanvasInteraction();
  const physicsEngine = usePhysicsEngine();
  const githubData = useGitHubData({ owner: 'owner', repo: 'repo' });

  // Custom implementation using hooks
  return (
    <div ref={canvasInteraction.canvasRef}>
      {/* Custom canvas implementation */}
    </div>
  );
}
```

### Component Testing

```tsx
import { render, fireEvent } from '@testing-library/react';
import { CanvasNode } from './components/canvas/components';

test('CanvasNode handles drag interactions', () => {
  const mockHandlers = {
    onStartDrag: vi.fn(),
    onDrag: vi.fn(),
    onEndDrag: vi.fn(),
  };

  render(
    <CanvasNode
      id="test-branch"
      branch={mockBranch}
      position={{ x: 100, y: 100 }}
      // ... other props
      {...mockHandlers}
    />
  );

  // Test drag interactions
  const node = screen.getByText('test-branch');
  fireEvent.mouseDown(node);
  fireEvent.mouseMove(document, { clientX: 150, clientY: 150 });
  fireEvent.mouseUp(document);

  expect(mockHandlers.onStartDrag).toHaveBeenCalled();
  expect(mockHandlers.onDrag).toHaveBeenCalled();
  expect(mockHandlers.onEndDrag).toHaveBeenCalled();
});
```

## Performance Considerations

### Optimization Strategies

1. **Component Memoization**: All components use React.memo with custom comparison functions
2. **Hook Optimization**: Hooks use useCallback and useMemo for expensive operations
3. **Canvas Rendering**: Uses transform3d for GPU acceleration
4. **Data Caching**: Intelligent caching with TTL for API responses
5. **Event Handling**: Debounced and throttled event handlers

### Memory Management

1. **Cleanup**: Proper cleanup of event listeners and timers
2. **Cache Management**: Automatic cache invalidation and cleanup
3. **Component Unmounting**: Proper resource cleanup on unmount
4. **Large Datasets**: Efficient handling of repositories with many branches

### Performance Monitoring

Use the built-in performance monitor:

```typescript
import { usePerformanceMonitor } from './components/canvas/utils/performance-monitor';

const performanceMonitor = usePerformanceMonitor();

// Start monitoring
performanceMonitor.startMonitoring();

// Track render performance
performanceMonitor.startRender();
performanceMonitor.endRender(nodeCount, connectionCount);

// Get metrics
const metrics = performanceMonitor.getMetrics();
```

## Error Handling

### Error Categories

1. **GitHub API Errors**: Rate limiting, authentication, network issues
2. **Data Processing Errors**: Invalid data formats, missing fields
3. **Rendering Errors**: Component rendering failures, coordinate issues
4. **User Interaction Errors**: Invalid drag operations, coordinate transformations

### Error Recovery

1. **Automatic Retry**: Exponential backoff for transient errors
2. **Graceful Degradation**: Fallback rendering for missing data
3. **User Feedback**: Clear error messages and recovery suggestions
4. **State Recovery**: Automatic state restoration after errors

### Error Testing

```typescript
// Test error handling
test('handles GitHub API errors gracefully', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'));
  
  const { result } = renderHook(() => useGitHubData({
    owner: 'test',
    repo: 'test-repo',
  }));

  await waitFor(() => {
    expect(result.current.error.error).toBeTruthy();
  });

  // Should not crash the application
  expect(result.current.data.branches).toEqual([]);
});
```

## Best Practices

### Component Development

1. **Single Responsibility**: Each component has a clear, single purpose
2. **Props Interface**: Well-defined TypeScript interfaces for all props
3. **Memoization**: Use React.memo for performance optimization
4. **Error Boundaries**: Implement error boundaries for robust error handling

### Hook Development

1. **Custom Hooks**: Extract reusable logic into custom hooks
2. **Dependency Arrays**: Careful management of useEffect dependencies
3. **Cleanup**: Proper cleanup of resources and event listeners
4. **State Management**: Centralized state management with clear data flow

### Testing Strategy

1. **Integration Tests**: Focus on component interactions and data flow
2. **Error Scenarios**: Test error handling and recovery mechanisms
3. **Performance Tests**: Test with large datasets and complex interactions
4. **User Workflows**: Test complete user interaction scenarios

### Code Organization

1. **Modular Structure**: Clear separation of components, hooks, services, and utilities
2. **Type Safety**: Comprehensive TypeScript types for all interfaces
3. **Documentation**: Inline documentation and comprehensive README files
4. **Consistent Naming**: Clear, consistent naming conventions throughout

This documentation provides a comprehensive guide to understanding, using, and testing the Canvas Component System. Refer to individual component files for detailed implementation specifics and the test files for usage examples.