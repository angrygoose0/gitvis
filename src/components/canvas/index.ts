/**
 * Canvas module - main exports
 * 
 * This module provides a comprehensive canvas system for visualizing GitHub repository data
 * including branches, commits, pull requests, and their relationships.
 * 
 * @example
 * ```tsx
 * import { DraggableCanvas } from './components/canvas';
 * 
 * function App() {
 *   return (
 *     <DraggableCanvas 
 *       owner="facebook" 
 *       repo="react" 
 *       githubToken="your-token"
 *     />
 *   );
 * }
 * ```
 */

// Main component - the primary export for consumers
export { default as DraggableCanvas } from '../DraggableCanvas';

// Re-export all types for advanced usage
export * from './types';

// Re-export components for custom implementations
export * from './components';

// Re-export services for external integrations
export * from './services';

// Re-export hooks for custom canvas implementations
export * from './hooks';

// Re-export utilities for helper functions
export * from './utils';