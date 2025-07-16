# Implementation Plan

- [x] 1. Set up project structure and extract type definitions
  - Create the new directory structure under `src/components/canvas/`
  - Extract all TypeScript interfaces from DraggableCanvas.tsx into organized type files
  - Create index files for clean imports
  - _Requirements: 3.1, 3.2, 3.3, 7.2_

- [x] 2. Extract utility functions into dedicated modules
  - Create `date-formatter.ts` and move `formatDate` function
  - Create `coordinate-transformer.ts` for screen/world coordinate conversions
  - Create `layout-calculator.ts` and move `calculateTreeLayout` function
  - Write unit tests for each utility function
  - _Requirements: 2.4, 7.1, 7.4_

- [ ] 3. Create GitHub API service module
  - Create `github-api.ts` with centralized API functions
  - Extract all GitHub API calls from the main component
  - Implement proper error handling and rate limiting
  - Add TypeScript types for API responses
  - _Requirements: 6.1, 6.2, 6.3, 2.2_

- [ ] 4. Create branch analysis service
  - Create `branch-analyzer.ts` and move `calculateBranchTree` function
  - Separate branch relationship logic from API calls
  - Implement branch status analysis functions
  - _Requirements: 6.1, 2.2, 7.1_

- [ ] 5. Create canvas interaction hook
  - Create `useCanvasInteraction.ts` for pan, zoom, and drag logic
  - Extract canvas state management from main component
  - Implement coordinate transformation utilities
  - Handle mouse and touch events for canvas interactions
  - _Requirements: 5.1, 5.3, 5.4, 2.1_

- [ ] 6. Create physics engine hook
  - Create `usePhysicsEngine.ts` for node physics and animations
  - Extract velocity calculations and collision detection
  - Implement animation frame management
  - Handle node positioning and movement
  - _Requirements: 5.2, 2.1, 7.1_

- [ ] 7. Create GitHub data management hook
  - Create `useGitHubData.ts` to orchestrate data fetching
  - Integrate with GitHub API service
  - Manage loading states and error handling
  - Implement data caching strategy
  - _Requirements: 6.2, 6.4, 2.1, 2.2_

- [ ] 8. Extract CommitNode component
  - Create `CommitNode.tsx` for individual commit rendering
  - Move commit node rendering logic from DraggableNode
  - Implement commit animations and styling
  - Handle commit node interactions
  - _Requirements: 4.1, 4.2, 4.3, 7.1, 7.4_

- [ ] 9. Extract ConnectionLine component
  - Create standalone `ConnectionLine.tsx` component
  - Move connection line rendering logic
  - Implement pull request status visualization
  - Add animation effects for commit flow
  - _Requirements: 4.1, 4.2, 7.1, 7.4_

- [ ] 10. Extract CanvasNode component
  - Create `CanvasNode.tsx` for branch node rendering
  - Move node rendering logic from DraggableNode
  - Integrate with CommitNode component
  - Implement node interaction handlers
  - _Requirements: 4.1, 4.2, 4.4, 7.1, 7.4_

- [ ] 11. Refactor main DraggableCanvas component
  - Update main component to use extracted hooks and services
  - Remove extracted code and replace with hook calls
  - Integrate all new components
  - Ensure all functionality is preserved
  - Update component to orchestrate rather than implement
  - _Requirements: 1.1, 2.1, 7.1, 7.3_

- [ ] 12. Create comprehensive component integration tests
  - Write integration tests for component interactions
  - Test data flow between services and components
  - Test error handling scenarios
  - Verify all existing functionality works correctly
  - _Requirements: 1.1, 6.3, 7.1_

- [ ] 13. Add performance optimizations and cleanup
  - Optimize rendering performance with React.memo where appropriate
  - Implement proper cleanup in useEffect hooks
  - Add performance monitoring for large datasets
  - Remove any unused code or imports
  - _Requirements: 1.1, 7.1_

- [ ] 14. Update imports and create clean API surface
  - Create main index.ts file that exports the refactored component
  - Update any external imports to use the new structure
  - Ensure backward compatibility for existing usage
  - Add JSDoc comments for public APIs
  - _Requirements: 1.1, 7.2, 7.3_