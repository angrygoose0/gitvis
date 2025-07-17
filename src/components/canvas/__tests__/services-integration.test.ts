/**
 * Integration tests for service layer interactions
 * Tests data flow between GitHub API service and branch analyzer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBranches, fetchPullRequests, fetchIssues } from '../services/github-api';
import { calculateBranchTree } from '../services/branch-analyzer';
import { Branch, PullRequest } from '../types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Services Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GitHub API Service Integration', () => {
    it('should fetch and process branches correctly', async () => {
      const mockBranchesResponse = [
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
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBranchesResponse),
        headers: new Headers({ 'link': '' }),
      });

      const result = await fetchBranches('test', 'repo');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test/repo/branches?per_page=100&page=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          }),
        })
      );

      expect(result).toEqual({
        data: mockBranchesResponse,
        hasMore: false,
        rateLimitExceeded: false,
      });
    });

    it('should handle pagination correctly', async () => {
      const firstPageResponse = [
        { name: 'branch-1', commit: { sha: 'sha1', url: 'url1' }, protected: false },
      ];
      const secondPageResponse = [
        { name: 'branch-2', commit: { sha: 'sha2', url: 'url2' }, protected: false },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(firstPageResponse),
          headers: new Headers({
            'link': '<https://api.github.com/repos/test/repo/branches?page=2>; rel="next"',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(secondPageResponse),
          headers: new Headers({ 'link': '' }),
        });

      // Fetch first page
      const firstResult = await fetchBranches('test', 'repo', undefined, 1);
      expect(firstResult.hasMore).toBe(true);
      expect(firstResult.data).toEqual(firstPageResponse);

      // Fetch second page
      const secondResult = await fetchBranches('test', 'repo', undefined, 2);
      expect(secondResult.hasMore).toBe(false);
      expect(secondResult.data).toEqual(secondPageResponse);
    });

    it('should handle rate limiting correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          message: 'API rate limit exceeded',
        }),
      });

      const result = await fetchBranches('test', 'repo');
      
      expect(result.rateLimitExceeded).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should fetch pull requests with correct filtering', async () => {
      const mockPRs: PullRequest[] = [
        {
          id: 1,
          number: 123,
          title: 'Test PR',
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPRs),
        headers: new Headers({ 'link': '' }),
      });

      const result = await fetchPullRequests('test', 'repo');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test/repo/pulls?state=open&per_page=100&page=1',
        expect.any(Object)
      );

      expect(result.data).toEqual(mockPRs);
    });

    it('should handle authentication with GitHub token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Headers({ 'link': '' }),
      });

      await fetchBranches('test', 'repo', 'test-token');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('Branch Analyzer Integration', () => {
    it('should calculate branch tree from API data', () => {
      const branches: Branch[] = [
        {
          name: 'main',
          commit: { sha: 'abc123', url: 'url1' },
          protected: true,
          depth: 0,
          aheadBy: 0,
        },
        {
          name: 'feature-1',
          commit: { sha: 'def456', url: 'url2' },
          protected: false,
          depth: 1,
          aheadBy: 3,
          parent: 'main',
        },
        {
          name: 'feature-2',
          commit: { sha: 'ghi789', url: 'url3' },
          protected: false,
          depth: 1,
          aheadBy: 2,
          parent: 'main',
        },
        {
          name: 'sub-feature',
          commit: { sha: 'jkl012', url: 'url4' },
          protected: false,
          depth: 2,
          aheadBy: 1,
          parent: 'feature-1',
        },
      ];

      const result = calculateBranchTree(branches);
      
      // Should maintain all branches
      expect(result).toHaveLength(4);
      
      // Should set up parent-child relationships
      const mainBranch = result.find(b => b.name === 'main');
      expect(mainBranch?.children).toContain('feature-1');
      expect(mainBranch?.children).toContain('feature-2');
      
      const feature1Branch = result.find(b => b.name === 'feature-1');
      expect(feature1Branch?.children).toContain('sub-feature');
      expect(feature1Branch?.parent).toBe('main');
      
      const subFeatureBranch = result.find(b => b.name === 'sub-feature');
      expect(subFeatureBranch?.parent).toBe('feature-1');
      expect(subFeatureBranch?.depth).toBe(2);
    });

    it('should handle branches without clear parent relationships', () => {
      const branches: Branch[] = [
        {
          name: 'main',
          commit: { sha: 'abc123', url: 'url1' },
          protected: true,
          depth: 0,
          aheadBy: 0,
        },
        {
          name: 'orphan-branch',
          commit: { sha: 'def456', url: 'url2' },
          protected: false,
          depth: 0,
          aheadBy: 5,
        },
      ];

      const result = calculateBranchTree(branches);
      
      expect(result).toHaveLength(2);
      
      // Orphan branch should not have a parent
      const orphanBranch = result.find(b => b.name === 'orphan-branch');
      expect(orphanBranch?.parent).toBeUndefined();
      expect(orphanBranch?.depth).toBe(0);
    });

    it('should calculate connections between branches', () => {
      const branches: Branch[] = [
        {
          name: 'main',
          commit: { sha: 'abc123', url: 'url1' },
          protected: true,
          depth: 0,
          aheadBy: 0,
          children: ['feature-1'],
        },
        {
          name: 'feature-1',
          commit: { sha: 'def456', url: 'url2' },
          protected: false,
          depth: 1,
          aheadBy: 3,
          parent: 'main',
        },
      ];

      const pullRequests: PullRequest[] = [
        {
          id: 1,
          number: 123,
          title: 'Test PR',
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

      // This would be called by the useGitHubData hook to create connections
      const connections = branches
        .filter(branch => branch.parent)
        .map(branch => ({
          from: branch.name,
          to: branch.parent!,
          pullRequest: pullRequests.find(pr => 
            pr.head.ref === branch.name && pr.base.ref === branch.parent
          ),
          commitCount: branch.aheadBy || 0,
        }));

      expect(connections).toHaveLength(1);
      expect(connections[0]).toEqual({
        from: 'feature-1',
        to: 'main',
        pullRequest: pullRequests[0],
        commitCount: 3,
      });
    });
  });

  describe('Service Error Handling Integration', () => {
    it('should handle network errors across all services', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const branchResult = await fetchBranches('test', 'repo');
      expect(branchResult.data).toEqual([]);
      expect(branchResult.rateLimitExceeded).toBe(false);

      const prResult = await fetchPullRequests('test', 'repo');
      expect(prResult.data).toEqual([]);

      const issueResult = await fetchIssues('test', 'repo');
      expect(issueResult.data).toEqual([]);
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
        headers: new Headers({ 'link': '' }),
      });

      const result = await fetchBranches('test', 'repo');
      expect(result.data).toEqual([]);
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      const result = await fetchBranches('test', 'repo');
      expect(result.data).toEqual([]);
      expect(result.rateLimitExceeded).toBe(false);
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain data consistency between services', async () => {
      const branches = [
        { name: 'main', commit: { sha: 'abc123', url: 'url1' }, protected: true },
        { name: 'feature-1', commit: { sha: 'def456', url: 'url2' }, protected: false },
      ];

      const pullRequests = [
        {
          id: 1,
          number: 123,
          title: 'Test PR',
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

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(branches),
          headers: new Headers({ 'link': '' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(pullRequests),
          headers: new Headers({ 'link': '' }),
        });

      const branchResult = await fetchBranches('test', 'repo');
      const prResult = await fetchPullRequests('test', 'repo');

      // Verify data consistency
      const branchNames = branchResult.data.map(b => b.name);
      const prBranches = [
        ...prResult.data.map(pr => pr.head.ref),
        ...prResult.data.map(pr => pr.base.ref),
      ];

      // All PR branches should exist in branch list
      prBranches.forEach(branchName => {
        expect(branchNames).toContain(branchName);
      });

      // SHAs should match
      const mainBranch = branchResult.data.find(b => b.name === 'main');
      const prBaseSha = prResult.data[0].base.sha;
      expect(mainBranch?.commit.sha).toBe(prBaseSha);
    });
  });
});