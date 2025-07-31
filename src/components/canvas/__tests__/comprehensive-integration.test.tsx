/**
 * Comprehensive Integration Tests for Canvas Components
 * Tests component interactions, data flow between services and components,
 * error handling scenarios, and verifies all existing functionality works correctly
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DraggableCanvas from '../../DraggableCanvas';

// Mock fetch for GitHub API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock DOM methods
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

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

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock data
const mockRepositoryInfo = {
  name: 'test-repo',
  full_name: 'test/test-repo',
  default_branch: 'main',
  private: false,
  description: 'Test repository',
};

const mockBranches = [
  {
    name: 'main',
    commit: { sha: 'abc123', url: 'https://api.github.com/commits/abc123' },
    protected: true,
  },
  {
    name: 'feature-1',
    commit: { sha: 'def456', url: 'https://api.github.com/commits/def456' },
    protected: false,
  },
  {
    name: 'feature-2',
    commit: { sha: 'ghi789', url: 'https://api.github.com/commits/ghi789' },
    protected: false,
  },
];

const mockPullRequests = [
  {
    id: 1,
    number: 123,
    title: 'Add new feature',
    state: 'open',
    html_url: 'https://github.com/test/test-repo/pull/123',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    user: { login: 'testuser', avatar_url: 'https://avatar.url' },
    head: { ref: 'feature-1', sha: 'def456' },
    base: { ref: 'main', sha: 'abc123' },
    draft: false,
    merged: false,
  },
];

const mockIssues = [
  {
    id: 1,
    number: 456,
    title: 'Bug report',
    state: 'open',
    html_url: 'https://github.com/test/test-repo/issues/456',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    user: { login: 'testuser', avatar_url: 'https://avatar.url' },
    assignees: [],
    labels: [{ name: 'bug', color: 'red' }],
    comments: 2,
  },
];

const mockCollaborators = [
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

const mockCommits = [
  {
    sha: 'commit1',
    commit: {
      message: 'Add new feature implementation',
      author: { name: 'John Doe', date: '2023-01-01T12:00:00Z' },
    },
  },
  {
    sha: 'commit2',
    commit: {
      message: 'Fix bug in feature',
      author: { name: 'Jane Smith', date: '2023-01-02T12:00:00Z' },
    },
  },
];

describe('Comprehensive Canvas Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/repos/test/test-repo') && !url.includes('/branches') && !url.includes('/pulls') && !url.includes('/issues') && !url.includes('/collaborators') && !url.includes('/compare') && !url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRepositoryInfo),
        });
      }
      if (url.includes('/branches')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBranches),
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
          json: () => Promise.resolve({ ahead_by: 3, behind_by: 0, status: 'ahead' }),
        });
      }
      if (url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCommits),
          headers: new Headers({ 'link': '' }),
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
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      expect(screen.getByText('Loading branches...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should successfully load and display GitHub data', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(/test\/test-repo/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should display branch information
      await waitFor(() => {
        expect(screen.getByText(/3 branches/)).toBeInTheDocument();
        expect(screen.getByText(/1 open PR/)).toBeInTheDocument();
      });
    });

    it('should render branch nodes after data loads', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
        expect(screen.getByText('feature-1')).toBeInTheDocument();
        expect(screen.getByText('feature-2')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should display collaborators when loaded', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        const collaboratorImage = screen.getByAltText('testuser');
        expect(collaboratorImage).toBeInTheDocument();
        expect(collaboratorImage).toHaveAttribute('src', 'https://avatar.url');
      }, { timeout: 5000 });
    });
  });

  describe('Component Interactions', () => {
    it('should handle node double-click to expand commits', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Double-click on main branch node
      const mainNode = screen.getByText('main').closest('[data-card="true"]');
      expect(mainNode).toBeInTheDocument();
      
      fireEvent.doubleClick(mainNode!);

      // Should trigger commit loading - check that commits API is called after double-click
      await waitFor(() => {
        const commitsCalls = mockFetch.mock.calls.filter(call => 
          call[0].includes('/commits')
        );
        expect(commitsCalls.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('should handle canvas panning with space key', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Press space key
      fireEvent.keyDown(document, { key: ' ', code: 'Space' });
      
      // Should show pan mode indicator
      await waitFor(() => {
        expect(screen.getByText('Pan Mode')).toBeInTheDocument();
      });

      // Release space key
      fireEvent.keyUp(document, { key: ' ', code: 'Space' });
      
      // Pan mode indicator should disappear
      await waitFor(() => {
        expect(screen.queryByText('Pan Mode')).not.toBeInTheDocument();
      });
    });

    it('should handle zoom controls', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

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
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Find and click the merged branches toggle button (it's labeled "Hide Branches w/o Unique Commits")
      const toggleButton = screen.getByRole('button', { name: /Hide Branches w\/o Unique Commits/i });
      expect(toggleButton).toBeInTheDocument();
      
      fireEvent.click(toggleButton);
      
      // Should still show all branches since our mock data has aheadBy values
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('feature-1')).toBeInTheDocument();
    });
  });

  describe('Data Flow Between Services and Components', () => {
    it('should pass GitHub data from service to components correctly', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        // Verify GitHub API service was called
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('api.github.com/repos/test/test-repo/branches'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('api.github.com/repos/test/test-repo/pulls'),
          expect.any(Object)
        );
      });

      // Verify data flows to components
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
        expect(screen.getByText('feature-1')).toBeInTheDocument();
        expect(screen.getByText(/3 branches/)).toBeInTheDocument();
        expect(screen.getByText(/1 open PR/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle physics engine integration with canvas interaction', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify nodes are positioned (physics engine working)
      const mainNode = screen.getByText('main').closest('.absolute');
      expect(mainNode).toBeInTheDocument();
      
      // Verify nodes have positioning styles (positioning from physics)
      const nodeStyle = window.getComputedStyle(mainNode!);
      expect(nodeStyle.position).toBe('absolute');
    });

    it('should coordinate between canvas interaction and node dragging', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

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

      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('Error loading branches')).toBeInTheDocument();
        expect(screen.getByText(/Failed to fetch GitHub data/)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockImplementation(() => 
        Promise.reject(new Error('Network error'))
      );

      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
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

      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        // Should handle gracefully and show error state when API returns null
        expect(screen.getByText('Error loading branches')).toBeInTheDocument();
      });
    });
  });

  describe('Existing Functionality Verification', () => {
    it('should maintain all canvas controls functionality', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify all control elements are present
      expect(screen.getByText(/test\/test-repo/)).toBeInTheDocument();
      expect(screen.getByText(/Hold Space to navigate/)).toBeInTheDocument();
      expect(screen.getByText(/100%/)).toBeInTheDocument(); // Zoom indicator
      
      // Verify GitHub link
      const githubLink = screen.getByTitle('View on GitHub');
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute('href', 'https://github.com/test/test-repo');
    });

    it('should preserve branch node styling and information', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

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
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Connection lines are SVG elements, check for SVG presence
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it('should handle layout options correctly', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Nodes should be positioned according to tree layout
      const nodes = document.querySelectorAll('[data-card="true"]');
      expect(nodes.length).toBe(3); // main, feature-1, feature-2
      
      // Each node should have absolute positioning
      nodes.forEach(node => {
        expect(node.querySelector('.absolute')).toBeInTheDocument();
      });
    });

    it('should preserve all interactive features', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

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
      // Create a moderate dataset for testing
      const largeBranchSet = Array.from({ length: 20 }, (_, i) => ({
        name: `branch-${i}`,
        commit: { sha: `sha${i}`, url: `https://api.github.com/commits/sha${i}` },
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

      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText(/20 branches/)).toBeInTheDocument();
      }, { timeout: 10000 });
      
      // Should render first and last branches
      expect(screen.getByText('branch-0')).toBeInTheDocument();
      expect(screen.getByText('branch-19')).toBeInTheDocument();
    }, 15000);

    it('should clean up properly on unmount', async () => {
      const { unmount } = render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('Loading branches...')).toBeInTheDocument();
      });

      // Unmount should not throw errors
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('Component Integration Scenarios', () => {
    it('should handle complete user workflow', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      // 1. Initial load
      expect(screen.getByText('Loading branches...')).toBeInTheDocument();
      
      // 2. Data loads successfully
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // 3. UI elements are present
      expect(screen.getByText(/test\/test-repo/)).toBeInTheDocument();
      expect(screen.getByText(/3 branches/)).toBeInTheDocument();
      
      // 4. Nodes are interactive
      const mainNode = screen.getByText('main').closest('.absolute');
      expect(mainNode).toBeInTheDocument();
      
      // 5. Canvas interactions work
      const canvasContainer = document.querySelector('.relative.w-full.h-screen');
      expect(() => {
        fireEvent.wheel(canvasContainer!, { deltaY: -100 });
      }).not.toThrow();
    });

    it('should maintain state consistency across interactions', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Perform multiple interactions
      const canvasContainer = document.querySelector('.relative.w-full.h-screen');
      const mainNode = screen.getByText('main').closest('.absolute');
      
      // Zoom
      fireEvent.wheel(canvasContainer!, { deltaY: -100 });
      
      // Drag node
      fireEvent.mouseDown(mainNode!, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(document, { clientX: 150, clientY: 150 });
      
      // Keyboard interaction
      fireEvent.keyDown(document, { key: ' ', code: 'Space' });
      fireEvent.keyUp(document, { key: ' ', code: 'Space' });
      
      // Component should still be functional
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText(/3 branches/)).toBeInTheDocument();
    });
  });

  describe('Authentication and Token Handling', () => {
    it('should handle GitHub token authentication', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" githubToken="test-token" />);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'token test-token',
            }),
          })
        );
      });
    });

    it('should work without authentication token', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.not.objectContaining({
              'Authorization': expect.any(String),
            }),
          })
        );
      });
    });
  });

  describe('Commit Expansion Integration', () => {
    it('should expand and display commits when node is double-clicked', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Double-click on main branch node
      const mainNode = screen.getByText('main').closest('[data-card="true"]');
      fireEvent.doubleClick(mainNode!);

      // Wait for commits to load and display
      await waitFor(() => {
        expect(screen.getByText('Add new feature implementation')).toBeInTheDocument();
        expect(screen.getByText('Fix bug in feature')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Should display commit authors
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    }, 15000);

    it('should handle commit loading errors gracefully', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Mock commit API to fail
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/commits')) {
          return Promise.reject(new Error('Commits API error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBranches),
          headers: new Headers({ 'link': '' }),
        });
      });

      // Double-click on main branch node
      const mainNode = screen.getByText('main').closest('[data-card="true"]');
      fireEvent.doubleClick(mainNode!);

      // Should handle error gracefully without crashing
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });
    });
  });
});