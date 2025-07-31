# Canvas API Documentation

This document describes the clean API surface for the canvas module, providing a comprehensive guide for developers using the GitHub repository visualization system.

## Main Export

The primary way to use the canvas system is through the main `DraggableCanvas` component:

```tsx
import { DraggableCanvas } from './components/canvas';

function App() {
  return (
    <DraggableCanvas 
      owner="facebook" 
      repo="react" 
      githubToken="your-github-token"
    />
  );
}
```

## Component Exports

For custom implementations, you can import individual components:

```tsx
import { 
  DraggableCanvas,
  CanvasNode, 
  CommitNode, 
  ConnectionLine 
} from './components/canvas/components';
```

### DraggableCanvas
The main interactive canvas component for GitHub repository visualization.

**Props:**
- `owner?: string` - GitHub repository owner (default: "facebook")
- `repo?: string` - GitHub repository name (default: "react")  
- `githubToken?: string` - Optional GitHub API token for authenticated requests

### CanvasNode
Individual node component for rendering branch nodes in the canvas.

### CommitNode
Component for rendering individual commit nodes with orbital animations.

### ConnectionLine
Component for rendering connection lines between nodes with animations.

## Hook Exports

Custom React hooks for building your own canvas implementations:

```tsx
import { 
  useCanvasInteraction,
  usePhysicsEngine,
  useGitHubData 
} from './components/canvas/hooks';
```

### useCanvasInteraction
Hook for managing canvas pan, zoom, and drag interactions.

**Config:**
- `minScale?: number` - Minimum zoom scale (default: 0.1)
- `maxScale?: number` - Maximum zoom scale (default: 5)
- `zoomSensitivity?: number` - Zoom sensitivity (default: 0.1)

**Returns:**
- Canvas state and interaction handlers
- Screen/world coordinate transformation functions
- Pan and zoom controls

### usePhysicsEngine
Hook for managing node physics, animations, and positioning.

**Config:**
- `enableCollisions?: boolean` - Enable collision detection
- `enableBounceBack?: boolean` - Enable bounce-back animations

**Returns:**
- Physics state management
- Animation controls
- Drag and drop handlers

### useGitHubData
Hook for fetching and managing GitHub repository data.

**Config:**
- `owner: string` - Repository owner
- `repo: string` - Repository name
- `githubToken?: string` - Optional API token

**Returns:**
- Repository data (branches, PRs, issues, collaborators)
- Loading states and progress
- Error handling
- Data mutation functions (create PR, create branch)

## Service Exports

Service modules for external integrations:

```tsx
import { 
  GitHubApiService,
  createGitHubApiService,
  calculateBranchTree 
} from './components/canvas/services';
```

### GitHubApiService
Service for making GitHub API calls with proper error handling and rate limiting.

### calculateBranchTree
Service for analyzing branch relationships and building tree structures.

## Utility Exports

Helper functions for common operations:

```tsx
import { 
  formatDate,
  screenToWorld,
  mouseToWorld,
  calculateTreeLayout,
  usePerformanceMonitor 
} from './components/canvas/utils';
```

### Date Formatting
- `formatDate(date: Date): string` - Format dates consistently

### Coordinate Transformation
- `screenToWorld(screenPos: Position, scale: number, offset: Position): Position`
- `mouseToWorld(event: MouseEvent, scale: number, offset: Position): Position`

### Layout Calculation
- `calculateTreeLayout(branches: Branch[], width: number, height: number, alignment: string): Record<string, Position>`

### Performance Monitoring
- `usePerformanceMonitor()` - Hook for monitoring canvas performance

## Type Exports

TypeScript type definitions for type safety:

```tsx
import type { 
  // GitHub types
  PullRequest,
  Issue,
  Branch,
  Collaborator,
  BranchConnection,
  
  // Canvas types
  Position,
  Velocity,
  CanvasState,
  NodePhysics,
  DragState,
  CardPhysics,
  
  // Component props
  DraggableCanvasProps,
  CanvasNodeProps,
  ConnectionLineProps,
  CommitNodeProps
} from './components/canvas/types';
```

## Migration Guide

### From Direct Imports

**Before:**
```tsx
import DraggableCanvas from '../components/DraggableCanvas';
```

**After:**
```tsx
import { DraggableCanvas } from '../components/canvas';
```

### Backward Compatibility

The old import structure is still supported through the component exports:

```tsx
// Still works
import { DraggableCanvas } from '../components/canvas/components';
```

## Examples

### Basic Usage
```tsx
import { DraggableCanvas } from './components/canvas';

export default function GitHubVisualizer() {
  return (
    <DraggableCanvas 
      owner="microsoft" 
      repo="vscode" 
      githubToken={process.env.GITHUB_TOKEN}
    />
  );
}
```

### Custom Implementation
```tsx
import { 
  useCanvasInteraction, 
  usePhysicsEngine, 
  useGitHubData,
  CanvasNode,
  ConnectionLine
} from './components/canvas';

export default function CustomCanvas() {
  const canvas = useCanvasInteraction({ minScale: 0.2, maxScale: 3 });
  const physics = usePhysicsEngine({ enableCollisions: true });
  const github = useGitHubData({ owner: 'facebook', repo: 'react' });
  
  // Custom implementation using the hooks and components
  return (
    <div ref={canvas.canvasRef}>
      {github.data.branches.map(branch => (
        <CanvasNode 
          key={branch.name}
          branch={branch}
          // ... other props
        />
      ))}
    </div>
  );
}
```

## Best Practices

1. **Use the main export** for standard use cases
2. **Import specific components/hooks** only when building custom implementations
3. **Provide GitHub tokens** to avoid rate limiting
4. **Handle loading and error states** appropriately
5. **Use TypeScript types** for better development experience

## Performance Considerations

- The canvas system includes built-in performance monitoring
- Large repositories (>100 branches) may require pagination
- Use the `usePerformanceMonitor` hook to track rendering performance
- Consider implementing virtualization for very large datasets