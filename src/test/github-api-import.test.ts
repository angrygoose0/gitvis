/**
 * Test to verify GitHub API service can be imported correctly
 */

import { describe, it, expect } from 'vitest';
import { GitHubApiService, GitHubApiError, createGitHubApiService } from '../components/canvas';

describe('GitHub API Service Import', () => {
  it('should import GitHubApiService from canvas module', () => {
    expect(GitHubApiService).toBeDefined();
    expect(typeof GitHubApiService).toBe('function');
  });

  it('should import GitHubApiError from canvas module', () => {
    expect(GitHubApiError).toBeDefined();
    expect(typeof GitHubApiError).toBe('function');
  });

  it('should import createGitHubApiService from canvas module', () => {
    expect(createGitHubApiService).toBeDefined();
    expect(typeof createGitHubApiService).toBe('function');
  });

  it('should create service instance through canvas module import', () => {
    const config = {
      owner: 'test-owner',
      repo: 'test-repo',
      headers: { 'Authorization': 'token test' },
    };
    
    const service = createGitHubApiService(config);
    expect(service).toBeInstanceOf(GitHubApiService);
  });
});