/**
 * Performance monitoring utilities for large datasets
 * Tracks rendering performance, memory usage, and provides optimization suggestions
 */

interface PerformanceMetrics {
  renderTime: number;
  nodeCount: number;
  connectionCount: number;
  memoryUsage?: number;
  timestamp: number;
}

interface PerformanceThresholds {
  maxRenderTime: number;
  maxNodes: number;
  maxConnections: number;
  memoryWarningThreshold: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxRenderTime: 16, // 60fps target
  maxNodes: 100,
  maxConnections: 200,
  memoryWarningThreshold: 50 * 1024 * 1024, // 50MB
};

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds;
  private isMonitoring = false;
  private renderStartTime = 0;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  startRender(): void {
    if (!this.isMonitoring) return;
    this.renderStartTime = performance.now();
  }

  endRender(nodeCount: number, connectionCount: number): PerformanceMetrics {
    if (!this.isMonitoring) {
      return {
        renderTime: 0,
        nodeCount,
        connectionCount,
        timestamp: Date.now(),
      };
    }

    const renderTime = performance.now() - this.renderStartTime;
    const memoryUsage = this.getMemoryUsage();

    const metrics: PerformanceMetrics = {
      renderTime,
      nodeCount,
      connectionCount,
      memoryUsage,
      timestamp: Date.now(),
    };

    this.metrics.push(metrics);

    // Keep only last 100 measurements
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log warnings if thresholds are exceeded
    this.checkThresholds(metrics);

    return metrics;
  }

  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    const warnings: string[] = [];

    if (metrics.renderTime > this.thresholds.maxRenderTime) {
      warnings.push(`Render time (${metrics.renderTime.toFixed(2)}ms) exceeds target (${this.thresholds.maxRenderTime}ms)`);
    }

    if (metrics.nodeCount > this.thresholds.maxNodes) {
      warnings.push(`Node count (${metrics.nodeCount}) exceeds recommended maximum (${this.thresholds.maxNodes})`);
    }

    if (metrics.connectionCount > this.thresholds.maxConnections) {
      warnings.push(`Connection count (${metrics.connectionCount}) exceeds recommended maximum (${this.thresholds.maxConnections})`);
    }

    if (metrics.memoryUsage && metrics.memoryUsage > this.thresholds.memoryWarningThreshold) {
      warnings.push(`Memory usage (${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB) is high`);
    }

    if (warnings.length > 0) {
      console.warn('Performance warnings:', warnings);
      this.suggestOptimizations(metrics);
    }
  }

  private suggestOptimizations(metrics: PerformanceMetrics): void {
    const suggestions: string[] = [];

    if (metrics.renderTime > this.thresholds.maxRenderTime) {
      suggestions.push('Consider implementing virtualization for large node counts');
      suggestions.push('Use React.memo for components that re-render frequently');
    }

    if (metrics.nodeCount > this.thresholds.maxNodes) {
      suggestions.push('Implement node clustering for better performance');
      suggestions.push('Add filtering options to reduce visible nodes');
    }

    if (metrics.connectionCount > this.thresholds.maxConnections) {
      suggestions.push('Consider hiding connections at lower zoom levels');
      suggestions.push('Implement connection bundling for dense graphs');
    }

    if (suggestions.length > 0) {
      console.info('Performance optimization suggestions:', suggestions);
    }
  }

  getAverageRenderTime(): number {
    if (this.metrics.length === 0) return 0;
    const sum = this.metrics.reduce((acc, metric) => acc + metric.renderTime, 0);
    return sum / this.metrics.length;
  }

  getMaxRenderTime(): number {
    if (this.metrics.length === 0) return 0;
    return Math.max(...this.metrics.map(metric => metric.renderTime));
  }

  getCurrentMemoryUsage(): number | undefined {
    return this.getMemoryUsage();
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  startMonitoring(): void {
    this.isMonitoring = true;
    console.info('Performance monitoring started');
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    console.info('Performance monitoring stopped');
  }

  isActive(): boolean {
    return this.isMonitoring;
  }

  // Performance optimization utilities
  static shouldSkipRender(scale: number, nodeCount: number): boolean {
    // Skip rendering nodes that are too small to see
    if (scale < 0.1 && nodeCount > 50) {
      return true;
    }
    return false;
  }

  static shouldReduceAnimations(renderTime: number): boolean {
    // Reduce animations if render time is too high
    return renderTime > 32; // 30fps threshold
  }

  static getOptimalBatchSize(nodeCount: number): number {
    // Calculate optimal batch size for processing large datasets
    if (nodeCount < 50) return nodeCount;
    if (nodeCount < 200) return 25;
    return 50;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Hook for using performance monitoring in React components
export function usePerformanceMonitor() {
  return {
    startRender: () => performanceMonitor.startRender(),
    endRender: (nodeCount: number, connectionCount: number) => 
      performanceMonitor.endRender(nodeCount, connectionCount),
    getAverageRenderTime: () => performanceMonitor.getAverageRenderTime(),
    getMaxRenderTime: () => performanceMonitor.getMaxRenderTime(),
    getCurrentMemoryUsage: () => performanceMonitor.getCurrentMemoryUsage(),
    startMonitoring: () => performanceMonitor.startMonitoring(),
    stopMonitoring: () => performanceMonitor.stopMonitoring(),
    isActive: () => performanceMonitor.isActive(),
    clearMetrics: () => performanceMonitor.clearMetrics(),
  };
}

export default PerformanceMonitor;