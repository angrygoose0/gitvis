/**
 * Tests for usePhysicsEngine hook
 */

import { renderHook, act } from '@testing-library/react';
import { usePhysicsEngine } from '../usePhysicsEngine';
import { CardPhysics } from '../../types/canvas';

// Mock requestAnimationFrame and cancelAnimationFrame
let animationFrameId = 1;
const activeTimeouts = new Set<NodeJS.Timeout>();

global.requestAnimationFrame = vi.fn((cb) => {
  const timeoutId = setTimeout(() => {
    activeTimeouts.delete(timeoutId);
    cb(Date.now());
  }, 16);
  activeTimeouts.add(timeoutId);
  return animationFrameId++;
});

global.cancelAnimationFrame = vi.fn((id) => {
  // Clear all active timeouts when cancelAnimationFrame is called
  activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  activeTimeouts.clear();
});

describe('usePhysicsEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    // Clear any pending animation frames
    if (global.cancelAnimationFrame) {
      global.cancelAnimationFrame(1);
    }
  });

  it('should initialize with empty physics state', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    expect(result.current.cardPhysics).toEqual({});
    expect(result.current.animationTime).toBe(0);
  });

  it('should initialize a card with physics properties', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const initialPhysics: CardPhysics = {
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    act(() => {
      result.current.initializeCard('test-card', initialPhysics);
    });

    expect(result.current.cardPhysics['test-card']).toEqual(initialPhysics);
  });

  it('should update card physics properties', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const initialPhysics: CardPhysics = {
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    act(() => {
      result.current.initializeCard('test-card', initialPhysics);
    });

    act(() => {
      result.current.updateCardPhysics('test-card', {
        position: { x: 200, y: 200 },
        isDragTarget: true,
      });
    });

    expect(result.current.cardPhysics['test-card'].position).toEqual({ x: 200, y: 200 });
    expect(result.current.cardPhysics['test-card'].isDragTarget).toBe(true);
  });

  it('should remove a card from physics', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const initialPhysics: CardPhysics = {
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    act(() => {
      result.current.initializeCard('test-card', initialPhysics);
    });

    expect(result.current.cardPhysics['test-card']).toBeDefined();

    act(() => {
      result.current.removeCard('test-card');
    });

    expect(result.current.cardPhysics['test-card']).toBeUndefined();
  });

  it('should calculate distance between two points', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const distance = result.current.getDistance(
      { x: 0, y: 0 },
      { x: 3, y: 4 }
    );

    expect(distance).toBe(5); // 3-4-5 triangle
  });

  it('should start and update drag operations', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const initialPhysics: CardPhysics = {
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    act(() => {
      result.current.initializeCard('test-card', initialPhysics);
    });

    // Start drag
    act(() => {
      result.current.startDrag('test-card', { x: 100, y: 100 });
    });

    expect(result.current.cardPhysics['test-card'].isDragging).toBe(true);
    expect(result.current.cardPhysics['test-card'].originalPosition).toEqual({ x: 100, y: 100 });

    // Update drag
    act(() => {
      result.current.updateDrag('test-card', { x: 150, y: 150 });
    });

    expect(result.current.cardPhysics['test-card'].position).toEqual({ x: 150, y: 150 });
    expect(result.current.cardPhysics['test-card'].lastDragPosition).toEqual({ x: 150, y: 150 });
  });

  it('should end drag operations', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const initialPhysics: CardPhysics = {
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    act(() => {
      result.current.initializeCard('test-card', initialPhysics);
    });

    act(() => {
      result.current.startDrag('test-card', { x: 100, y: 100 });
    });

    act(() => {
      result.current.endDrag('test-card');
    });

    expect(result.current.cardPhysics['test-card'].isDragging).toBe(false);
    expect(result.current.cardPhysics['test-card'].lastDragPosition).toBeUndefined();
  });

  it('should end drag with return position', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const initialPhysics: CardPhysics = {
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    act(() => {
      result.current.initializeCard('test-card', initialPhysics);
    });

    act(() => {
      result.current.startDrag('test-card', { x: 100, y: 100 });
    });

    const returnPosition = { x: 200, y: 200 };
    act(() => {
      result.current.endDrag('test-card', returnPosition);
    });

    expect(result.current.cardPhysics['test-card'].isDragging).toBe(false);
    expect(result.current.cardPhysics['test-card'].returnTo).toEqual(returnPosition);
  });

  it('should find nearest card to a position', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const card1: CardPhysics = {
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    const card2: CardPhysics = {
      position: { x: 200, y: 200 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    act(() => {
      result.current.initializeCard('card1', card1);
      result.current.initializeCard('card2', card2);
    });

    const nearestToOrigin = result.current.findNearestCard({ x: 0, y: 0 });
    expect(nearestToOrigin).toBe('card1');

    const nearestToFarPoint = result.current.findNearestCard({ x: 300, y: 300 });
    expect(nearestToFarPoint).toBe('card2');
  });

  it('should exclude specified card when finding nearest', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const card1: CardPhysics = {
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    const card2: CardPhysics = {
      position: { x: 200, y: 200 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    act(() => {
      result.current.initializeCard('card1', card1);
      result.current.initializeCard('card2', card2);
    });

    const nearestExcludingCard1 = result.current.findNearestCard({ x: 0, y: 0 }, 'card1');
    expect(nearestExcludingCard1).toBe('card2');
  });

  it('should detect collisions between cards', () => {
    const { result } = renderHook(() => usePhysicsEngine());

    const card1: CardPhysics = {
      position: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    const card2: CardPhysics = {
      position: { x: 110, y: 110 }, // Close enough to collide (default collision radius is 30)
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    const card3: CardPhysics = {
      position: { x: 200, y: 200 }, // Far enough to not collide
      velocity: { x: 0, y: 0 },
      isDragging: false,
      isExpanded: false,
      isLoadingCommits: false,
      isDragTarget: false,
      animationTime: 0,
    };

    act(() => {
      result.current.initializeCard('card1', card1);
      result.current.initializeCard('card2', card2);
      result.current.initializeCard('card3', card3);
    });

    expect(result.current.isColliding('card1', 'card2')).toBe(true);
    expect(result.current.isColliding('card1', 'card3')).toBe(false);
  });

  it('should handle physics configuration', () => {
    const customConfig = {
      collisionRadius: 50,
      friction: 0.9,
      minVelocity: 0.2,
      enableCollisions: true,
      enableBounceBack: false,
    };

    const { result } = renderHook(() => usePhysicsEngine(customConfig));

    // The hook should accept the configuration (we can't directly test internal config usage
    // without exposing it, but we can test that it doesn't break)
    expect(result.current.cardPhysics).toEqual({});
  });

  it('should start and stop physics loop', () => {
    const { result, unmount } = renderHook(() => usePhysicsEngine());

    // Physics loop should start automatically
    expect(global.requestAnimationFrame).toHaveBeenCalled();

    act(() => {
      result.current.stopPhysicsLoop();
    });

    expect(global.cancelAnimationFrame).toHaveBeenCalled();

    act(() => {
      result.current.startPhysicsLoop();
    });

    // Should call requestAnimationFrame again
    expect(global.requestAnimationFrame).toHaveBeenCalledTimes(2);
    
    // Clean up
    act(() => {
      result.current.stopPhysicsLoop();
    });
    
    unmount();
  });
});