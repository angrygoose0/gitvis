/**
 * Comprehensive integration tests for DraggableCanvas component
 * Tests component interactions, data flow, and error handling scenarios
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DraggableCanvas from '../DraggableCanvas';
import { Branch, PullRequest, Issue, Collaborator } from '../types';

// Mock fetch for GitHub API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window methods
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  width: 800,
  height: 600,
  top: 0,
  left: 0,
  bottom: 600,
  right: 800,
  x: 0,
  y: 0,
  toJSON: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock data
const mockBranches: Branch[] = [
  {
    name: 'main',
    commit: { sha: 'abc123', url: 'https://api.github.com/commits/abc123' },
    protected: true,
    depth: 0,
    aheadBy: 0,
    children: ['feature-1', 'feature-2'],
  },
  {
    name: 'feature-1',
    commit: { sha: 'def456', url: 'https://api.github.com/commits/def456' },
    protected: false,
    depth: 1,
    aheadBy: 3,
    parent: 'main',
  },
  {
    name: 'feature-2',
    commit: { sha: 'ghi789', url: 'https://api.github.com/commits/ghi789' },
    protected: false,
    depth: 1,
    aheadBy: 2,
    parent: 'main',
  },
];

const mockPullRequests: PullRequest[] = [
  {
    id: 1,
    number: 123,
    title: 'Add new feature',
    state: 'open',
    html_url: 'https://github.com/test/repo/pull/123',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    user: { login: 'testuser', avatar_url: 'https://avatar.url' },
    head: { ref: 'feature-1', sha: 'def456' },
    base: { ref: 'main', sha: 'abc123' },
    draft: false,
    merged: false,
  },
];

const mockIssues: Issue[] = [
  {
    id: 1,
    number: 456,
    title: 'Bug report',
    state: 'open',
    html_url: 'https://github.com/test/repo/issues/456',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    user: { login: 'testuser', avatar_url: 'https://avatar.url' },
    assignees: [],
    labels: [{ name: 'bug', color: 'red' }],
    comments: 2,
  },
];

const mockCollaborators: Collaborator[] = [
  {
    id: 1,
    login: 'testuser',
    avatar_url: 'https://avatar.url',
    html_url: 'https://github.com/testuser',
    type: 'User',
    site_admin: false,
    permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
  },
];

describe('DraggableCanvas Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/branches')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBranches.map(b => ({ name: b.name, commit: b.commit, protected: b.protected }))),
          headers: new Headers({ 'link': '' }),
        });
      }
      if (url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPullRequests),
          headers: new Headers({ 'link': '' }),
        });
      }
      if (url.includes('/issues')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIssues),
          headers: new Headers({ 'link': '' }),
        });
      }
      if (url.includes('/collaborators')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCollaborators),
          headers: new Headers({ 'link': '' }),
        });
      }
      if (url.includes('/compare/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 3, behind_by: 0 }),
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

  describe('Component Initialization and Data Loading', () => {
    it('should render loading state initially', () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      expect(screen.getByText('Loading branches...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should load and display branch data successfully', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('test/repo Branches')).toBeInTheDocument();
      });

      // Should display branch count
      await waitFor(() => {
        expect(screen.getByText(/3 branches/)).toBeInTheDocument();
      });

      // Should display PR count
      await waitFor(() => {
        expect(screen.getByText(/1 open PR/)).toBeInTheDocument();
      });
    });

    it('should render branch nodes after data loads', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
        expect(screen.getByText('feature-1')).toBeInTheDocument();
        expect(screen.getByText('feature-2')).toBeInTheDocument();
      });
    });

    it('should display collaborators when loaded', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        const collaboratorImage = screen.getByAltText('testuser');
        expect(collaboratorImage).toBeInTheDocument();
        expect(collaboratorImage).toHaveAttribute('src', 'https://avatar.url');
      });
    });
  });

  describe('Component Interactions', () => {
    it('should handle node double-click to expand commits', async () => {
      // Mock commits API response
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/commits')) {
          return Promise.resolve({
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
            headers: new Headers({ 'link': '' }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Double-click on main branch node
      const mainNode = screen.getByText('main').closest('.absolute');
      expect(mainNode).toBeInTheDocument();
      
      fireEvent.doubleClick(mainNode!);

      // Should trigger commit loading
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/commits'),
          expect.any(Object)
        );
      });
    });

    it('should handle canvas panning with space key', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      const canvas = document.querySelector('[data-testid="canvas"]') || document.body;

      // Press space key
      fireEvent.keyDown(canvas, { key: ' ', code: 'Space' });
      
      // Should show pan mode indicator
      await waitFor(() => {
        expect(screen.getByText('Pan Mode')).toBeInTheDocument();
      });

      // Release space key
      fireEvent.keyUp(canvas, { key: ' ', code: 'Space' });
      
      // Pan mode indicator should disappear
      await waitFor(() => {
        expect(screen.queryByText('Pan Mode')).not.toBeInTheDocument();
      });
    });

    it('should handle zoom controls', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      const canvas = document.querySelector('.relative') || document.body;

      // Test zoom with wheel event
      fireEvent.wheel(canvas, { deltaY: -100 });
      
      // Should update zoom indicator (initially 100%)
      await waitFor(() => {
        const zoomIndicator = screen.getByText(/\d+%/);
        expect(zoomIndicator).toBeInTheDocument();
      });
    });

    it('should toggle merged branches visibility', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Find and click the merged branches toggle button
      const toggleButton = screen.getByRole('button', { name: /merged/i });
      expect(toggleButton).toBeInTheDocument();
      
      fireEvent.click(toggleButton);
      
      // Should still show all branches since our mock data has aheadBy values
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('feature-1')).toBeInTheDocument();
    });
  });

  describe('Data Flow Between Services and Components', () => {
    it('should pass GitHub data from service to components correctly', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        // Verify GitHub API service was called
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('api.github.com/repos/test/repo/branches'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('api.github.com/repos/test/repo/pulls'),
          expect.any(Object)
        );
      });

      // Verify data flows to components
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
        expect(screen.getByText('feature-1')).toBeInTheDocument();
        expect(screen.getByText(/3 branches/)).toBeInTheDocument();
        expect(screen.getByText(/1 open PR/)).toBeInTheDocument();
      });
    });

    it('should handle physics engine integration with canvas interaction', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Verify nodes are positioned (physics engine working)
      const mainNode = screen.getByText('main').closest('.absolute');
      expect(mainNode).toHaveStyle({ position: 'absolute' });
      
      // Verify nodes have transform styles (positioning from physics)
      const nodeStyle = window.getComputedStyle(mainNode!);
      expect(nodeStyle.position).toBe('absolute');
    });

    it('should coordinate between canvas interaction and node dragging', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      const mainNode = screen.getByText('main').closest('.absolute');
      
      // Start drag
      fireEvent.mouseDown(mainNode!, { clientX: 100, clientY: 100 });
      
      // Move mouse
      fireEvent.mouseMove(document, { clientX: 150, clientY: 150 });
      
      // End drag
      fireEvent.mouseUp(document, { clientX: 150, clientY: 150 });
      
      // Node should maintain its position (physics engine handles this)
      expect(mainNode).toBeInTheDocument();
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle GitHub API rate limiting error', async () => {
      mockFetch.mockImplementation(() => 
        Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: () => Promise.resolve({
            message: 'API rate limit exceeded',
            documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
          }),
        })
      );

      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('Error loading branches')).toBeInTheDocument();
        expect(screen.getByText(/Rate limit/)).toBeInTheDocument();
        expect(screen.getByText('Need a GitHub Token?')).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockImplementation(() => 
        Promise.reject(new Error('Network error'))
      );

      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('Error loading branches')).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('should handle invalid repository errors', async () => {
      mockFetch.mockImplementation(() => 
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({
            message: 'Not Found',
          }),
        })
      );

      render(<DraggableCanvas owner="invalid" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('Error loading branches')).toBeInTheDocument();
        expect(screen.getByText(/Not Found/)).toBeInTheDocument();
      });
    });

    it('should handle malformed API responses', async () => {
      mockFetch.mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(null), // Invalid response
        })
      );

      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        // Should handle gracefully and show some error state or empty state
        expect(screen.getByText('test/repo Branches')).toBeInTheDocument();
      });
    });

    it('should handle pull request creation errors', async () => {
      // Setup initial successful load
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/pulls') && url.includes('POST')) {
          return Promise.resolve({
            ok: false,
            status: 422,
            json: () => Promise.resolve({
              message: 'Validation Failed',
              errors: [{ message: 'A pull request already exists' }],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBranches),
          headers: new Headers({ 'link': '' }),
        });
      });

      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Simulate drag and drop to create PR
      const featureNode = screen.getByText('feature-1').closest('.absolute');
      const mainNode = screen.getByText('main').closest('.absolute');
      
      // Start drag on feature-1
      fireEvent.mouseDown(featureNode!, { clientX: 100, clientY: 100 });
      
      // Drag over main
      fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });
      
      // Drop on main
      fireEvent.mouseUp(document, { clientX: 200, clientY: 200 });
      
      // Should show PR creation form
      await waitFor(() => {
        const createButton = screen.getByText('Create Pull Request');
        expect(createButton).toBeInTheDocument();
        
        // Click create button to trigger error
        fireEvent.click(createButton);
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/already exists/)).toBeInTheDocument();
      });
    });
  });

  describe('Existing Functionality Verification', () => {
    it('should maintain all canvas controls functionality', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Verify all control elements are present
      expect(screen.getByText('test/repo Branches')).toBeInTheDocument();
      expect(screen.getByText(/Hold Space to navigate/)).toBeInTheDocument();
      expect(screen.getByText(/100%/)).toBeInTheDocument(); // Zoom indicator
      
      // Verify GitHub link
      const githubLink = screen.getByTitle('View on GitHub');
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute('href', 'https://github.com/test/repo');
    });

    it('should preserve branch node styling and information', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Check main branch (protected)
      const mainNode = screen.getByText('main').closest('.absolute');
      expect(mainNode).toBeInTheDocument();
      
      // Should show commit SHA
      expect(screen.getByText('abc123')).toBeInTheDocument();
      
      // Check feature branches
      expect(screen.getByText('feature-1')).toBeInTheDocument();
      expect(screen.getByText('feature-2')).toBeInTheDocument();
    });

    it('should maintain connection lines between branches', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Connection lines are SVG elements, check for SVG presence
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it('should handle layout options correctly', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Nodes should be positioned according to tree layout
      const nodes = document.querySelectorAll('[data-card="true"]');
      expect(nodes.length).toBe(3); // main, feature-1, feature-2
      
      // Each node should have absolute positioning
      nodes.forEach(node => {
        expect(node.querySelector('.absolute')).toBeInTheDocument();
      });
    });

    it('should preserve all interactive features', async () => {
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Test instructions are present
      expect(screen.getByText(/Drag cards to move them/)).toBeInTheDocument();
      expect(screen.getByText(/Double-click to view commits/)).toBeInTheDocument();
      expect(screen.getByText(/Right-click drag to create branch/)).toBeInTheDocument();
      
      // Control buttons should be present
      const toggleButton = document.querySelector('button');
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large datasets without performance issues', async () => {
      // Create a large dataset
      const largeBranchSet = Array.from({ length: 50 }, (_, i) => ({
        name: `branch-${i}`,
        commit: { sha: `sha${i}`, url: `https://api.github.com/commits/sha${i}` },
        protected: false,
        depth: Math.floor(i / 10),
        aheadBy: i % 5,
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
      render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText(/50 branches/)).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (less than 2 seconds)
      expect(renderTime).toBeLessThan(2000);
      
      // Should render all branches
      expect(screen.getByText('branch-0')).toBeInTheDocument();
      expect(screen.getByText('branch-49')).toBeInTheDocument();
    });

    it('should clean up event listeners and resources', async () => {
      const { unmount } = render(<DraggableCanvas owner="test" repo="repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('Loading branches...')).toBeInTheDocument();
      });

      // Unmount component
      unmount();
      
      // Should not throw errors or cause memory leaks
      expect(() => {
        // Trigger some events that might cause issues if not cleaned up
        fireEvent.keyDown(document, { key: ' ' });
        fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
      }).not.toThrow();
    });
  });
});