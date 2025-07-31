/**
 * Component Integration Tests
 * Tests interactions between CanvasNode, ConnectionLine, CommitNode, and their parent components
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CanvasNode } from '../components/CanvasNode';
import { ConnectionLine } from '../components/ConnectionLine';
import { CommitNode } from '../components/CommitNode';
import { Branch, PullRequest } from '../types';

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

describe('Component Integration Tests', () => {
  const mockBranch: Branch = {
    name: 'feature-branch',
    commit: { sha: 'abc123', url: 'https://api.github.com/commits/abc123' },
    protected: false,
    depth: 1,
    aheadBy: 3,
    parent: 'main',
    children: [],
    commits: [
      {
        sha: 'commit1',
        commit: {
          message: 'Add new feature',
          author: { name: 'John Doe', date: '2023-01-01T00:00:00Z' },
        },
      },
      {
        sha: 'commit2',
        commit: {
          message: 'Fix bug',
          author: { name: 'Jane Smith', date: '2023-01-02T00:00:00Z' },
        },
      },
    ],
  };

  const mockPullRequest: PullRequest = {
    id: 1,
    number: 123,
    title: 'Add new feature',
    state: 'open',
    html_url: 'https://github.com/test/repo/pull/123',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    user: { login: 'johndoe', avatar_url: 'https://avatar.url' },
    head: { ref: 'feature-branch', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    draft: false,
    merged: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CanvasNode Component Integration', () => {
    it('should render branch information correctly', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <CanvasNode
          id="feature-branch"
          branch={mockBranch}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={1}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={false}
          isLoadingCommits={false}
          isDragTarget={false}
          animationTime={0}
          {...mockHandlers}
        />
      );

      // Should display branch name
      expect(screen.getByText('feature-branch')).toBeInTheDocument();

      // Should display commit SHA
      expect(screen.getByText('abc123')).toBeInTheDocument();

      // Should display ahead count
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should handle drag interactions correctly', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <CanvasNode
          id="feature-branch"
          branch={mockBranch}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={1}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={false}
          isLoadingCommits={false}
          isDragTarget={false}
          animationTime={0}
          {...mockHandlers}
        />
      );

      const nodeElement = screen.getByText('feature-branch').closest('.absolute');
      expect(nodeElement).toBeInTheDocument();

      // Start drag
      fireEvent.mouseDown(nodeElement!, { clientX: 100, clientY: 100 });
      expect(mockHandlers.onStartDrag).toHaveBeenCalledWith(
        'feature-branch',
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
      );

      // Drag movement
      fireEvent.mouseMove(document, { clientX: 150, clientY: 150 });
      expect(mockHandlers.onDrag).toHaveBeenCalled();

      // End drag
      fireEvent.mouseUp(document, { clientX: 150, clientY: 150 });
      expect(mockHandlers.onEndDrag).toHaveBeenCalledWith('feature-branch');
    });

    it('should handle double-click to expand commits', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <CanvasNode
          id="feature-branch"
          branch={mockBranch}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={1}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={false}
          isLoadingCommits={false}
          isDragTarget={false}
          animationTime={0}
          {...mockHandlers}
        />
      );

      const nodeElement = screen.getByText('feature-branch').closest('.absolute');
      fireEvent.doubleClick(nodeElement!);

      expect(mockHandlers.onDoubleClick).toHaveBeenCalledWith('feature-branch');
    });

    it('should display commits when expanded', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <CanvasNode
          id="feature-branch"
          branch={mockBranch}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={1}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={true}
          isLoadingCommits={false}
          isDragTarget={false}
          animationTime={1000}
          {...mockHandlers}
        />
      );

      // Should display commit nodes when expanded
      expect(screen.getByText('Add new feature')).toBeInTheDocument();
      expect(screen.getByText('Fix bug')).toBeInTheDocument();
    });

    it('should show loading state for commits', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <CanvasNode
          id="feature-branch"
          branch={mockBranch}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={1}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={true}
          isLoadingCommits={true}
          isDragTarget={false}
          animationTime={0}
          {...mockHandlers}
        />
      );

      // Should show loading indicator
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should highlight when it is a drag target', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <CanvasNode
          id="feature-branch"
          branch={mockBranch}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={1}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={false}
          isLoadingCommits={false}
          isDragTarget={true}
          animationTime={0}
          {...mockHandlers}
        />
      );

      const nodeElement = screen.getByText('feature-branch').closest('.absolute');

      // Should have drag target styling (ring effect)
      expect(nodeElement?.querySelector('.ring-2')).toBeInTheDocument();
    });
  });

  describe('ConnectionLine Component Integration', () => {
    it('should render connection line between two points', () => {
      render(
        <div style={{ position: 'relative', width: '800px', height: '600px' }}>
          <ConnectionLine
            from={{ x: 100, y: 100 }}
            to={{ x: 300, y: 200 }}
            scale={1}
            offset={{ x: 0, y: 0 }}
            commitCount={3}
          />
        </div>
      );

      // Should render SVG line
      const svgElement = document.querySelector('svg');
      expect(svgElement).toBeInTheDocument();

      const lineElement = document.querySelector('line');
      expect(lineElement).toBeInTheDocument();
    });

    it('should display pull request information when provided', () => {
      render(
        <div style={{ position: 'relative', width: '800px', height: '600px' }}>
          <ConnectionLine
            from={{ x: 100, y: 100 }}
            to={{ x: 300, y: 200 }}
            scale={1}
            offset={{ x: 0, y: 0 }}
            pullRequest={mockPullRequest}
            commitCount={3}
          />
        </div>
      );

      // Should render with PR styling
      const svgElement = document.querySelector('svg');
      expect(svgElement).toBeInTheDocument();

      // Should have different styling for PR connections
      const lineElement = document.querySelector('line');
      expect(lineElement).toHaveAttribute('stroke');
    });

    it('should adjust position based on scale and offset', () => {
      render(
        <div style={{ position: 'relative', width: '800px', height: '600px' }}>
          <ConnectionLine
            from={{ x: 100, y: 100 }}
            to={{ x: 300, y: 200 }}
            scale={2}
            offset={{ x: 50, y: 50 }}
            commitCount={3}
          />
        </div>
      );

      const lineElement = document.querySelector('line');
      expect(lineElement).toBeInTheDocument();

      // Line coordinates should be transformed by scale and offset
      const x1 = lineElement?.getAttribute('x1');
      const y1 = lineElement?.getAttribute('y1');
      const x2 = lineElement?.getAttribute('x2');
      const y2 = lineElement?.getAttribute('y2');

      // Coordinates should be: (position * scale) + offset
      expect(x1).toBe('250'); // (100 * 2) + 50
      expect(y1).toBe('250'); // (100 * 2) + 50
      expect(x2).toBe('650'); // (300 * 2) + 50
      expect(y2).toBe('450'); // (200 * 2) + 50
    });

    it('should display commit count indicators', () => {
      render(
        <div style={{ position: 'relative', width: '800px', height: '600px' }}>
          <ConnectionLine
            from={{ x: 100, y: 100 }}
            to={{ x: 300, y: 200 }}
            scale={1}
            offset={{ x: 0, y: 0 }}
            commitCount={5}
          />
        </div>
      );

      // Should render commit indicators along the line
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
      expect(circles.length).toBeLessThanOrEqual(5); // Max 5 commit indicators
    });
  });

  describe('CommitNode Component Integration', () => {
    const mockCommit = {
      sha: 'commit1',
      commit: {
        message: 'Add new feature implementation',
        author: { name: 'John Doe', date: '2023-01-01T12:00:00Z' },
      },
    };

    it('should render commit information correctly', () => {
      render(
        <CommitNode
          commit={mockCommit}
          position={{ x: 150, y: 150 }}
          scale={1}
          offset={{ x: 0, y: 0 }}
          animationTime={0}
        />
      );

      // Should display commit SHA (first 7 characters)
      expect(screen.getByText('commit1')).toBeInTheDocument();

      // Should display commit message (truncated)
      expect(screen.getByText(/Add new feature/)).toBeInTheDocument();

      // Should display author name
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle long commit messages correctly', () => {
      const longCommitMessage = {
        ...mockCommit,
        commit: {
          ...mockCommit.commit,
          message: 'This is a very long commit message that should be truncated to fit within the commit node display area without overflowing',
        },
      };

      render(
        <CommitNode
          commit={longCommitMessage}
          position={{ x: 150, y: 150 }}
          scale={1}
          offset={{ x: 0, y: 0 }}
          animationTime={0}
        />
      );

      // Should truncate long messages
      const messageElement = screen.getByText(/This is a very long/);
      expect(messageElement).toBeInTheDocument();
    });

    it('should animate position based on animation time', () => {
      const { rerender } = render(
        <CommitNode
          commit={mockCommit}
          position={{ x: 150, y: 150 }}
          scale={1}
          offset={{ x: 0, y: 0 }}
          animationTime={0}
        />
      );

      const initialElement = document.querySelector('[data-commit-node]');
      const initialTransform = initialElement?.getAttribute('style');

      // Update animation time
      rerender(
        <CommitNode
          commit={mockCommit}
          position={{ x: 150, y: 150 }}
          scale={1}
          offset={{ x: 0, y: 0 }}
          animationTime={1000}
        />
      );

      const updatedElement = document.querySelector('[data-commit-node]');
      const updatedTransform = updatedElement?.getAttribute('style');

      // Transform should change with animation time (orbital motion)
      expect(initialTransform).not.toBe(updatedTransform);
    });

    it('should adjust size based on scale', () => {
      render(
        <CommitNode
          commit={mockCommit}
          position={{ x: 150, y: 150 }}
          scale={2}
          offset={{ x: 0, y: 0 }}
          animationTime={0}
        />
      );

      const commitElement = document.querySelector('[data-commit-node]');
      expect(commitElement).toBeInTheDocument();

      // Element should be scaled appropriately
      const style = commitElement?.getAttribute('style');
      expect(style).toContain('scale');
    });
  });

  describe('Component Interaction Integration', () => {
    it('should coordinate CanvasNode with CommitNode display', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <CanvasNode
          id="feature-branch"
          branch={mockBranch}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={1}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={true}
          isLoadingCommits={false}
          isDragTarget={false}
          animationTime={1000}
          {...mockHandlers}
        />
      );

      // Should display both branch node and commit nodes
      expect(screen.getByText('feature-branch')).toBeInTheDocument();
      expect(screen.getByText('Add new feature')).toBeInTheDocument();
      expect(screen.getByText('Fix bug')).toBeInTheDocument();

      // Commit nodes should be positioned relative to branch node
      const commitElements = document.querySelectorAll('[data-commit-node]');
      expect(commitElements.length).toBe(2);
    });

    it('should handle scale changes across all components', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      const { rerender } = render(
        <div>
          <CanvasNode
            id="feature-branch"
            branch={mockBranch}
            position={{ x: 100, y: 100 }}
            isDragging={false}
            scale={1}
            offset={{ x: 0, y: 0 }}
            isSpacePressed={false}
            isExpanded={true}
            isLoadingCommits={false}
            isDragTarget={false}
            animationTime={0}
            {...mockHandlers}
          />
          <ConnectionLine
            from={{ x: 100, y: 100 }}
            to={{ x: 300, y: 200 }}
            scale={1}
            offset={{ x: 0, y: 0 }}
            commitCount={3}
          />
        </div>
      );

      // Change scale
      rerender(
        <div>
          <CanvasNode
            id="feature-branch"
            branch={mockBranch}
            position={{ x: 100, y: 100 }}
            isDragging={false}
            scale={2}
            offset={{ x: 0, y: 0 }}
            isSpacePressed={false}
            isExpanded={true}
            isLoadingCommits={false}
            isDragTarget={false}
            animationTime={0}
            {...mockHandlers}
          />
          <ConnectionLine
            from={{ x: 100, y: 100 }}
            to={{ x: 300, y: 200 }}
            scale={2}
            offset={{ x: 0, y: 0 }}
            commitCount={3}
          />
        </div>
      );

      // All components should adjust to new scale
      const nodeElement = screen.getByText('feature-branch').closest('.absolute');
      const lineElement = document.querySelector('line');
      const commitElements = document.querySelectorAll('[data-commit-node]');

      expect(nodeElement).toBeInTheDocument();
      expect(lineElement).toBeInTheDocument();
      expect(commitElements.length).toBeGreaterThan(0);
    });

    it('should handle offset changes consistently', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <div>
          <CanvasNode
            id="feature-branch"
            branch={mockBranch}
            position={{ x: 100, y: 100 }}
            isDragging={false}
            scale={1}
            offset={{ x: 50, y: 50 }}
            isSpacePressed={false}
            isExpanded={false}
            isLoadingCommits={false}
            isDragTarget={false}
            animationTime={0}
            {...mockHandlers}
          />
          <ConnectionLine
            from={{ x: 100, y: 100 }}
            to={{ x: 300, y: 200 }}
            scale={1}
            offset={{ x: 50, y: 50 }}
            commitCount={3}
          />
        </div>
      );

      // Components should be positioned with offset
      const nodeElement = screen.getByText('feature-branch').closest('.absolute');
      const lineElement = document.querySelector('line');

      expect(nodeElement).toBeInTheDocument();
      expect(lineElement).toBeInTheDocument();

      // Line should be offset correctly
      const x1 = lineElement?.getAttribute('x1');
      const y1 = lineElement?.getAttribute('y1');
      expect(x1).toBe('150'); // 100 + 50
      expect(y1).toBe('150'); // 100 + 50
    });

    it('should handle complex interaction scenarios', async () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <div style={{ position: 'relative', width: '800px', height: '600px' }}>
          <ConnectionLine
            from={{ x: 100, y: 100 }}
            to={{ x: 300, y: 200 }}
            scale={1}
            offset={{ x: 0, y: 0 }}
            pullRequest={mockPullRequest}
            commitCount={3}
          />
          <CanvasNode
            id="feature-branch"
            branch={mockBranch}
            position={{ x: 100, y: 100 }}
            isDragging={false}
            scale={1}
            offset={{ x: 0, y: 0 }}
            isSpacePressed={false}
            isExpanded={false}
            isLoadingCommits={false}
            isDragTarget={false}
            animationTime={0}
            {...mockHandlers}
          />
          <CanvasNode
            id="main"
            branch={{
              name: 'main',
              commit: { sha: 'def456', url: 'url' },
              protected: true,
              depth: 0,
              aheadBy: 0,
              children: ['feature-branch'],
            }}
            position={{ x: 300, y: 200 }}
            isDragging={false}
            scale={1}
            offset={{ x: 0, y: 0 }}
            isSpacePressed={false}
            isExpanded={false}
            isLoadingCommits={false}
            isDragTarget={false}
            animationTime={0}
            {...mockHandlers}
          />
        </div>
      );

      // Should render all components
      expect(screen.getByText('feature-branch')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(document.querySelector('svg')).toBeInTheDocument();

      // Simulate drag interaction
      const featureBranchNode = screen.getByText('feature-branch').closest('.absolute');
      fireEvent.mouseDown(featureBranchNode!, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(document, { clientX: 150, clientY: 150 });

      expect(mockHandlers.onStartDrag).toHaveBeenCalled();
      expect(mockHandlers.onDrag).toHaveBeenCalled();
      expect(mockHandlers.onEndDrag).toHaveBeenCalled();

      // Simulate double-click to expand
      fireEvent.doubleClick(featureBranchNode!);
      expect(mockHandlers.onDoubleClick).toHaveBeenCalledWith('feature-branch');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing commit data gracefully', () => {
      const branchWithoutCommits = {
        ...mockBranch,
        commits: undefined,
      };

      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      render(
        <CanvasNode
          id="feature-branch"
          branch={branchWithoutCommits}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={1}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={true}
          isLoadingCommits={false}
          isDragTarget={false}
          animationTime={0}
          {...mockHandlers}
        />
      );

      // Should still render branch without crashing
      expect(screen.getByText('feature-branch')).toBeInTheDocument();

      // Should not render commit nodes
      expect(screen.queryByText('Add new feature')).not.toBeInTheDocument();
    });

    it('should handle invalid position data', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      expect(() => {
        render(
          <CanvasNode
            id="feature-branch"
            branch={mockBranch}
            position={{ x: NaN, y: NaN }}
            isDragging={false}
            scale={1}
            offset={{ x: 0, y: 0 }}
            isSpacePressed={false}
            isExpanded={false}
            isLoadingCommits={false}
            isDragTarget={false}
            animationTime={0}
            {...mockHandlers}
          />
        );
      }).not.toThrow();

      // Should still render with fallback positioning
      expect(screen.getByText('feature-branch')).toBeInTheDocument();
    });

    it('should handle extreme scale values', () => {
      const mockHandlers = {
        onStartDrag: vi.fn(),
        onDrag: vi.fn(),
        onEndDrag: vi.fn(),
        onDoubleClick: vi.fn(),
      };

      // Test with very small scale
      render(
        <CanvasNode
          id="feature-branch"
          branch={mockBranch}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={0.01}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={false}
          isLoadingCommits={false}
          isDragTarget={false}
          animationTime={0}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('feature-branch')).toBeInTheDocument();

      // Test with very large scale
      render(
        <CanvasNode
          id="feature-branch-large"
          branch={{ ...mockBranch, name: 'feature-branch-large' }}
          position={{ x: 100, y: 100 }}
          isDragging={false}
          scale={100}
          offset={{ x: 0, y: 0 }}
          isSpacePressed={false}
          isExpanded={false}
          isLoadingCommits={false}
          isDragTarget={false}
          animationTime={0}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('feature-branch-large')).toBeInTheDocument();
    });
  });
});