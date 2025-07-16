/**
 * Layout calculation utilities for positioning nodes in the canvas
 */

import { Position } from '../types/canvas';
import { Branch } from '../types/github';

export type LayoutAlignment = 'horizontal' | 'vertical' | 'radial';

/**
 * Calculates optimal tree layout positions for branches
 * @param branches - Array of branch objects with hierarchy information
 * @param canvasWidth - Width of the canvas area
 * @param canvasHeight - Height of the canvas area
 * @param alignment - Layout alignment type
 * @returns Record mapping branch names to their calculated positions
 */
export const calculateTreeLayout = (
  branches: Branch[],
  canvasWidth: number = 1200,
  canvasHeight: number = 800,
  alignment: LayoutAlignment = 'horizontal'
): Record<string, Position> => {
  const positions: Record<string, Position> = {};
  const horizontalSpacing = 200;
  const verticalSpacing = 150;
  const startX = 100;
  const startY = 100;

  // Group branches by depth
  const branchesByDepth = new Map<number, Branch[]>();
  branches.forEach(branch => {
    const depth = branch.depth || 0;
    if (!branchesByDepth.has(depth)) {
      branchesByDepth.set(depth, []);
    }
    branchesByDepth.get(depth)?.push(branch);
  });

  if (alignment === 'horizontal') {
    // Horizontal tree layout
    branchesByDepth.forEach((branchesAtDepth, depth) => {
      const y = startY + depth * verticalSpacing;
      const totalWidth = (branchesAtDepth.length - 1) * horizontalSpacing;
      const startXForDepth = (canvasWidth - totalWidth) / 2;
      branchesAtDepth.forEach((branch, index) => {
        const x = startXForDepth + index * horizontalSpacing;
        positions[branch.name] = { x, y };
      });
    });
  } else if (alignment === 'vertical') {
    // Vertical tree layout
    branchesByDepth.forEach((branchesAtDepth, depth) => {
      const x = startX + depth * horizontalSpacing;
      const totalHeight = (branchesAtDepth.length - 1) * verticalSpacing;
      const startYForDepth = (canvasHeight - totalHeight) / 2;
      branchesAtDepth.forEach((branch, index) => {
        const y = startYForDepth + index * verticalSpacing;
        positions[branch.name] = { x, y };
      });
    });
  } else if (alignment === 'radial') {
    // Radial layout
    const maxDepth = Math.max(...branches.map(b => b.depth || 0));
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const radiusStep = Math.min(canvasWidth, canvasHeight) / (2 * (maxDepth + 2));
    
    branchesByDepth.forEach((branchesAtDepth, depth) => {
      const radius = radiusStep * (depth + 1);
      const angleStep = (2 * Math.PI) / branchesAtDepth.length;
      branchesAtDepth.forEach((branch, index) => {
        const angle = angleStep * index - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        positions[branch.name] = { x, y };
      });
    });
  }

  return positions;
};

/**
 * Calculates force-directed layout positions (basic implementation)
 * @param branches - Array of branch objects
 * @param canvasWidth - Width of the canvas area
 * @param canvasHeight - Height of the canvas area
 * @returns Record mapping branch names to their calculated positions
 */
export const calculateForceLayout = (
  branches: Branch[],
  canvasWidth: number = 1200,
  canvasHeight: number = 800
): Record<string, Position> => {
  const positions: Record<string, Position> = {};
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const spacing = 150;

  // Simple circular arrangement as a basic force layout
  branches.forEach((branch, index) => {
    const angle = (2 * Math.PI * index) / branches.length;
    const radius = Math.min(canvasWidth, canvasHeight) / 4;
    
    positions[branch.name] = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  });

  return positions;
};

/**
 * Calculates radial layout positions with custom radius
 * @param branches - Array of branch objects
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Radius for the circular layout
 * @returns Record mapping branch names to their calculated positions
 */
export const calculateRadialLayout = (
  branches: Branch[],
  centerX: number,
  centerY: number,
  radius: number
): Record<string, Position> => {
  const positions: Record<string, Position> = {};
  
  branches.forEach((branch, index) => {
    const angle = (2 * Math.PI * index) / branches.length - Math.PI / 2;
    positions[branch.name] = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  });

  return positions;
};