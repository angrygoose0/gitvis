/**
 * Integration tests for GitHub API Service
 * These tests verify the service structure and basic functionality
 */

import { describe, it, expect } from 'vitest';
import { GitHubApiService, GitHubApiError, createGitHubApiService } from '../github-api';

describe('GitHubApiService Integration', () => {
  const mockConfig = {
    owner: 'test-owner',
    repo: 'test-repo',
    headers: {
      'Authorization': 'token test-token',
      'Accept': 'application/vnd.github.v3+json',
    },
  };

  it('should create a service instance with factory function', () => {
    const service = createGitHubApiService(mockConfig);
    expect(service).toBeInstanceOf(GitHubApiService);
  });

  it('should create a service instance directly', () => {
    const service = new GitHubApiService(mockConfig);
    expect(service).toBeInstanceOf(GitHubApiService);
  });

  it('should have all required methods', () => {
    const service = new GitHubApiService(mockConfig);
    
    // Verify all required methods exist
    expect(typeof service.getRepositoryInfo).toBe('function');
    expect(typeof service.getBranches).toBe('function');
    expect(typeof service.getPullRequests).toBe('function');
    expect(typeof service.getPullRequestCommits).toBe('function');
    expect(typeof service.compareBranches).toBe('function');
    expect(typeof service.getCollaborators).toBe('function');
    expect(typeof service.getIssues).toBe('function');
    expect(typeof service.getCommits).toBe('function');
    expect(typeof service.createPullRequest).toBe('function');
    expect(typeof service.createBranch).toBe('function');
  });

  it('should create GitHubApiError instances correctly', () => {
    const error = new GitHubApiError('Test error', 404, false);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error.message).toBe('Test error');
    expect(error.status).toBe(404);
    expect(error.rateLimitExceeded).toBe(false);
    expect(error.name).toBe('GitHubApiError');
  });

  it('should create GitHubApiError with rate limit flag', () => {
    const error = new GitHubApiError('Rate limit exceeded', 403, true);
    expect(error.rateLimitExceeded).toBe(true);
  });
});