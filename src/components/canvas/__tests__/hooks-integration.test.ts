/**
 * Integration tests for hook interactions
 * Tests data flow and coordination between useCanvasInteraction, usePhysicsEngine, and useGitHubData
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine';
import { useGitHubData } from '../hooks/useGitHubData';

// Mock fetch for GitHub API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock DOM methods
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  value: vi.fn(() => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    x: 0,
    y: 0,
    toJSON: vi.fn(),
  })),
  writable: true,
});

describe('Hooks Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/repos/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            name: 'test-repo',
            full_name: 'test/test-repo',
            default_branch: 'main',
            private: false,
          }),
        });
      }
      if (url.includes('/branches')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { name: 'main', commit: { sha: 'abc123', url: 'url1' }, protected: true },
            { name: 'feature-1', commit: { sha: 'def456', url: 'url2' }, protected: false },
          ]),
          headers: new Headers({ 'link': '' }),
        });
      }
      if (url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers({ 'link': '' }),
        });
      }
      if (url.includes('/issues')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers({ 'link': '' }),
        });
      }
      if (url.includes('/collaborators')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers({ 'link': '' }),
        });
      }
      if (url.includes('/compare/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 3, behind_by: 0, status: 'ahead' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Canvas Interaction and Physics Engine Integration', () => {
    it('should coordinate canvas transformations with physics positions', () => {
      const { result: canvasResult } = renderHook(() => useCanvasInteraction());
      const { result: physicsResult } = renderHook(() => usePhysicsEngine());

      // Initialize a card in physics engine
      act(() => {
        physicsResult.current.initializeCard('test-card', {
          position: { x: 100, y: 100 },
          velocity: { x: 0, y: 0 },
          isDragging: false,
          isExpanded: false,
          isLoadingCommits: false,
          isDragTarget: false,
          animationTime: 0,
        });
      });

      // Transform coordinates using canvas interaction
      const worldPosition = canvasResult.current.screenToWorldCoords({ x: 200, y: 200 });
      
      // Update physics with transformed position
      act(() => {
        physicsResult.current.startDrag('test-card', worldPosition);
      });

      const cardPhysics = physicsResult.current.cardPhysics['test-card'];
      expect(cardPhysics.isDragging).toBe(true);
      expect(cardPhysics.position).toEqual(worldPosition);
    });

    it('should handle zoom changes affecting physics calculations', () => {
      const { result: canvasResult } = renderHook(() => useCanvasInteraction());
      const { result: physicsResult } = renderHook(() => usePhysicsEngine());

      // Set initial zoom
      act(() => {
        canvasResult.current.setScale(2);
      });

      // Initialize card
      act(() => {
        physicsResult.current.initializeCard('test-card', {
          position: { x: 100, y: 100 },
          velocity: { x: 0, y: 0 },
          isDragging: false,
          isExpanded: false,
          isLoadingCommits: false,
          isDragTarget: false,
          animationTime: 0,
        });
      });

      // Mouse coordinates should be transformed correctly with zoom
      const mouseWorldCoords = canvasResult.current.mouseToWorldCoords(400, 400);
      
      // At 2x zoom, screen coordinate 400 should map to world coordinate 200
      expect(mouseWorldCoords.x).toBe(200);
      expect(mouseWorldCoords.y).toBe(200);
    });

    it('should handle collision detection with canvas transformations', () => {
      const { result: physicsResult } = renderHook(() => usePhysicsEngine({
        enableCollisions: true,
        collisionRadius: 50,
      }));

      // Initialize two cards close to each other
      act(() => {
        physicsResult.current.initializeCard('card1', {
          position: { x: 100, y: 100 },
          velocity: { x: 0, y: 0 },
          isDragging: false,
          isExpanded: false,
          isLoadingCommits: false,
          isDragTarget: false,
          animationTime: 0,
        });

        physicsResult.current.initializeCard('card2', {
          position: { x: 130, y: 100 }, // 30 pixels apart, within collision radius
          velocity: { x: 0, y: 0 },
          isDragging: false,
          isExpanded: false,
          isLoadingCommits: false,
          isDragTarget: false,
          animationTime: 0,
        });
      });

      // Check collision detection
      const isColliding = physicsResult.current.isColliding('card1', 'card2');
      expect(isColliding).toBe(true);

      // Check distance calculation
      const distance = physicsResult.current.getDistance(
        { x: 100, y: 100 },
        { x: 130, y: 100 }
      );
      expect(distance).toBe(30);
    });
  });

  describe('GitHub Data and Physics Engine Integration', () => {
    it('should initialize physics for loaded branches', async () => {
      const { result: githubResult } = renderHook(() => useGitHubData({
        owner: 'test',
        repo: 'test-repo',
      }));

      const { result: physicsResult } = renderHook(() => usePhysicsEngine());

      // Wait for data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should have loaded branches
      expect(githubResult.current.data.branches.length).toBeGreaterThan(0);

      // Initialize physics for each branch
      act(() => {
        githubResult.current.data.branches.forEach(branch => {
          physicsResult.current.initializeCard(branch.name, {
            position: { x: Math.random() * 800, y: Math.random() * 600 },
            velocity: { x: 0, y: 0 },
            isDragging: false,
            isExpanded: false,
            isLoadingCommits: false,
            isDragTarget: false,
            animationTime: 0,
          });
        });
      });

      // Should have physics for all branches
      githubResult.current.data.branches.forEach(branch => {
        expect(physicsResult.current.cardPhysics[branch.name]).toBeDefined();
      });
    });

    it('should handle branch commits loading with physics updates', async () => {
      const { result: githubResult } = renderHook(() => useGitHubData({
        owner: 'test',
        repo: 'test-repo',
      }));

      const { result: physicsResult } = renderHook(() => usePhysicsEngine());

      // Wait for initial data load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Initialize physics for a branch
      act(() => {
        physicsResult.current.initializeCard('main', {
          position: { x: 100, y: 100 },
          velocity: { x: 0, y: 0 },
          isDragging: false,
          isExpanded: false,
          isLoadingCommits: false,
          isDragTarget: false,
          animationTime: 0,
        });
      });

      // Mock commits response
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              sha: 'commit1',
              commit: {
                message: 'Test commit',
                author: { name: 'Test Author', date: '2023-01-01T00:00:00Z' },
              },
            },
          ]),
        })
      );

      // Fetch commits for branch
      await act(async () => {
        await githubResult.current.fetchBranchCommits('main');
      });

      // Should update loading state in physics
      const cardPhysics = physicsResult.current.cardPhysics['main'];
      expect(cardPhysics).toBeDefined();
      
      // Loading state should be managed by GitHub data hook
      expect(githubResult.current.loading.loadingCommits.has('main')).toBe(false);
    });

    it('should handle error states affecting physics', async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result: githubResult } = renderHook(() => useGitHubData({
        owner: 'test',
        repo: 'test-repo',
      }));

      const { result: physicsResult } = renderHook(() => usePhysicsEngine());

      // Wait for error to occur
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should have error state
      expect(githubResult.current.error.error).toBeTruthy();

      // Physics should still be functional even with data errors
      act(() => {
        physicsResult.current.initializeCard('fallback-card', {
          position: { x: 100, y: 100 },
          velocity: { x: 0, y: 0 },
          isDragging: false,
          isExpanded: false,
          isLoadingCommits: false,
          isDragTarget: false,
          animationTime: 0,
        });
      });

      expect(physicsResult.current.cardPhysics['fallback-card']).toBeDefined();
    });
  });

  describe('Canvas Interaction and GitHub Data Integration', () => {
    it('should handle coordinate transformations for GitHub data visualization', async () => {
      const { result: canvasResult } = renderHook(() => useCanvasInteraction());
      const { result: githubResult } = renderHook(() => useGitHubData({
        owner: 'test',
        repo: 'test-repo',
      }));

      // Wait for data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Set canvas transformations
      act(() => {
        canvasResult.current.setScale(1.5);
        canvasResult.current.setOffset({ x: 50, y: 50 });
      });

      // Transform positions for branch visualization
      const branches = githubResult.current.data.branches;
      const transformedPositions = branches.map(branch => {
        const basePosition = { x: 100, y: 100 };
        return canvasResult.current.screenToWorldCoords(basePosition);
      });

      // Positions should be transformed according to canvas state
      transformedPositions.forEach(pos => {
        expect(pos.x).toBeCloseTo(33.33, 1); // (100 - 50) / 1.5
        expect(pos.y).toBeCloseTo(33.33, 1); // (100 - 50) / 1.5
      });
    });

    it('should handle zoom-to-fit for branch layout', async () => {
      const { result: canvasResult } = renderHook(() => useCanvasInteraction());
      const { result: githubResult } = renderHook(() => useGitHubData({
        owner: 'test',
        repo: 'test-repo',
      }));

      // Wait for data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Simulate branch positions
      const branchBounds = {
        minX: 0,
        minY: 0,
        maxX: 1000,
        maxY: 800,
      };

      // Zoom to fit all branches
      act(() => {
        canvasResult.current.zoomToFit(branchBounds);
      });

      // Should adjust scale and offset to fit content
      expect(canvasResult.current.scale).toBeLessThan(1);
      expect(canvasResult.current.offset.x).not.toBe(0);
      expect(canvasResult.current.offset.y).not.toBe(0);
    });
  });

  describe('All Hooks Integration', () => {
    it('should coordinate all three hooks for complete functionality', async () => {
      const { result: canvasResult } = renderHook(() => useCanvasInteraction());
      const { result: physicsResult } = renderHook(() => usePhysicsEngine());
      const { result: githubResult } = renderHook(() => useGitHubData({
        owner: 'test',
        repo: 'test-repo',
      }));

      // Wait for GitHub data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Initialize physics for loaded branches
      act(() => {
        githubResult.current.data.branches.forEach((branch, index) => {
          physicsResult.current.initializeCard(branch.name, {
            position: { x: index * 200, y: 100 },
            velocity: { x: 0, y: 0 },
            isDragging: false,
            isExpanded: false,
            isLoadingCommits: false,
            isDragTarget: false,
            animationTime: 0,
          });
        });
      });

      // Simulate user interaction: drag a branch
      const branchName = githubResult.current.data.branches[0]?.name;
      if (branchName) {
        const screenPosition = { x: 300, y: 200 };
        const worldPosition = canvasResult.current.screenToWorldCoords(screenPosition);

        act(() => {
          physicsResult.current.startDrag(branchName, worldPosition);
        });

        // Verify integration
        expect(physicsResult.current.cardPhysics[branchName].isDragging).toBe(true);
        expect(physicsResult.current.cardPhysics[branchName].position).toEqual(worldPosition);
      }

      // Simulate zoom change affecting physics
      act(() => {
        canvasResult.current.setScale(2);
      });

      // Physics should still work with new zoom level
      const newMouseCoords = canvasResult.current.mouseToWorldCoords(400, 400);
      expect(newMouseCoords.x).toBe(200); // 400 / 2
      expect(newMouseCoords.y).toBe(200); // 400 / 2

      // Verify all hooks are working together
      expect(githubResult.current.data.branches.length).toBeGreaterThan(0);
      expect(Object.keys(physicsResult.current.cardPhysics).length).toBeGreaterThan(0);
      expect(canvasResult.current.scale).toBe(2);
    });

    it('should handle complex user workflow', async () => {
      const { result: canvasResult } = renderHook(() => useCanvasInteraction());
      const { result: physicsResult } = renderHook(() => usePhysicsEngine());
      const { result: githubResult } = renderHook(() => useGitHubData({
        owner: 'test',
        repo: 'test-repo',
      }));

      // 1. Load data
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 2. Initialize physics
      act(() => {
        githubResult.current.data.branches.forEach((branch, index) => {
          physicsResult.current.initializeCard(branch.name, {
            position: { x: index * 150, y: 100 },
            velocity: { x: 0, y: 0 },
            isDragging: false,
            isExpanded: false,
            isLoadingCommits: false,
            isDragTarget: false,
            animationTime: 0,
          });
        });
      });

      // 3. User pans the canvas
      act(() => {
        canvasResult.current.setOffset({ x: 100, y: 50 });
      });

      // 4. User zooms in
      act(() => {
        canvasResult.current.setScale(1.5);
      });

      // 5. User drags a branch
      const branchName = githubResult.current.data.branches[0]?.name;
      if (branchName) {
        const dragPosition = canvasResult.current.mouseToWorldCoords(200, 200);
        
        act(() => {
          physicsResult.current.startDrag(branchName, dragPosition);
          physicsResult.current.updateDrag(branchName, { x: dragPosition.x + 50, y: dragPosition.y + 30 });
          physicsResult.current.endDrag(branchName);
        });
      }

      // 6. User loads commits for a branch
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { sha: 'commit1', commit: { message: 'Test', author: { name: 'Author', date: '2023-01-01T00:00:00Z' } } },
          ]),
        })
      );

      if (branchName) {
        await act(async () => {
          await githubResult.current.fetchBranchCommits(branchName);
        });
      }

      // Verify final state
      expect(canvasResult.current.scale).toBe(1.5);
      expect(canvasResult.current.offset).toEqual({ x: 100, y: 50 });
      expect(Object.keys(physicsResult.current.cardPhysics).length).toBeGreaterThan(0);
      expect(githubResult.current.data.branches.length).toBeGreaterThan(0);
      
      if (branchName) {
        expect(physicsResult.current.cardPhysics[branchName].isDragging).toBe(false);
      }
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently across all hooks', async () => {
      // Mock large dataset
      const largeBranchSet = Array.from({ length: 100 }, (_, i) => ({
        name: `branch-${i}`,
        commit: { sha: `sha${i}`, url: `url${i}` },
        protected: false,
      }));

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(largeBranchSet),
            headers: new Headers({ 'link': '' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers({ 'link': '' }),
        });
      });

      const startTime = performance.now();

      const { result: canvasResult } = renderHook(() => useCanvasInteraction());
      const { result: physicsResult } = renderHook(() => usePhysicsEngine());
      const { result: githubResult } = renderHook(() => useGitHubData({
        owner: 'test',
        repo: 'test-repo',
      }));

      // Wait for data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Initialize physics for all branches
      act(() => {
        githubResult.current.data.branches.forEach((branch, index) => {
          physicsResult.current.initializeCard(branch.name, {
            position: { x: (index % 10) * 100, y: Math.floor(index / 10) * 100 },
            velocity: { x: 0, y: 0 },
            isDragging: false,
            isExpanded: false,
            isLoadingCommits: false,
            isDragTarget: false,
            animationTime: 0,
          });
        });
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle large dataset efficiently (less than 1 second)
      expect(totalTime).toBeLessThan(1000);
      expect(githubResult.current.data.branches.length).toBe(100);
      expect(Object.keys(physicsResult.current.cardPhysics).length).toBe(100);
    });

    it('should clean up resources properly', async () => {
      const { result: canvasResult, unmount: unmountCanvas } = renderHook(() => useCanvasInteraction());
      const { result: physicsResult, unmount: unmountPhysics } = renderHook(() => usePhysicsEngine());
      const { result: githubResult, unmount: unmountGithub } = renderHook(() => useGitHubData({
        owner: 'test',
        repo: 'test-repo',
      }));

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Initialize some state
      act(() => {
        physicsResult.current.initializeCard('test-card', {
          position: { x: 100, y: 100 },
          velocity: { x: 0, y: 0 },
          isDragging: false,
          isExpanded: false,
          isLoadingCommits: false,
          isDragTarget: false,
          animationTime: 0,
        });
      });

      // Unmount all hooks
      unmountCanvas();
      unmountPhysics();
      unmountGithub();

      // Should not throw errors after unmounting
      expect(() => {
        // These operations should not cause issues after cleanup
        canvasResult.current.setScale(2);
      }).not.toThrow();
    });
  });
});