/**
 * Branch analysis service
 * Handles branch relationship analysis and tree structure calculation
 */

import { Branch, BranchConnection } from '../types/github';

/**
 * Interface for branch comparison result from GitHub API
 */
interface BranchCompareResult {
  ahead_by: number;
  behind_by: number;
  status: string;
}

/**
 * Interface for merged branch information
 */
interface MergedBranchInfo {
  mergedInto: string;
  aheadBy: number;
}

/**
 * Branch name patterns for fallback heuristics
 */
const BRANCH_PATTERNS = {
  develop: /^(develop|dev|development)$/i,
  feature: /^(feature|feat)\//i,
  bugfix: /^(bugfix|fix|hotfix)\//i,
  release: /^(release|rel)\//i,
} as const;

/**
 * Calculate branch tree structure and relationships
 * Analyzes branch relationships by comparing commits between branches
 * 
 * @param branches - Array of branches to analyze
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param defaultBranch - Default branch name (usually 'main' or 'master')
 * @param headers - HTTP headers for API requests
 * @param existingRelationships - Previously calculated relationships to preserve
 * @returns Promise resolving to branches with relationships and connections
 */
export const calculateBranchTree = async (
  branches: Branch[],
  owner: string,
  repo: string,
  defaultBranch: string,
  headers: HeadersInit,
  existingRelationships: Record<string, string> = {}
): Promise<{ branches: Branch[], connections: BranchConnection[] }> => {
  const branchMap = new Map<string, Branch>();
  const connections: BranchConnection[] = [];

  // Initialize branch map
  branches.forEach(branch => {
    branchMap.set(branch.name, { ...branch, children: [] });
  });

  // Set default branch as root
  const rootBranch = branchMap.get(defaultBranch);
  if (rootBranch) {
    rootBranch.depth = 0;
    rootBranch.aheadBy = 1; // Default branch always considered ahead
  }

  const updatedBranches = Array.from(branchMap.values());

  try {
    // Create a map to store branch relationships
    const branchRelationships = new Map<string, string>(); // child -> parent
    const mergedBranches = new Map<string, MergedBranchInfo>(); // Track merged branches with details

    // First pass: Identify all merged branches
    await identifyMergedBranches(updatedBranches, defaultBranch, owner, repo, headers, mergedBranches);

    // Sort branches by name to ensure consistent ordering
    const sortedBranches = updatedBranches
      .filter(b => b.name !== defaultBranch)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Second pass: Determine parent-child relationships
    await determineParentChildRelationships(
      sortedBranches,
      updatedBranches,
      existingRelationships,
      branchRelationships,
      mergedBranches,
      defaultBranch,
      owner,
      repo,
      headers
    );

    // Third pass: Determine aheadBy for each branch
    await calculateAheadByStatus(sortedBranches, branchRelationships, defaultBranch, owner, repo, headers, branchMap);

    // Build the tree structure based on relationships
    buildTreeStructure(updatedBranches, branchRelationships, defaultBranch, branchMap, connections);

  } catch (error) {
    console.error('Error analyzing branch relationships:', error);

    // Fallback: Simple heuristic based on branch names
    applyFallbackHeuristics(updatedBranches, defaultBranch, branchMap, connections);
  }

  return { branches: updatedBranches, connections };
};

/**
 * Identify branches that have been merged into other branches
 */
