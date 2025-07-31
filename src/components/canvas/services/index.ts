/**
 * Services - centralized exports
 * 
 * This module exports service modules for handling external API calls,
 * data processing, and business logic related to GitHub repository analysis.
 */

/**
 * Service for making GitHub API calls with proper error handling and rate limiting
 * @see github-api
 */
export * from './github-api';

/**
 * Service for analyzing branch relationships and building tree structures
 * @see branch-analyzer
 */
export * from './branch-analyzer';