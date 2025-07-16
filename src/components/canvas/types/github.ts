/**
 * GitHub-related type definitions
 */

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string; // source branch
    sha: string;
  };
  base: {
    ref: string; // target branch
    sha: string;
  };
  draft: boolean;
  merged: boolean;
  mergeable?: boolean;
  mergeable_state?: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  labels: Array<{
    name: string;
    color: string;
  }>;
  milestone?: {
    title: string;
  };
  comments: number;
  pull_request?: {
    url: string;
  };
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
  parent?: string; // Added parent branch reference
  depth?: number; // Added depth in tree
  children?: string[]; // Added children branches
  mergedAt?: string; // Added merge date
  aheadBy?: number; // Number of commits ahead of parent (0 = not ahead, >0 = ahead, <0 = behind, undefined = unknown)
  commits?: Array<{
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        date: string;
      };
    };
  }>;
}

export interface Collaborator {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  type: string;
  site_admin: boolean;
  permissions?: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
}

export interface BranchConnection {
  from: string;
  to: string;
  pullRequest?: PullRequest; // Added pull request info
  commitCount?: number; // Added commit count for the connection
}