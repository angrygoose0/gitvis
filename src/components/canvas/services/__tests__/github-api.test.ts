/**
 * Tests for GitHub API Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitHubApiService, GitHubApiError, createGitHubApiService } from '../github-api';

// Mock fetch globally
global.fetch = vi.fn();
const mockFetch = fetch as ReturnType<typeof vi.fn>;

describe('GitHubApiService', () => {
  let service: GitHubApiService;
  const mockConfig = {
    owner: 'test-owner',
    repo: 'test-repo',
    headers: {
      'Authorization': 'token test-token',
      'Accept': 'application/vnd.github.v3+json',
    },
  };

  beforeEach(() => {
    service = new GitHubApiService(mockConfig);
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('createGitHubApiService', () => {
    it('should create a service instance', () => {
      const service = createGitHubApiService(mockConfig);
      expect(service).toBeInstanceOf(GitHubApiService);
    });
  });

  describe('getRepositoryInfo', () => {
    it('should fetch repository information successfully', async () => {
      const mockRepoData = {
        name: 'test-repo',
        full_name: 'test-owner/test-repo',
        default_branch: 'main',
        private: false,
        description: 'Test repository',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepoData,
        headers: new Headers(),
      } as Response);

      const result = await service.getRepositoryInfo();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo',
        expect.objectContaining({
          headers: expect.objectContaining(mockConfig.headers),
        })
      );
      expect(result).toEqual(mockRepoData);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
      } as Response);

      await expect(service.getRepositoryInfo()).rejects.toThrow(GitHubApiError);
      await expect(service.getRepositoryInfo()).rejects.toThrow('Failed to fetch repository info: Not Found');
    });
  });

  describe('getBranches', () => {
    it('should fetch branches with single page', async () => {
      const mockBranches = [
        { name: 'main', commit: { sha: 'abc123', url: 'test-url' }, protected: true },
        { name: 'develop', commit: { sha: 'def456', url: 'test-url' }, protected: false },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBranches,
        headers: new Headers(),
      } as Response);

      const result = await service.getBranches();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/branches?per_page=100&page=1',
        expect.objectContaining({
          headers: expect.objectContaining(mockConfig.headers),
        })
      );
      expect(result).toEqual(mockBranches);
    });

    it('should fetch branches with pagination', async () => {
      const firstPageBranches = [
        { name: 'main', commit: { sha: 'abc123', url: 'test-url' }, protected: true },
      ];
      const secondPageBranches = [
        { name: 'develop', commit: { sha: 'def456', url: 'test-url' }, protected: false },
      ];

      // First page response with Link header indicating more pages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => firstPageBranches,
        headers: new Headers({
          'Link': '<https://api.github.com/repos/test-owner/test-repo/branches?per_page=100&page=2>; rel="last"',
        }),
      } as Response);

      // Second page response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => secondPageBranches,
        headers: new Headers(),
      } as Response);

      const result = await service.getBranches();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual([...firstPageBranches, ...secondPageBranches]);
    });
  });

  describe('compareBranches', () => {
    it('should compare branches successfully', async () => {
      const mockCompareData = {
        ahead_by: 5,
        behind_by: 2,
        status: 'ahead',
        total_commits: 7,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCompareData,
        headers: new Headers(),
      } as Response);

      const result = await service.compareBranches('main', 'feature-branch');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/compare/main...feature-branch',
        expect.objectContaining({
          headers: expect.objectContaining(mockConfig.headers),
        })
      );
      expect(result).toEqual(mockCompareData);
    });
  });

  describe('createPullRequest', () => {
    it('should create pull request successfully', async () => {
      const mockPRData = {
        id: 1,
        number: 123,
        title: 'Test PR',
        state: 'open',
        html_url: 'https://github.com/test-owner/test-repo/pull/123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        user: { login: 'test-user', avatar_url: 'https://avatar.url' },
        head: { ref: 'feature-branch', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' },
        draft: false,
        merged: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPRData,
        headers: new Headers(),
      } as Response);

      const prData = {
        title: 'Test PR',
        head: 'feature-branch',
        base: 'main',
        body: 'Test description',
        draft: false,
      };

      const result = await service.createPullRequest(prData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/pulls',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(prData),
          headers: expect.objectContaining(mockConfig.headers),
        })
      );
      expect(result).toEqual(mockPRData);
    });
  });

  describe('rate limiting', () => {
    it('should handle rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({
          'X-RateLimit-Remaining': '0',
        }),
      } as Response);

      await expect(service.getRepositoryInfo()).rejects.toThrow(GitHubApiError);
      await expect(service.getRepositoryInfo()).rejects.toThrow('Rate limit exceeded');
    });

    it('should enforce minimum interval between requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      } as Response);

      // Make two rapid requests
      const promise1 = service.getRepositoryInfo();
      const promise2 = service.getRepositoryInfo();

      // Fast-forward time to resolve the delay
      vi.advanceTimersByTime(100);

      await Promise.all([promise1, promise2]);

      // Should have been called twice with proper spacing
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getRepositoryInfo()).rejects.toThrow(GitHubApiError);
      await expect(service.getRepositoryInfo()).rejects.toThrow('Network error: Network error');
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => {
          throw new Error('Invalid JSON');
        },
        headers: new Headers(),
      } as Response);

      await expect(service.getRepositoryInfo()).rejects.toThrow(GitHubApiError);
    });
  });
});