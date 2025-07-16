/**
 * Example component demonstrating useGitHubData hook usage
 */

import React from 'react';
import { useGitHubData } from '../hooks/useGitHubData';

interface GitHubDataExampleProps {
  owner: string;
  repo: string;
  githubToken?: string;
}

export const GitHubDataExample: React.FC<GitHubDataExampleProps> = ({
  owner,
  repo,
  githubToken
}) => {
  const {
    data,
    loading,
    error,
    refetch,
    fetchBranchCommits,
    createPullRequest,
    createBranch,
    clearCache,
    retryAfterRateLimit,
  } = useGitHubData({ owner, repo, githubToken });

  if (loading.isLoading) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Loading GitHub Data...</h2>
        <div className="mb-2">
          Progress: {loading.progress.current}/{loading.progress.total}
        </div>
        <div className="mb-2">Stage: {loading.progress.stage}</div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
            style={{ 
              width: `${loading.progress.total > 0 ? (loading.progress.current / loading.progress.total) * 100 : 0}%` 
            }}
          ></div>
        </div>
      </div>
    );
  }

  if (error.error) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4 text-red-600">Error</h2>
        <p className="text-red-500 mb-4">{error.error}</p>
        {error.rateLimitExceeded && (
          <div className="mb-4">
            <p className="text-yellow-600">Rate limit exceeded. You can retry after waiting.</p>
            <button 
              onClick={retryAfterRateLimit}
              className="mt-2 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Retry After Rate Limit
            </button>
          </div>
        )}
        <button 
          onClick={refetch}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">GitHub Data for {owner}/{repo}</h2>
      
      {/* Repository Info */}
      {data.repositoryInfo && (
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <h3 className="text-lg font-semibold mb-2">Repository Info</h3>
          <p><strong>Name:</strong> {data.repositoryInfo.name}</p>
          <p><strong>Full Name:</strong> {data.repositoryInfo.full_name}</p>
          <p><strong>Default Branch:</strong> {data.repositoryInfo.default_branch}</p>
          <p><strong>Private:</strong> {data.repositoryInfo.private ? 'Yes' : 'No'}</p>
          {data.repositoryInfo.description && (
            <p><strong>Description:</strong> {data.repositoryInfo.description}</p>
          )}
        </div>
      )}

      {/* Branches */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Branches ({data.branches.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.branches.slice(0, 6).map((branch) => (
            <div key={branch.name} className="p-3 border rounded">
              <div className="font-medium">{branch.name}</div>
              <div className="text-sm text-gray-600">
                {branch.commit.sha.substring(0, 7)}
              </div>
              {branch.protected && (
                <span className="inline-block mt-1 px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded">
                  Protected
                </span>
              )}
              {branch.commits && (
                <div className="text-sm text-gray-500 mt-1">
                  {branch.commits.length} commits loaded
                </div>
              )}
              <button
                onClick={() => fetchBranchCommits(branch.name)}
                disabled={loading.loadingCommits.has(branch.name)}
                className="mt-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading.loadingCommits.has(branch.name) ? 'Loading...' : 'Load Commits'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Pull Requests */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Pull Requests ({data.pullRequests.length})
        </h3>
        <div className="space-y-2">
          {data.pullRequests.slice(0, 5).map((pr) => (
            <div key={pr.id} className="p-3 border rounded">
              <div className="font-medium">#{pr.number}: {pr.title}</div>
              <div className="text-sm text-gray-600">
                {pr.head.ref} → {pr.base.ref}
              </div>
              <div className="text-sm text-gray-500">
                by {pr.user.login} • {pr.state}
                {pr.draft && ' • Draft'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issues */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Issues ({data.issues.length})
        </h3>
        <div className="space-y-2">
          {data.issues.slice(0, 5).map((issue) => (
            <div key={issue.id} className="p-3 border rounded">
              <div className="font-medium">#{issue.number}: {issue.title}</div>
              <div className="text-sm text-gray-600">
                by {issue.user.login} • {issue.state}
              </div>
              {issue.labels.length > 0 && (
                <div className="mt-1">
                  {issue.labels.map((label) => (
                    <span
                      key={label.name}
                      className="inline-block mr-1 px-2 py-1 text-xs rounded"
                      style={{ backgroundColor: `#${label.color}`, color: 'white' }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Collaborators */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Collaborators ({data.collaborators.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {data.collaborators.map((collaborator) => (
            <div key={collaborator.id} className="flex items-center p-2 border rounded">
              <img
                src={collaborator.avatar_url}
                alt={collaborator.login}
                className="w-8 h-8 rounded-full mr-2"
              />
              <span className="text-sm">{collaborator.login}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={refetch}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Data
        </button>
        <button
          onClick={clearCache}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Clear Cache
        </button>
      </div>
    </div>
  );
};