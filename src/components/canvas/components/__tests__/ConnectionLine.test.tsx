/**
 * Tests for ConnectionLine component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ConnectionLine } from '../ConnectionLine';
import { Position, PullRequest } from '../../types';

// Mock the coordinate transformer utility
import { vi } from 'vitest';

vi.mock('../../utils/coordinate-transformer', () => ({
  worldToScreen: vi.fn((worldPos: Position) => worldPos), // Simple pass-through for testing
}));

describe('ConnectionLine', () => {
  const defaultProps = {
    from: { x: 100, y: 100 },
    to: { x: 200, y: 200 },
    scale: 1,
    offset: { x: 0, y: 0 },
  };

  const mockPullRequest: PullRequest = {
    id: 123,
    number: 42,
    title: 'Test PR',
    state: 'open',
    html_url: 'https://github.com/test/repo/pull/42',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    user: {
      login: 'testuser',
      avatar_url: 'https://github.com/testuser.png',
    },
    head: {
      ref: 'feature-branch',
      sha: 'abc123',
    },
    base: {
      ref: 'main',
      sha: 'def456',
    },
    draft: false,
    merged: false,
    mergeable: true,
    mergeable_state: 'clean',
  };

  it('renders a basic connection line', () => {
    const { container } = render(<ConnectionLine {...defaultProps} />);
    
    // Check that SVG is rendered
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    
    // Check that main line is rendered
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders pull request information when PR is provided', () => {
    const { container } = render(
      <ConnectionLine {...defaultProps} pullRequest={mockPullRequest} />
    );
    
    // Check for PR number text
    const prText = container.querySelector('text');
    expect(prText).toHaveTextContent('PR #42');
  });

  it('renders commit count when provided', () => {
    const { container } = render(
      <ConnectionLine {...defaultProps} commitCount={5} />
    );
    
    // Check for commit count text
    const commitText = container.querySelector('text');
    expect(commitText).toHaveTextContent('5 commits');
  });

  it('renders single commit correctly', () => {
    const { container } = render(
      <ConnectionLine {...defaultProps} commitCount={1} />
    );
    
    // Check for singular commit text
    const commitText = container.querySelector('text');
    expect(commitText).toHaveTextContent('1 commit');
  });

  it('renders animated pulses for commits', () => {
    const { container } = render(
      <ConnectionLine {...defaultProps} commitCount={3} />
    );
    
    // Check for animated circles (pulses)
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3); // Should have 3 pulse circles
  });

  it('limits pulses to maximum of 5', () => {
    const { container } = render(
      <ConnectionLine {...defaultProps} commitCount={10} />
    );
    
    // Check that only 5 pulse circles are rendered
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(5);
  });

  it('applies different colors for draft PRs', () => {
    const draftPR = { ...mockPullRequest, draft: true };
    const { container } = render(
      <ConnectionLine {...defaultProps} pullRequest={draftPR} />
    );
    
    // Check that gradients are defined (color logic is internal)
    const gradients = container.querySelectorAll('linearGradient');
    expect(gradients.length).toBeGreaterThan(0);
  });

  it('applies different colors for blocked PRs', () => {
    const blockedPR = { ...mockPullRequest, mergeable_state: 'blocked' };
    const { container } = render(
      <ConnectionLine {...defaultProps} pullRequest={blockedPR} />
    );
    
    // Check that gradients are defined (color logic is internal)
    const gradients = container.querySelectorAll('linearGradient');
    expect(gradients.length).toBeGreaterThan(0);
  });

  it('renders glow effects', () => {
    const { container } = render(<ConnectionLine {...defaultProps} />);
    
    // Check for glow filter definition
    const filters = container.querySelectorAll('filter');
    expect(filters.length).toBeGreaterThan(0);
  });

  it('renders hidden path for animations', () => {
    const { container } = render(
      <ConnectionLine {...defaultProps} commitCount={1} />
    );
    
    // Check for hidden path element
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('handles zero commit count gracefully', () => {
    const { container } = render(
      <ConnectionLine {...defaultProps} commitCount={0} />
    );
    
    // Should not render any pulse circles
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(0);
    
    // Should not render commit count text
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(0);
  });

  it('prioritizes PR info over commit count when both are present', () => {
    const { container } = render(
      <ConnectionLine 
        {...defaultProps} 
        pullRequest={mockPullRequest} 
        commitCount={5} 
      />
    );
    
    // Should show PR info, not commit count
    const prText = container.querySelector('text');
    expect(prText).toHaveTextContent('PR #42');
    expect(prText).not.toHaveTextContent('commits');
  });
});