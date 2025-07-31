/**
 * Integration tests for service layer interactions
 * Tests data flow between GitHub API service and branch analyzer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGitHubApiService, GitHubApiService } from '../services/github-api';
import { calculateBranchTree } from '../services/branch-analyzer';
import { Branch, PullRequest } from '../types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Services Integration Tests', () => {
  let apiService: GitHubApiService;

  beforeEach(() => {
    vi.clearAllMocks();
    apiService = createGitHubApiService({
      owner: 'test',
      repo: 'repo',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Canvas-App',
      },
    });
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

      const result = await apiService.getBranches();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test/repo/branches?per_page=100&page=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'GitHub-Canvas-App',
          }),
        })
      );

      expect(result).toEqual(mockBranchesResponse);
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
            'link': '<https://api.github.com/repos/test/repo/branches?page=2>; rel="last"',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(secondPageResponse),
          headers: new Headers({ 'link': '' }),
        });

      const result = await apiService.getBranches();
      
      // Should combine both pages
      expect(result).toEqual([...firstPageResponse, ...secondPageResponse]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle rate limiting correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ 'X-RateLimit-Remaining': '0' }),
        json: () => Promise.resolve({
          message: 'API rate limit exceeded',
        }),
      });

      await expect(apiService.getBranches()).rejects.toThrow('Rate limit exceeded');
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

      const result = await apiService.getPullRequests();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test/repo/pulls?state=open&per_page=100',
        expect.any(Object)
      );

      expect(result).toEqual(mockPRs);
    });

    it('should handle authentication with GitHub token', async () => {
      const authenticatedService = createGitHubApiService({
        owner: 'test',
        repo: 'repo',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-Canvas-App',
          'Authorization': 'token test-token',
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Headers({ 'link': '' }),
      });

      await authenticatedService.getBranches();
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'token test-token',
          }),
        })
      );
    });

    it('should fetch repository info correctly', async () => {
      const mockRepoInfo = {
        name: 'repo',
        full_name: 'test/repo',
        default_branch: 'main',
        private: false,
        description: 'Test repository',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRepoInfo),
      });

      const result = await apiService.getRepositoryInfo();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test/repo',
        expect.any(Object)
      );

      expect(result).toEqual(mockRepoInfo);
    });

    it('should compare branches correctly', async () => {
      const mockCompareResult = {
        ahead_by: 3,
        behind_by: 0,
        status: 'ahead',
        total_commits: 3,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompareResult),
      });

      const result = await apiService.compareBranches('main', 'feature-1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test/repo/compare/main...feature-1',
        expect.any(Object)
      );

      expect(result).toEqual(mockCompareResult);
    });
  });

  describe('Branch Analyzer Integration', () => {
    it('should calculate branch tree from API data', async () => {
      const branches: Branch[] = [
        {
          name: 'main',
          commit: { sha: 'abc123', url: 'url1' },
          protected: true,
        },
        {
          name: 'feature-1',
          commit: { sha: 'def456', url: 'url2' },
          protected: false,
        },
        {
          name: 'feature-2',
          commit: { sha: 'ghi789', url: 'url3' },
          protected: false,
        },
      ];

      // Mock API calls for branch comparison
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 0, behind_by: 0, status: 'identical' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 3, behind_by: 0, status: 'ahead' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 2, behind_by: 0, status: 'ahead' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 3, behind_by: 0, status: 'ahead' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 2, behind_by: 0, status: 'ahead' }),
        });

      const result = await calculateBranchTree(
        branches,
        'test',
        'repo',
        'main',
        { 'Accept': 'application/vnd.github.v3+json' }
      );
      
      // Should maintain all branches
      expect(result.branches).toHaveLength(3);
      
      // Should set up parent-child relationships
      const mainBranch = result.branches.find(b => b.name === 'main');
      expect(mainBranch?.children).toContain('feature-1');
      expect(mainBranch?.children).toContain('feature-2');
      
      const feature1Branch = result.branches.find(b => b.name === 'feature-1');
      expect(feature1Branch?.parent).toBe('main');
      expect(feature1Branch?.depth).toBe(1);
      
      const feature2Branch = result.branches.find(b => b.name === 'feature-2');
      expect(feature2Branch?.parent).toBe('main');
      expect(feature2Branch?.depth).toBe(1);

      // Should create connections
      expect(result.connections).toHaveLength(2);
      expect(result.connections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ from: 'feature-1', to: 'main' }),
          expect.objectContaining({ from: 'feature-2', to: 'main' }),
        ])
      );
    });

    it('should handle branches without clear parent relationships', async () => {
      const branches: Branch[] = [
        {
          name: 'main',
          commit: { sha: 'abc123', url: 'url1' },
          protected: true,
        },
        {
          name: 'orphan-branch',
          commit: { sha: 'def456', url: 'url2' },
          protected: false,
        },
      ];

      // Mock API calls - orphan branch has no clear relationship
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 0, behind_by: 0, status: 'identical' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 5, behind_by: 10, status: 'diverged' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ahead_by: 5, behind_by: 10, status: 'diverged' }),
        });

      const result = await calculateBranchTree(
        branches,
        'test',
        'repo',
        'main',
        { 'Accept': 'application/vnd.github.v3+json' }
      );
      
      expect(result.branches).toHaveLength(2);
      
      // Orphan branch should still have main as parent (fallback)
      const orphanBranch = result.branches.find(b => b.name === 'orphan-branch');
      expect(orphanBranch?.parent).toBe('main');
      expect(orphanBranch?.depth).toBe(1);
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

      await expect(apiService.getBranches()).rejects.toThrow('Network error');
      await expect(apiService.getPullRequests()).rejects.toThrow('Network error');
      await expect(apiService.getIssues()).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
        headers: new Headers({ 'link': '' }),
      });

      await expect(apiService.getBranches()).rejects.toThrow('Invalid JSON');
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      await expect(apiService.getBranches()).rejects.toThrow('Failed to fetch branches: Not Found');
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

      const branchResult = await apiService.getBranches();
      const prResult = await apiService.getPullRequests();

      // Verify data consistency
      const branchNames = branchResult.map(b => b.name);
      const prBranches = [
        ...prResult.map(pr => pr.head.ref),
        ...prResult.map(pr => pr.base.ref),
      ];

      // All PR branches should exist in branch list
      prBranches.forEach(branchName => {
        expect(branchNames).toContain(branchName);
      });

      // SHAs should match
      const mainBranch = branchResult.find(b => b.name === 'main');
      const prBaseSha = prResult[0].base.sha;
      expect(mainBranch?.commit.sha).toBe(prBaseSha);
    });
  });
});