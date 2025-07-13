# Pull Request Visualization Feature

## Overview
The branch visualization now displays active pull requests between branches with animated green arrows showing the direction of the pull request.

## Features

### Visual Indicators
- **Green animated arrows**: Show active pull requests with a pulsing animation flowing from source to target branch
- **PR number badge**: Displays the pull request number (e.g., "PR #123") at the midpoint of the connection
- **Draft PR indicator**: Draft pull requests are shown in gray color
- **Blocked PRs**: Pull requests with merge conflicts or blocked status are shown in red

### Animation Details
- Animated gradient that pulses along the connection line
- Moving dot that travels from source to target branch
- Arrowhead pointing to the target branch
- All animations have a 3-second duration and repeat indefinitely

### Header Updates
- The header now shows the count of open pull requests
- Format: "X branches • Y merged • Z open PRs"
- PR count is shown in green color

## Implementation Details

### API Integration
- Fetches open pull requests from GitHub API endpoint: `/repos/{owner}/{repo}/pulls?state=open`
- Automatically updates branch connections with pull request data
- Creates new connections for PRs that don't follow the branch hierarchy

### Data Structure
```typescript
interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  head: { ref: string; sha: string; }; // source branch
  base: { ref: string; sha: string; }; // target branch
  draft: boolean;
  mergeable_state?: string;
}
```

### Performance Considerations
- Pull requests are fetched after branches are loaded
- PR data is cached along with branch data
- Animations use SVG for smooth performance

## Usage
The feature works automatically when viewing any GitHub repository. Pull requests are fetched and displayed without any additional configuration needed.

## Color Coding
- **Green (#22c55e)**: Active open pull requests
- **Gray (#9ca3af)**: Draft pull requests
- **Red (#ef4444)**: Blocked or conflicted pull requests 