async function identifyMergedBranches(
  branches: Branch[],
  defaultBranch: string,
  owner: string,
  repo: string,
  headers: HeadersInit,
  mergedBranches: Map<string, MergedBranchInfo>
): Promise<void> {
  for (const branch of branches) {
    if (branch.name === defaultBranch) continue;

    // Check if branch is merged into default branch
    try {
      const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${defaultBranch}...${branch.name}`;
      const response = await fetch(compareUrl, { headers });

      if (response.ok) {
        const compareData: BranchCompareResult = await response.json();
        if (compareData.ahead_by === 0 && compareData.behind_by >= 0) {
          mergedBranches.set(branch.name, { mergedInto: defaultBranch, aheadBy: 0 });
        }
      }
    } catch (error) {
      console.warn(`Error comparing ${branch.name} with ${defaultBranch}:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit delay
  }
}

/**
 * Determine parent-child relationships between branches
 */
async function determineParentChildRelationships(
  sortedBranches: Branch[],
  allBranches: Branch[],
  existingRelationships: Record<string, string>,
  branchRelationships: Map<string, string>,
  mergedBranches: Map<string, MergedBranchInfo>,
  defaultBranch: string,
  owner: string,
  repo: string,
  headers: HeadersInit
): Promise<void> {
  for (const branch of sortedBranches) {
    // Check if we have an existing relationship for this branch
    if (existingRelationships[branch.name]) {
      // Verify the parent still exists
      const existingParent = existingRelationships[branch.name];
      if (allBranches.some(b => b.name === existingParent)) {
        branchRelationships.set(branch.name, existingParent);
        continue; // Skip to next branch
      }
    }

    let bestParent = defaultBranch;
    let shortestDistance = Infinity;

    // Skip if this branch is already identified as merged
    const mergedInfo = mergedBranches.get(branch.name);

    // Compare with all potential parent branches
    const potentialParents = allBranches.filter(b =>
      b.name !== branch.name &&
      !mergedBranches.has(b.name) // Don't use merged branches as parents
    );

    for (const candidate of potentialParents) {
      try {
        const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${candidate.name}...${branch.name}`;
        const response = await fetch(compareUrl, { headers });

        if (response.ok) {
          const compareData: BranchCompareResult = await response.json();

          // If branch is ahead and not behind, it's a potential child
          if (compareData.ahead_by > 0 && compareData.behind_by === 0) {
            // Prefer parents with fewer commits between (shorter distance)
            if (compareData.ahead_by < shortestDistance) {
              shortestDistance = compareData.ahead_by;
              bestParent = candidate.name;
            }
          } else if (compareData.ahead_by === 0 && compareData.behind_by >= 0 && !mergedInfo) {
            // Branch is fully merged into this candidate
            mergedBranches.set(branch.name, { mergedInto: candidate.name, aheadBy: 0 });
            bestParent = candidate.name;
            break;
          }
        }
      } catch (error) {
        console.warn(`Error comparing ${branch.name} with ${candidate.name}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit delay
    }

    // Set the parent relationship
    branchRelationships.set(branch.name, bestParent);
  }
}

/**
 * Calculate ahead/behind status for each branch relative to its parent
 */
async function calculateAheadByStatus(
  sortedBranches: Branch[],
  branchRelationships: Map<string, string>,
  defaultBranch: string,
  owner: string,
  repo: string,
  headers: HeadersInit,
  branchMap: Map<string, Branch>
): Promise<void> {
  for (const branch of sortedBranches) {
    const parent = branchRelationships.get(branch.name) || defaultBranch;
    try {
      const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${parent}...${branch.name}`;
      const response = await fetch(compareUrl, { headers });
      if (response.ok) {
        const compareData: BranchCompareResult = await response.json();
        const aheadBy = compareData.ahead_by;
        const branchToUpdate = branchMap.get(branch.name);
        if (branchToUpdate) {
          branchToUpdate.aheadBy = aheadBy;
        }
      }
    } catch (error) {
      console.warn(`Error checking aheadBy for ${branch.name}:`, error);
      const branchToUpdate = branchMap.get(branch.name);
      if (branchToUpdate) {
        branchToUpdate.aheadBy = undefined;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit delay
  }
}

/**
 * Build the tree structure based on calculated relationships
 */
function buildTreeStructure(
  branches: Branch[],
  branchRelationships: Map<string, string>,
  defaultBranch: string,
  branchMap: Map<string, Branch>,
  connections: BranchConnection[]
): void {
  branches.forEach(branch => {
    if (branch.name === defaultBranch) return;

    const parent = branchRelationships.get(branch.name) || defaultBranch;
    branch.parent = parent;

    // Calculate depth
    let depth = 1;
    let currentParent: string | undefined = parent;
    const visited = new Set<string>(); // Prevent infinite loops

    while (currentParent && currentParent !== defaultBranch && !visited.has(currentParent)) {
      visited.add(currentParent);
      depth++;
      currentParent = branchRelationships.get(currentParent);
    }
    branch.depth = Math.min(depth, 5); // Cap depth at 5 for visualization

    // Get commit count for this connection (will be calculated later when commits are fetched)
    connections.push({
      from: branch.name,  // from child
      to: parent,         // to parent
      commitCount: 0 // Will be updated when commits are fetched
    });

    // Update parent's children
    const parentBranch = branchMap.get(parent);
    if (parentBranch) {
      parentBranch.children = parentBranch.children || [];
      parentBranch.children.push(branch.name);
    }
  });
}

/**
 * Apply fallback heuristics when API analysis fails
 */
function applyFallbackHeuristics(
  branches: Branch[],
  defaultBranch: string,
  branchMap: Map<string, Branch>,
  connections: BranchConnection[]
): void {
  branches.forEach(branch => {
    if (branch.name === defaultBranch) return;

    let parent = defaultBranch;
    let depth = 1;

    // Check if there's a develop branch and this might branch from it
    const developBranch = branches.find(b => BRANCH_PATTERNS.develop.test(b.name));
    if (developBranch && (BRANCH_PATTERNS.feature.test(branch.name) || BRANCH_PATTERNS.bugfix.test(branch.name))) {
      parent = developBranch.name;
      depth = 2;
    }

    branch.parent = parent;
    branch.depth = depth;
    branch.aheadBy = 1; // Default to 1 in fallback
    connections.push({ from: parent, to: branch.name });

    const parentBranch = branchMap.get(parent);
    if (parentBranch) {
      parentBranch.children = parentBranch.children || [];
      parentBranch.children.push(branch.name);
    }
  });
}

/**
 * Analyze branch status to determine if it's ahead, behind, or merged
 * @param branchName - Name of the branch to analyze
 * @param parentBranch - Parent branch to compare against
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param headers - HTTP headers for API requests
 * @returns Promise resolving to branch status information
 */
export const analyzeBranchStatus = async (
  branchName: string,
  parentBranch: string,
  owner: string,
  repo: string,
  headers: HeadersInit
): Promise<{ aheadBy: number; behindBy: number; status: string }> => {
  try {
    const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${parentBranch}...${branchName}`;
    const response = await fetch(compareUrl, { headers });
    
    if (response.ok) {
      const compareData: BranchCompareResult = await response.json();
      return {
        aheadBy: compareData.ahead_by,
        behindBy: compareData.behind_by,
        status: compareData.status
      };
    }
    
    throw new Error(`API request failed with status ${response.status}`);
  } catch (error) {
    console.warn(`Error analyzing branch status for ${branchName}:`, error);
    return {
      aheadBy: 0,
      behindBy: 0,
      status: 'unknown'
    };
  }
};

/**
 * Detect branches that have been merged into other branches
 * @param branches - Array of branches to check
 * @param targetBranch - Branch to check merges into (usually default branch)
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param headers - HTTP headers for API requests
 * @returns Promise resolving to array of merged branch names
 */
export const detectMergedBranches = async (
  branches: Branch[],
  targetBranch: string,
  owner: string,
  repo: string,
  headers: HeadersInit
): Promise<string[]> => {
  const mergedBranches: string[] = [];
  
  for (const branch of branches) {
    if (branch.name === targetBranch) continue;
    
    try {
      const status = await analyzeBranchStatus(branch.name, targetBranch, owner, repo, headers);
      
      // Branch is considered merged if it's not ahead and not behind (or only behind)
      if (status.aheadBy === 0 && status.behindBy >= 0) {
        mergedBranches.push(branch.name);
      }
    } catch (error) {
      console.warn(`Error checking merge status for ${branch.name}:`, error);
    }
    
    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return mergedBranches;
};