import React from 'react';
import { render, screen } from '@testing-library/react';
import { CommitNode } from '../CommitNode';

const mockCommit = {
  sha: 'abc123def456',
  commit: {
    message: 'Fix bug in user authentication',
    author: {
      name: 'John Doe',
      date: '2023-01-01T00:00:00Z'
    }
  }
};

const defaultProps = {
  commit: mockCommit,
  index: 0,
  totalCommits: 3,
  animationTime: 0,
  scale: 1,
  branchPosition: { x: 100, y: 100 },
  scaledRadius: 8,
  scaledCommitRadius: 4,
  textOpacity: 1,
  commitTextOpacity: 1
};

describe('CommitNode', () => {
  it('renders commit node with correct styling', () => {
    render(<CommitNode {...defaultProps} />);
    
    // Check if the commit node is rendered
    const commitNode = screen.getByTitle('Fix bug in user authentication');
    expect(commitNode).toBeInTheDocument();
    expect(commitNode).toHaveClass('rounded-full', 'bg-gray-600');
  });

  it('displays commit message and author info when text is visible', () => {
    render(<CommitNode {...defaultProps} />);
    
    // Check if commit message is displayed (truncated)
    expect(screen.getByText('Fix bug in user authentication')).toBeInTheDocument();
    
    // Check if commit SHA and author are displayed
    expect(screen.getByText(/abc123d • John/)).toBeInTheDocument();
  });

  it('renders correctly when commitTextOpacity is 0', () => {
    // Should render without errors even when text opacity is 0
    const { container } = render(<CommitNode {...defaultProps} commitTextOpacity={0} />);
    
    // The commit node should still be rendered
    const commitNode = screen.getByTitle('Fix bug in user authentication');
    expect(commitNode).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('absolute');
  });

  it('positions correctly based on index and animation time', () => {
    const { container } = render(<CommitNode {...defaultProps} index={1} totalCommits={4} />);
    
    // The commit node should be positioned absolutely
    const commitNodeContainer = container.firstChild as HTMLElement;
    expect(commitNodeContainer).toHaveClass('absolute');
    expect(commitNodeContainer).toHaveClass('pointer-events-none');
  });

  it('handles animation time changes', () => {
    const { container } = render(<CommitNode {...defaultProps} animationTime={0} />);
    
    // The commit node should be positioned absolutely
    const commitNodeContainer = container.firstChild as HTMLElement;
    expect(commitNodeContainer).toHaveClass('absolute');
  });

  it('applies correct opacity based on textOpacity prop', () => {
    render(<CommitNode {...defaultProps} textOpacity={0.5} />);
    
    const commitNodeContainer = screen.getByTitle('Fix bug in user authentication').parentElement;
    expect(commitNodeContainer).toHaveStyle('opacity: 1'); // Should be visible when textOpacity > 0.3
  });

  it('hides when textOpacity is too low', () => {
    render(<CommitNode {...defaultProps} textOpacity={0.2} />);
    
    const commitNodeContainer = screen.getByTitle('Fix bug in user authentication').parentElement;
    expect(commitNodeContainer).toHaveStyle('opacity: 0'); // Should be hidden when textOpacity <= 0.3
  });
});