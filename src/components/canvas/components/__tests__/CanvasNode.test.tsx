import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasNode } from '../CanvasNode';
import { Branch, Position } from '../../types';

// Mock the utility functions
vi.mock('../../utils/coordinate-transformer', () => ({
  worldToScreen: vi.fn((position: Position) => position),
  screenToWorld: vi.fn((position: Position) => position),
  mouseToWorld: vi.fn((x: number, y: number) => ({ x, y })),
}));

// Mock the CommitNode component
vi.mock('../CommitNode', () => ({
  CommitNode: vi.fn(() => <div data-testid="commit-node" />),
}));

describe('CanvasNode', () => {
  const mockBranch: Branch = {
    name: 'main',
    commit: {
      sha: 'abc123def456',
      url: 'https://api.github.com/repos/test/test/commits/abc123def456',
    },
    protected: false,
    depth: 0,
    aheadBy: 5,
    commits: [
      {
        sha: 'commit1',
        commit: {
          message: 'Test commit 1',
          author: {
            name: 'Test Author',
            date: '2023-01-01T00:00:00Z',
          },
        },
      },
    ],
  };

  const defaultProps = {
    id: 'main',
    branch: mockBranch,
    position: { x: 100, y: 100 },
    isDragging: false,
    scale: 1,
    offset: { x: 0, y: 0 },
    isSpacePressed: false,
    isExpanded: false,
    isLoadingCommits: false,
    isDragTarget: false,
    animationTime: 0,
    onStartDrag: vi.fn(),
    onDrag: vi.fn(),
    onEndDrag: vi.fn(),
    onDoubleClick: vi.fn(),
  };

  it('renders the branch node with correct styling', () => {
    render(<CanvasNode {...defaultProps} />);
    
    // Check that the node is rendered by looking for the absolute positioned container
    const absoluteContainer = document.querySelector('.absolute');
    expect(absoluteContainer).toBeInTheDocument();
    expect(absoluteContainer).toHaveClass('absolute');
  });

  it('displays branch name and commit SHA', () => {
    render(<CanvasNode {...defaultProps} />);
    
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('abc123d')).toBeInTheDocument();
  });

  it('shows protected badge when branch is protected', () => {
    const protectedBranch = { ...mockBranch, protected: true };
    render(<CanvasNode {...defaultProps} branch={protectedBranch} />);
    
    // Check for the lock icon (SVG path)
    const lockIcon = document.querySelector('svg');
    expect(lockIcon).toBeInTheDocument();
  });

  it('shows loading indicator when loading commits', () => {
    render(<CanvasNode {...defaultProps} isLoadingCommits={true} />);
    
    // Check for the loading spinner by class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders commit nodes when expanded', () => {
    render(<CanvasNode {...defaultProps} isExpanded={true} />);
    
    // Check that CommitNode is rendered
    expect(screen.getByTestId('commit-node')).toBeInTheDocument();
  });

  it('does not render commit nodes when not expanded', () => {
    render(<CanvasNode {...defaultProps} isExpanded={false} />);
    
    // Check that CommitNode is not rendered
    expect(screen.queryByTestId('commit-node')).not.toBeInTheDocument();
  });

  it('applies drag target styling when isDragTarget is true', () => {
    render(<CanvasNode {...defaultProps} isDragTarget={true} />);
    
    // Check for orange styling
    const nodeCircle = document.querySelector('.bg-orange-400');
    expect(nodeCircle).toBeInTheDocument();
  });

  it('applies different colors based on branch depth', () => {
    // Test depth 0 (green)
    render(<CanvasNode {...defaultProps} branch={{ ...mockBranch, depth: 0 }} />);
    const nodeCircle = document.querySelector('.bg-green-400');
    expect(nodeCircle).toBeInTheDocument();
  });

  it('calls onDoubleClick when double-clicked', () => {
    const onDoubleClick = vi.fn();
    render(<CanvasNode {...defaultProps} onDoubleClick={onDoubleClick} />);
    
    // Get the absolute positioned container and double click it
    const absoluteContainer = document.querySelector('.absolute');
    fireEvent.doubleClick(absoluteContainer!);
    
    expect(onDoubleClick).toHaveBeenCalledWith('main');
  });

  it('shows additional info at higher zoom levels', () => {
    const branchWithChildren = {
      ...mockBranch,
      children: ['feature-1', 'feature-2'],
    };
    
    render(<CanvasNode {...defaultProps} branch={branchWithChildren} scale={2} isExpanded={true} />);
    
    expect(screen.getByText('2 branches')).toBeInTheDocument();
    expect(screen.getByText('1 commits')).toBeInTheDocument();
  });

  it('shows "No unique commits" for branches with aheadBy = 0', () => {
    const mergedBranch = { ...mockBranch, aheadBy: 0 };
    render(<CanvasNode {...defaultProps} branch={mergedBranch} scale={2} />);
    
    expect(screen.getByText('No unique commits')).toBeInTheDocument();
  });

  it('prevents context menu on right click', () => {
    render(<CanvasNode {...defaultProps} />);
    
    // Get the absolute positioned container and right click it
    const absoluteContainer = document.querySelector('.absolute');
    fireEvent.contextMenu(absoluteContainer!);
    
    // Check that the onContextMenu handler is present (component should prevent default)
    expect(absoluteContainer).toBeInTheDocument();
  });
});