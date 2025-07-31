/**
 * Comprehensive Integration Tests for Canvas Components
 * Tests the actual current implementation with realistic scenarios
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DraggableCanvas } from '../index';

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

describe('Canvas Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default successful API responses
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
            { name: 'feature-2', commit: { sha: 'ghi789', url: 'url3' }, protected: false },
          ]),
          headers: new Headers({ 'link': '' }),
        });
      }
      if (url.includes('/pulls')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 1,
              number: 123,
              title: 'Test PR',
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
          ]),
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
          json: () => Promise.resolve([
            {
              id: 1,
              login: 'testuser',
              avatar_url: 'https://avatar.url',
              html_url: 'https://github.com/testuser',
              type: 'User',
              site_admin: false,
              permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
            },
          ]),
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

  describe('Component Loading and Initialization', () => {
    it('should render loading state initially', () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      expect(screen.getByText('Loading branches...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should successfully load and display GitHub data', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(/test\/test-repo Branches/)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should display branch information
      await waitFor(() => {
        expect(screen.getByText(/3 branches/)).toBeInTheDocument();
        expect(screen.getByText(/1 open PR/)).toBeInTheDocument();
      });
    });

    it('should render branch nodes after data loads', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        // Look for branch names in the DOM
        const mainBranch = screen.getByText('main');
        const feature1Branch = screen.getByText('feature-1');
        const feature2Branch = screen.getByText('feature-2');
        
        expect(mainBranch).toBeInTheDocument();
        expect(feature1Branch).toBeInTheDocument();
        expect(feature2Branch).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Component Interactions', () => {
    it('should handle basic canvas interactions', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Test that canvas container exists
      const canvasContainer = document.querySelector('.relative.w-full.h-screen');
      expect(canvasContainer).toBeInTheDocument();

      // Test zoom indicator is present
      const zoomIndicator = screen.getByText(/100%/);
      expect(zoomIndicator).toBeInTheDocument();
    });

    it('should handle node interactions', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Find a branch node
      const mainNode = screen.getByText('main').closest('.absolute');
      expect(mainNode).toBeInTheDocument();

      // Test mouse interactions don't crash
      expect(() => {
        fireEvent.mouseDown(mainNode!, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(document, { clientX: 150, clientY: 150 });
        fireEvent.mouseUp(document, { clientX: 150, clientY: 150 });
      }).not.toThrow();
    });

    it('should display commit information correctly', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Should display commit SHAs
      expect(screen.getByText('abc123')).toBeInTheDocument();
      expect(screen.getByText('def456')).toBeInTheDocument();
      expect(screen.getByText('ghi789')).toBeInTheDocument();
    });
  });

  describe('Data Flow Integration', () => {
    it('should coordinate between hooks and services', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      // Verify API calls are made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('api.github.com/repos/test/test-repo/branches'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('api.github.com/repos/test/test-repo/pulls'),
          expect.any(Object)
        );
      });

      // Verify data is displayed
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
        expect(screen.getByText(/3 branches/)).toBeInTheDocument();
      });
    });

    it('should handle canvas transformations', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      const canvasContainer = document.querySelector('.relative.w-full.h-screen');
      
      // Test wheel zoom
      expect(() => {
        fireEvent.wheel(canvasContainer!, { deltaY: -100 });
      }).not.toThrow();

      // Zoom indicator should still be present
      expect(screen.getByText(/\d+%/)).toBeInTheDocument();
    });

    it('should render connection lines between branches', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Should have SVG elements for connections
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockImplementation(() => 
        Promise.reject(new Error('Network error'))
      );

      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('Error loading branches')).toBeInTheDocument();
      });
    });

    it('should handle rate limiting errors', async () => {
      mockFetch.mockImplementation(() => 
        Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: () => Promise.resolve({
            message: 'API rate limit exceeded',
          }),
        })
      );

      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('Error loading branches')).toBeInTheDocument();
      });
    });

    it('should handle repository not found errors', async () => {
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
      });
    });
  });

  describe('UI Controls and Features', () => {
    it('should display all UI controls', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Header with repo name
      expect(screen.getByText(/test\/test-repo Branches/)).toBeInTheDocument();
      
      // Instructions
      expect(screen.getByText(/Hold Space to navigate/)).toBeInTheDocument();
      
      // Zoom indicator
      expect(screen.getByText(/100%/)).toBeInTheDocument();
      
      // GitHub link
      const githubLink = screen.getByTitle('View on GitHub');
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute('href', 'https://github.com/test/test-repo');
    });

    it('should handle keyboard interactions', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Test space key for pan mode
      expect(() => {
        fireEvent.keyDown(document, { key: ' ', code: 'Space' });
        fireEvent.keyUp(document, { key: ' ', code: 'Space' });
      }).not.toThrow();
    });

    it('should display collaborator avatars', async () => {
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText('main')).toBeInTheDocument();
      });

      // Should display collaborator images
      const collaboratorImages = document.querySelectorAll('img[src="https://avatar.url"]');
      expect(collaboratorImages.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle moderate datasets efficiently', async () => {
      // Create a moderate dataset
      const branches = Array.from({ length: 20 }, (_, i) => ({
        name: `branch-${i}`,
        commit: { sha: `sha${i}`, url: `url${i}` },
        protected: i === 0,
      }));

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/branches')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(branches),
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
      render(<DraggableCanvas owner="test" repo="test-repo" />);
      
      await waitFor(() => {
        expect(screen.getByText(/20 branches/)).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time
      expect(renderTime).toBeLessThan(3000);
      
      // Should render first and last branches
      expect(screen.getByText('branch-0')).toBeInTheDocument();
      expect(screen.getByText('branch-19')).toBeInTheDocument();
    });

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
      });
      
      // 3. UI elements are present
      expect(screen.getByText(/test\/test-repo Branches/)).toBeInTheDocument();
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
      });

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
});