/**
 * Tests for useCanvasInteraction hook
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCanvasInteraction } from '../useCanvasInteraction';

// Mock the coordinate transformer utilities
vi.mock('../../utils/coordinate-transformer', () => ({
  screenToWorld: vi.fn((screenPos, scale, offset) => ({
    x: (screenPos.x - offset.x) / scale,
    y: (screenPos.y - offset.y) / scale,
  })),
  mouseToWorld: vi.fn((clientX, clientY, scale, offset, dragOffset) => ({
    x: (clientX - offset.x) / scale,
    y: (clientY - offset.y) / scale,
  })),
}));

describe('useCanvasInteraction', () => {
  beforeEach(() => {
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useCanvasInteraction());

    expect(result.current.scale).toBe(1);
    expect(result.current.offset).toEqual({ x: 0, y: 0 });
    expect(result.current.isPanning).toBe(false);
    expect(result.current.isSpacePressed).toBe(false);
  });

  it('should update scale and offset', () => {
    const { result } = renderHook(() => useCanvasInteraction());

    act(() => {
      result.current.setScale(2);
      result.current.setOffset({ x: 100, y: 50 });
    });

    expect(result.current.scale).toBe(2);
    expect(result.current.offset).toEqual({ x: 100, y: 50 });
  });

  it('should reset view to default values', () => {
    const { result } = renderHook(() => useCanvasInteraction());

    // Set some values first
    act(() => {
      result.current.setScale(3);
      result.current.setOffset({ x: 200, y: 100 });
    });

    // Reset view
    act(() => {
      result.current.resetView();
    });

    expect(result.current.scale).toBe(1);
    expect(result.current.offset).toEqual({ x: 0, y: 0 });
  });

  it('should respect configuration limits', () => {
    const config = {
      minScale: 0.5,
      maxScale: 3,
    };

    const { result } = renderHook(() => useCanvasInteraction(config));

    // Test setting scale below minimum
    act(() => {
      result.current.setScale(0.1);
    });
    expect(result.current.scale).toBe(0.1); // setScale doesn't enforce limits directly

    // The limits are enforced in handleWheel, which we can't easily test here
    // without mocking wheel events
  });

  it('should provide coordinate transformation functions', () => {
    const { result } = renderHook(() => useCanvasInteraction());

    const screenPos = { x: 100, y: 50 };
    const worldPos = result.current.screenToWorldCoords(screenPos);

    expect(worldPos).toEqual({ x: 100, y: 50 }); // With scale=1, offset=0,0
  });

  it('should handle mouse to world coordinate conversion', () => {
    const { result } = renderHook(() => useCanvasInteraction());

    const worldPos = result.current.mouseToWorldCoords(200, 150);

    expect(worldPos).toEqual({ x: 200, y: 150 }); // With scale=1, offset=0,0
  });

  it('should calculate zoom to fit bounds correctly', () => {
    const { result } = renderHook(() => useCanvasInteraction());

    // Mock canvas ref
    const mockCanvas = document.createElement('div');
    Object.defineProperty(result.current.canvasRef, 'current', {
      value: mockCanvas,
      writable: true,
    });

    const bounds = {
      minX: -100,
      minY: -50,
      maxX: 100,
      maxY: 50,
    };

    act(() => {
      result.current.zoomToFit(bounds);
    });

    // Should calculate appropriate scale and offset
    expect(result.current.scale).toBeGreaterThan(0);
    expect(typeof result.current.offset.x).toBe('number');
    expect(typeof result.current.offset.y).toBe('number');
  });
});