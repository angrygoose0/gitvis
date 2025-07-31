'use client';

/**
 * GitHub Data Management Hook
 * Orchestrates data fetching, manages loading states, error handling, and implements caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { GitHubApiService, createGitHubApiService, GitHubApiError } from '../services/github-api';
import { calculateBranchTree } from '../services/branch-analyzer';
import { PullRequest, Issue, Branch, Collaborator, BranchConnection } from '../types/github';

export interface GitHubDataConfig {
  owner: string;
  repo: string;
  githubToken?: string;
}

export interface GitHubDataState {
  branches: Branch[];
  pullRequests: PullRequest[];
  issues: Issue[];
  collaborators: Collaborator[];
  connections: BranchConnection[];
  defaultBranch: string;
  repositoryInfo: {
    name: string;
    full_name: string;
    default_branch: string;
    private: boolean;
    description?: string;
  } | null;
}

export interface LoadingState {
  isLoading: boolean;
  progress: {
    current: number;
    total: number;
    stage: string;
  };
  loadingCommits: Set<string>;
}

export interface ErrorState {
  error: string | null;
  rateLimitExceeded: boolean;
  retryCount: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface DataCache {
  branches?: CacheEntry<Branch[]>;
  pullRequests?: CacheEntry<PullRequest[]>;
  issues?: CacheEntry<Issue[]>;
  collaborators?: CacheEntry<Collaborator[]>;
  repositoryInfo?: CacheEntry<GitHubDataState['repositoryInfo']>;
  commits?: Record<string, CacheEntry<Branch['commits']>>;
}

export interface UseGitHubDataReturn {
  // Data
  data: GitHubDataState;
  
  // Loading states
  loading: LoadingState;
  
  // Error states
  error: ErrorState;
  
  // Actions
  refetch: () => Promise<void>;
  fetchBranchCommits: (branchName: string) => Promise<void>;
  createPullRequest: (data: {
    title: string;
    head: string;
    base: string;
    body?: string;
    draft?: boolean;
  }) => Promise<PullRequest>;
  createBranch: (branchName: string, sha: string) => Promise<void>;
  clearCache: () => void;
  retryAfterRateLimit: () => Promise<void>;
}

const CACHE_TTL = {
  branches: 5 * 60 * 1000, // 5 minutes
  pullRequests: 2 * 60 * 1000, // 2 minutes
  issues: 5 * 60 * 1000, // 5 minutes
  collaborators: 30 * 60 * 1000, // 30 minutes
  repositoryInfo: 60 * 60 * 1000, // 1 hour
  commits: 10 * 60 * 1000, // 10 minutes
};

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 1000; // 1 second base delay

export function useGitHubData(config: GitHubDataConfig): UseGitHubDataReturn {
  // State management
  const [data, setData] = useState<GitHubDataState>({
    branches: [],
    pullRequests: [],
    issues: [],
    collaborators: [],
    connections: [],
    defaultBranch: 'main',
    repositoryInfo: null,
  });

  const [loading, setLoading] = useState<LoadingState>({
    isLoading: false,
    progress: { current: 0, total: 0, stage: '' },
    loadingCommits: new Set(),
  });

  const [error, setError] = useState<ErrorState>({
    error: null,
    rateLimitExceeded: false,
    retryCount: 0,
  });

  // Refs for caching and API service
  const cacheRef = useRef<DataCache>({});
  const apiServiceRef = useRef<GitHubApiService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize API service
  useEffect(() => {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Canvas-App',
    };

    if (config.githubToken) {
      headers['Authorization'] = `token ${config.githubToken}`;
    }

    apiServiceRef.current = createGitHubApiService({
      owner: config.owner,
      repo: config.repo,
      headers,
    });
  }, [config.owner, config.repo, config.githubToken]);

  // Cache utilities
  const isCacheValid = useCallback(<T>(entry: CacheEntry<T> | undefined): boolean => {
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }, []);

  const setCacheEntry = useCallback(<T>(key: keyof DataCache, data: T, ttl: number) => {
    cacheRef.current[key] = {
      data,
      timestamp: Date.now(),
      ttl,
    } as any;
  }, []);

  const getCacheEntry = useCallback(<T>(key: keyof DataCache): T | null => {
    const entry = cacheRef.current[key] as CacheEntry<T> | undefined;
    return isCacheValid(entry) ? entry!.data : null;
  }, [isCacheValid]);

  // Error handling utilities
  const handleApiError = useCallback((apiError: unknown, context: string) => {
    if (apiError instanceof GitHubApiError) {
      setError(prev => ({
        error: `${context}: ${apiError.message}`,
        rateLimitExceeded: apiError.rateLimitExceeded || false,
        retryCount: apiError.rateLimitExceeded ? 0 : prev.retryCount + 1,
      }));
    } else {
      setError(prev => ({
        error: `${context}: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`,
        rateLimitExceeded: false,
        retryCount: prev.retryCount + 1,
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setError({ error: null, rateLimitExceeded: false, retryCount: 0 });
  }, []);

  // Progress tracking
  const updateProgress = useCallback((current: number, total: number, stage: string) => {
    setLoading(prev => ({
      ...prev,
      progress: { current, total, stage },
    }));
  }, []);

  // Fetch repository info
  const fetchRepositoryInfo = useCallback(async (): Promise<GitHubDataState['repositoryInfo']> => {
    const cached = getCacheEntry<GitHubDataState['repositoryInfo']>('repositoryInfo');
    if (cached) return cached;

    if (!apiServiceRef.current) throw new Error('API service not initialized');

    const repoInfo = await apiServiceRef.current.getRepositoryInfo();
    setCacheEntry('repositoryInfo', repoInfo, CACHE_TTL.repositoryInfo);
    return repoInfo;
  }, [getCacheEntry, setCacheEntry]);

  // Fetch branches
  const fetchBranches = useCallback(async (): Promise<Branch[]> => {
    const cached = getCacheEntry<Branch[]>('branches');
    if (cached) return cached;

    if (!apiServiceRef.current) throw new Error('API service not initialized');

    const branches = await apiServiceRef.current.getBranches();
    setCacheEntry('branches', branches, CACHE_TTL.branches);
    return branches;
  }, [getCacheEntry, setCacheEntry]);

  // Fetch pull requests
  const fetchPullRequests = useCallback(async (): Promise<PullRequest[]> => {
    const cached = getCacheEntry<PullRequest[]>('pullRequests');
    if (cached) return cached;

    if (!apiServiceRef.current) throw new Error('API service not initialized');

    const pullRequests = await apiServiceRef.current.getPullRequests();
    setCacheEntry('pullRequests', pullRequests, CACHE_TTL.pullRequests);
    return pullRequests;
  }, [getCacheEntry, setCacheEntry]);

  // Fetch issues
  const fetchIssues = useCallback(async (): Promise<Issue[]> => {
    const cached = getCacheEntry<Issue[]>('issues');
    if (cached) return cached;

    if (!apiServiceRef.current) throw new Error('API service not initialized');

    const issues = await apiServiceRef.current.getIssues();
    setCacheEntry('issues', issues, CACHE_TTL.issues);
    return issues;
  }, [getCacheEntry, setCacheEntry]);

  // Fetch collaborators
  const fetchCollaborators = useCallback(async (): Promise<Collaborator[]> => {
    const cached = getCacheEntry<Collaborator[]>('collaborators');
    if (cached) return cached;

    if (!apiServiceRef.current) throw new Error('API service not initialized');

    const collaborators = await apiServiceRef.current.getCollaborators();
    setCacheEntry('collaborators', collaborators, CACHE_TTL.collaborators);
    return collaborators;
  }, [getCacheEntry, setCacheEntry]);

  // Fetch commits for a specific branch
  const fetchBranchCommits = useCallback(async (branchName: string): Promise<void> => {
    // Check cache first
    const cacheKey = `commits.${branchName}`;
    const cached = cacheRef.current.commits?.[branchName];
    if (isCacheValid(cached)) {
      // Update branch with cached commits
      setData(prev => ({
        ...prev,
        branches: prev.branches.map(branch =>
          branch.name === branchName
            ? { ...branch, commits: cached!.data }
            : branch
        ),
      }));
      return;
    }

    if (!apiServiceRef.current) throw new Error('API service not initialized');

    // Add to loading set
    setLoading(prev => ({
      ...prev,
      loadingCommits: new Set([...prev.loadingCommits, branchName]),
    }));

    try {
      const commits = await apiServiceRef.current.getCommits(branchName, 50);
      
      // Cache the commits
      if (!cacheRef.current.commits) {
        cacheRef.current.commits = {};
      }
      cacheRef.current.commits[branchName] = {
        data: commits,
        timestamp: Date.now(),
        ttl: CACHE_TTL.commits,
      };

      // Update branch with commits
      setData(prev => ({
        ...prev,
        branches: prev.branches.map(branch =>
          branch.name === branchName
            ? { ...branch, commits }
            : branch
        ),
      }));
    } catch (err) {
      handleApiError(err, `Failed to fetch commits for branch ${branchName}`);
    } finally {
      // Remove from loading set
      setLoading(prev => ({
        ...prev,
        loadingCommits: new Set([...prev.loadingCommits].filter(name => name !== branchName)),
      }));
    }
  }, [isCacheValid, handleApiError]);

  // Main data fetching function
  const fetchAllData = useCallback(async () => {
    if (!apiServiceRef.current) return;

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(prev => ({ ...prev, isLoading: true }));
    clearError();

    try {
      const totalSteps = 5;
      let currentStep = 0;

      // Step 1: Repository info
      updateProgress(++currentStep, totalSteps, 'Fetching repository info...');
      const repositoryInfo = await fetchRepositoryInfo();

      // Step 2: Branches
      updateProgress(++currentStep, totalSteps, 'Fetching branches...');
      const branches = await fetchBranches();

      // Step 3: Pull requests
      updateProgress(++currentStep, totalSteps, 'Fetching pull requests...');
      const pullRequests = await fetchPullRequests();

      // Step 4: Issues
      updateProgress(++currentStep, totalSteps, 'Fetching issues...');
      const issues = await fetchIssues();

      // Step 5: Collaborators and analysis
      updateProgress(++currentStep, totalSteps, 'Analyzing branch relationships...');
      const collaborators = await fetchCollaborators();

      // Analyze branch relationships
      const { branches: enhancedBranches, connections } = await calculateBranchTree(
        branches,
        config.owner,
        config.repo,
        repositoryInfo?.default_branch || 'main',
        apiServiceRef.current ? {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-Canvas-App',
          ...(config.githubToken ? { 'Authorization': `token ${config.githubToken}` } : {}),
        } : {}
      );

      // Update state with all data
      setData({
        branches: enhancedBranches,
        pullRequests,
        issues,
        collaborators,
        connections,
        defaultBranch: repositoryInfo?.default_branch || 'main',
        repositoryInfo,
      });

      updateProgress(totalSteps, totalSteps, 'Complete');
    } catch (err) {
      handleApiError(err, 'Failed to fetch GitHub data');
    } finally {
      setLoading(prev => ({ ...prev, isLoading: false }));
    }
  }, [
    fetchRepositoryInfo,
    fetchBranches,
    fetchPullRequests,
    fetchIssues,
    fetchCollaborators,
    updateProgress,
    clearError,
    handleApiError,
  ]);

  // Create pull request
  const createPullRequest = useCallback(async (prData: {
    title: string;
    head: string;
    base: string;
    body?: string;
    draft?: boolean;
  }): Promise<PullRequest> => {
    if (!apiServiceRef.current) throw new Error('API service not initialized');

    try {
      const pullRequest = await apiServiceRef.current.createPullRequest(prData);
      
      // Invalidate pull requests cache
      delete cacheRef.current.pullRequests;
      
      // Update state immediately
      setData(prev => ({
        ...prev,
        pullRequests: [...prev.pullRequests, pullRequest],
      }));

      return pullRequest;
    } catch (err) {
      handleApiError(err, 'Failed to create pull request');
      throw err;
    }
  }, [handleApiError]);

  // Create branch
  const createBranch = useCallback(async (branchName: string, sha: string): Promise<void> => {
    if (!apiServiceRef.current) throw new Error('API service not initialized');

    try {
      await apiServiceRef.current.createBranch(branchName, sha);
      
      // Invalidate branches cache
      delete cacheRef.current.branches;
      
      // Refetch data to get the new branch
      await fetchAllData();
    } catch (err) {
      handleApiError(err, 'Failed to create branch');
      throw err;
    }
  }, [handleApiError, fetchAllData]);

  // Retry after rate limit
  const retryAfterRateLimit = useCallback(async (): Promise<void> => {
    if (error.retryCount >= MAX_RETRY_COUNT) {
      setError(prev => ({ ...prev, error: 'Maximum retry attempts exceeded' }));
      return;
    }

    const delay = RETRY_DELAY * Math.pow(2, error.retryCount); // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    
    await fetchAllData();
  }, [error.retryCount, fetchAllData]);

  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current = {};
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [config.owner, config.repo, config.githubToken]);

  return {
    data,
    loading,
    error,
    refetch: fetchAllData,
    fetchBranchCommits,
    createPullRequest,
    createBranch,
    clearCache,
    retryAfterRateLimit,
  };
}