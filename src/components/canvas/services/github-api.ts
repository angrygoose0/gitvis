/**
 * GitHub API Service
 * Centralized GitHub API integration with proper error handling and rate limiting
 */

import { PullRequest, Issue, Branch, Collaborator } from '../types/github';

export interface GitHubApiConfig {
  owner: string;
  repo: string;
  headers: HeadersInit;
}

export interface GitHubApiError {
  message: string;
  status?: number;
  rateLimitExceeded?: boolean;
}

export interface CompareResult {
  ahead_by: number;
  behind_by: number;
  status: string;
  total_commits: number;
}

export interface RepositoryInfo {
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  description?: string;
}

export interface CommitData {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

/**
 * Rate limiting utility
 */
class RateLimiter {
  private lastRequestTime = 0;
  private readonly minInterval = 50; // Minimum 50ms between requests

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

/**
 * GitHub API Service Class
 */
export class GitHubApiService {
  private rateLimiter = new RateLimiter();
  
  constructor(private config: GitHubApiConfig) {}

  /**
   * Generic fetch wrapper with error handling and rate limiting
   */
  private async fetchWithRateLimit(url: string, options?: RequestInit): Promise<Response> {
    await this.rateLimiter.waitIfNeeded();
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.config.headers,
          ...options?.headers,
        },
      });

      // Check for rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining === '0') {
          throw new GitHubApiError('Rate limit exceeded', 403, true);
        }
      }

      return response;
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo(): Promise<RepositoryInfo> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}`;
    
    try {
      const response = await this.fetchWithRateLimit(url);
      
      if (!response.ok) {
        throw new GitHubApiError(`Failed to fetch repository info: ${response.statusText}`, response.status);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error fetching repository info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all branches with pagination support
   */
  async getBranches(): Promise<Branch[]> {
    try {
      // First, get the total number of branches from the first page
      const firstPageUrl = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/branches?per_page=100&page=1`;
      const firstPageResponse = await this.fetchWithRateLimit(firstPageUrl);
      
      if (!firstPageResponse.ok) {
        throw new GitHubApiError(`Failed to fetch branches: ${firstPageResponse.statusText}`, firstPageResponse.status);
      }

      const firstPageData = await firstPageResponse.json();
      let allBranches = [...firstPageData];

      // Check if there are more pages
      const linkHeader = firstPageResponse.headers.get('Link');
      if (linkHeader && linkHeader.includes('rel="last"')) {
        // Extract the last page number
        const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
        const totalPages = lastPageMatch ? parseInt(lastPageMatch[1], 10) : 1;

        if (totalPages > 1) {
          // Fetch remaining pages in parallel (with rate limiting)
          const pagePromises = [];
          for (let page = 2; page <= totalPages; page++) {
            const pageUrl = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/branches?per_page=100&page=${page}`;
            pagePromises.push(
              this.fetchWithRateLimit(pageUrl).then(async (response) => {
                if (response.ok) {
                  return await response.json();
                }
                return [];
              })
            );
          }

          const additionalPages = await Promise.all(pagePromises);
          allBranches = allBranches.concat(...additionalPages);
        }
      }

      return allBranches;
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error fetching branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get open pull requests
   */
  async getPullRequests(): Promise<PullRequest[]> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/pulls?state=open&per_page=100`;
    
    try {
      const response = await this.fetchWithRateLimit(url);
      
      if (!response.ok) {
        throw new GitHubApiError(`Failed to fetch pull requests: ${response.statusText}`, response.status);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error fetching pull requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pull request commits
   */
  async getPullRequestCommits(pullRequestNumber: number): Promise<CommitData[]> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/pulls/${pullRequestNumber}/commits`;
    
    try {
      const response = await this.fetchWithRateLimit(url);
      
      if (!response.ok) {
        throw new GitHubApiError(`Failed to fetch PR commits: ${response.statusText}`, response.status);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error fetching PR commits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compare two branches
   */
  async compareBranches(base: string, head: string): Promise<CompareResult> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/compare/${base}...${head}`;
    
    try {
      const response = await this.fetchWithRateLimit(url);
      
      if (!response.ok) {
        throw new GitHubApiError(`Failed to compare branches: ${response.statusText}`, response.status);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error comparing branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get collaborators
   */
  async getCollaborators(): Promise<Collaborator[]> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/collaborators?per_page=10`;
    
    try {
      const response = await this.fetchWithRateLimit(url);
      
      if (!response.ok) {
        throw new GitHubApiError(`Failed to fetch collaborators: ${response.statusText}`, response.status);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error fetching collaborators: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get open issues (excluding pull requests)
   */
  async getIssues(): Promise<Issue[]> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/issues?state=open&per_page=50`;
    
    try {
      const response = await this.fetchWithRateLimit(url);
      
      if (!response.ok) {
        throw new GitHubApiError(`Failed to fetch issues: ${response.statusText}`, response.status);
      }
      
      const issues = await response.json();
      
      // Filter out pull requests (issues with pull_request property)
      return issues.filter((issue: Issue) => !issue.pull_request);
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error fetching issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get commits for a specific branch
   */
  async getCommits(branchName: string, perPage: number = 50): Promise<CommitData[]> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/commits?sha=${branchName}&per_page=${perPage}`;
    
    try {
      const response = await this.fetchWithRateLimit(url);
      
      if (!response.ok) {
        throw new GitHubApiError(`Failed to fetch commits: ${response.statusText}`, response.status);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error fetching commits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new pull request
   */
  async createPullRequest(data: {
    title: string;
    head: string;
    base: string;
    body?: string;
    draft?: boolean;
  }): Promise<PullRequest> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/pulls`;
    
    try {
      const response = await this.fetchWithRateLimit(url, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new GitHubApiError(
          `Failed to create pull request: ${errorData.message || response.statusText}`,
          response.status
        );
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error creating pull request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, sha: string): Promise<void> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/git/refs`;
    
    const data = {
      ref: `refs/heads/${branchName}`,
      sha: sha,
    };
    
    try {
      const response = await this.fetchWithRateLimit(url, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new GitHubApiError(
          `Failed to create branch: ${errorData.message || response.statusText}`,
          response.status
        );
      }
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }
      throw new GitHubApiError(`Error creating branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Custom error class for GitHub API errors
 */
export class GitHubApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public rateLimitExceeded?: boolean
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

/**
 * Factory function to create a GitHub API service instance
 */
export function createGitHubApiService(config: GitHubApiConfig): GitHubApiService {
  return new GitHubApiService(config);
}