/**
 * Integration test for useGitHubData hook
 * Tests the hook with actual implementation (no complex mocking)
 */

import { renderHook } from '@testing-library/react';
import { useGitHubData } from '../useGitHubData';

describe('useGitHubData Integration', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() =>
      useGitHubData({ owner: 'test-owner', repo: 'test-repo' })
    );

    // Check initial state structure
    expect(result.current.data).toBeDefined();
    expect(result.current.loading).toBeDefined();
    expect(result.current.error).toBeDefined();
    
    // Check data structure
    expect(result.current.data.branches).toEqual([]);
    expect(result.current.data.pullRequests).toEqual([]);
    expect(result.current.data.issues).toEqual([]);
    expect(result.current.data.collaborators).toEqual([]);
    expect(result.current.data.connections).toEqual([]);
    expect(result.current.data.defaultBranch).toBe('main');
    expect(result.current.data.repositoryInfo).toBeNull();
    
    // Check loading structure
    expect(result.current.loading.isLoading).toBe(true);
    expect(result.current.loading.progress).toBeDefined();
    expect(result.current.loading.progress.current).toBeGreaterThanOrEqual(0);
    expect(result.current.loading.progress.total).toBeGreaterThanOrEqual(0);
    expect(typeof result.current.loading.progress.stage).toBe('string');
    expect(result.current.loading.loadingCommits).toBeInstanceOf(Set);
    expect(result.current.loading.loadingCommits.size).toBe(0);
    
    // Check error structure
    expect(result.current.error.error).toBeNull();
    expect(result.current.error.rateLimitExceeded).toBe(false);
    expect(result.current.error.retryCount).toBe(0);
    
    // Check methods are available
    expect(typeof result.current.refetch).toBe('function');
    expect(typeof result.current.fetchBranchCommits).toBe('function');
    expect(typeof result.current.createPullRequest).toBe('function');
    expect(typeof result.current.createBranch).toBe('function');
    expect(typeof result.current.clearCache).toBe('function');
    expect(typeof result.current.retryAfterRateLimit).toBe('function');
  });

  it('should handle config changes', () => {
    const { result, rerender } = renderHook(
      ({ owner, repo }) => useGitHubData({ owner, repo }),
      {
        initialProps: { owner: 'test-owner', repo: 'test-repo' }
      }
    );

    expect(result.current.data.branches).toEqual([]);

    // Change config
    rerender({ owner: 'new-owner', repo: 'new-repo' });

    // Should still have correct structure
    expect(result.current.data).toBeDefined();
    expect(result.current.loading).toBeDefined();
    expect(result.current.error).toBeDefined();
  });

  it('should handle GitHub token in config', () => {
    const { result } = renderHook(() =>
      useGitHubData({ 
        owner: 'test-owner', 
        repo: 'test-repo',
        githubToken: 'test-token'
      })
    );

    // Should initialize correctly with token
    expect(result.current.data).toBeDefined();
    expect(result.current.loading.isLoading).toBe(true);
  });

  it('should provide cache management functions', () => {
    const { result } = renderHook(() =>
      useGitHubData({ owner: 'test-owner', repo: 'test-repo' })
    );

    // Should not throw when calling cache functions
    expect(() => result.current.clearCache()).not.toThrow();
  });
});