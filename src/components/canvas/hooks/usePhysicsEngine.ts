'use client';

/**
 * Physics engine hook for node physics and animations
 * Handles velocity calculations, collision detection, animation frame management,
 * and node positioning and movement
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Position, Velocity, CardPhysics } from '../types/canvas';

// Physics constants
const COLLISION_RADIUS = 30; // Effective radius for collision detection between nodes
const FRICTION = 0.95; // Deceleration factor
const MIN_VELOCITY = 0.1; // Minimum velocity before stopping

export interface PhysicsEngineConfig {
  collisionRadius?: number;
  friction?: number;
  minVelocity?: number;
  enableCollisions?: boolean;
  enableBounceBack?: boolean;
}

export interface PhysicsEngineReturn {
  // Physics state
  cardPhysics: Record<string, CardPhysics>;
  animationTime: number;
  
  // Physics actions
  updateCardPhysics: (id: string, updates: Partial<CardPhysics>) => void;
  setCardPhysics: (physics: Record<string, CardPhysics>) => void;
  initializeCard: (id: string, initialPhysics: CardPhysics) => void;
  removeCard: (id: string) => void;
  
  // Drag operations
  startDrag: (id: string, position: Position) => void;
  updateDrag: (id: string, position: Position) => void;
  endDrag: (id: string, returnToPosition?: Position) => void;
  
  // Utility functions
  getDistance: (p1: Position, p2: Position) => number;
  isColliding: (id1: string, id2: string) => boolean;
  findNearestCard: (position: Position, excludeId?: string) => string | null;
  
  // Animation control
  startPhysicsLoop: () => void;
  stopPhysicsLoop: () => void;
}

const DEFAULT_CONFIG: Required<PhysicsEngineConfig> = {
  collisionRadius: COLLISION_RADIUS,
  friction: FRICTION,
  minVelocity: MIN_VELOCITY,
  enableCollisions: false, // Disabled by default as per current implementation
  enableBounceBack: true,
};

export const usePhysicsEngine = (
  config: PhysicsEngineConfig = {}
): PhysicsEngineReturn => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Physics state
  const [cardPhysics, setCardPhysics] = useState<Record<string, CardPhysics>>({});
  const [animationTime, setAnimationTime] = useState<number>(0);
  
  // Animation frame reference
  const animationFrameRef = useRef<number | undefined>(undefined);
  const isRunningRef = useRef<boolean>(false);
  
  // Calculate distance between two points
  const getDistance = useCallback((p1: Position, p2: Position): number => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);
  
  // Check if two cards are colliding
  const isColliding = useCallback((id1: string, id2: string): boolean => {
    const card1 = cardPhysics[id1];
    const card2 = cardPhysics[id2];
    
    if (!card1 || !card2) return false;
    
    const distance = getDistance(card1.position, card2.position);
    return distance < finalConfig.collisionRadius;
  }, [cardPhysics, getDistance, finalConfig.collisionRadius]);
  
  // Find the nearest card to a given position
  const findNearestCard = useCallback((position: Position, excludeId?: string): string | null => {
    let nearestId: string | null = null;
    let nearestDistance = Infinity;
    
    Object.entries(cardPhysics).forEach(([id, physics]) => {
      if (id === excludeId) return;
      
      const distance = getDistance(position, physics.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = id;
      }
    });
    
    return nearestId;
  }, [cardPhysics, getDistance]);
  
  // Physics update loop
  const updatePhysics = useCallback(() => {
    setCardPhysics(prevPhysics => {
      const newPhysics = { ...prevPhysics };
      const cardIds = Object.keys(newPhysics);
      
      // Update positions based on velocity and handle bounce-back
      cardIds.forEach(id => {
        const card = newPhysics[id];
        
        if (!card.isDragging) {
          // Bounce-back logic
          if (card.returnTo && finalConfig.enableBounceBack) {
            const dx = card.returnTo.x - card.position.x;
            const dy = card.returnTo.y - card.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 5) {
              // Snap to target and clear returnTo
              card.position = { ...card.returnTo };
              card.velocity = { x: 0, y: 0 };
              delete card.returnTo;
              delete card.originalPosition;
            } else {
              // Move toward returnTo with spring effect
              const spring = 0.2;
              card.velocity.x = dx * spring;
              card.velocity.y = dy * spring;
              card.position.x += card.velocity.x;
              card.position.y += card.velocity.y;
            }
          } else {
            // Apply velocity
            card.position.x += card.velocity.x;
            card.position.y += card.velocity.y;
            
            // Apply friction
            card.velocity.x *= finalConfig.friction;
            card.velocity.y *= finalConfig.friction;
            
            // Stop if velocity is too small
            if (Math.abs(card.velocity.x) < finalConfig.minVelocity) card.velocity.x = 0;
            if (Math.abs(card.velocity.y) < finalConfig.minVelocity) card.velocity.y = 0;
          }
        }
      });
      
      // Collision detection and resolution (if enabled)
      if (finalConfig.enableCollisions) {
        for (let i = 0; i < cardIds.length; i++) {
          for (let j = i + 1; j < cardIds.length; j++) {
            const id1 = cardIds[i];
            const id2 = cardIds[j];
            const card1 = newPhysics[id1];
            const card2 = newPhysics[id2];
            
            if (!card1.isDragging && !card2.isDragging) {
              const distance = getDistance(card1.position, card2.position);
              
              if (distance < finalConfig.collisionRadius && distance > 0) {
                // Calculate collision response
                const overlap = finalConfig.collisionRadius - distance;
                const dx = (card2.position.x - card1.position.x) / distance;
                const dy = (card2.position.y - card1.position.y) / distance;
                
                // Separate the cards
                const separation = overlap * 0.5;
                card1.position.x -= dx * separation;
                card1.position.y -= dy * separation;
                card2.position.x += dx * separation;
                card2.position.y += dy * separation;
                
                // Apply collision impulse
                const impulse = 2;
                card1.velocity.x -= dx * impulse;
                card1.velocity.y -= dy * impulse;
                card2.velocity.x += dx * impulse;
                card2.velocity.y += dy * impulse;
              }
            }
          }
        }
      }
      
      return newPhysics;
    });
    
    // Update animation time
    setAnimationTime(prevTime => prevTime + 16); // Increment by ~16ms (60fps)
    
    // Continue the animation loop
    if (isRunningRef.current) {
      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    }
  }, [finalConfig.friction, finalConfig.minVelocity, finalConfig.enableCollisions, finalConfig.collisionRadius, finalConfig.enableBounceBack, getDistance]);
  
  // Start physics simulation
  const startPhysicsLoop = useCallback(() => {
    if (!isRunningRef.current) {
      isRunningRef.current = true;
      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    }
  }, [updatePhysics]);
  
  // Stop physics simulation
  const stopPhysicsLoop = useCallback(() => {
    isRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
  }, []);
  
  // Initialize physics loop on mount
  useEffect(() => {
    startPhysicsLoop();
    
    return () => {
      stopPhysicsLoop();
    };
  }, [startPhysicsLoop, stopPhysicsLoop]);
  
  // Update card physics
  const updateCardPhysics = useCallback((id: string, updates: Partial<CardPhysics>) => {
    setCardPhysics(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...updates
      }
    }));
  }, []);
  
  // Initialize a new card
  const initializeCard = useCallback((id: string, initialPhysics: CardPhysics) => {
    setCardPhysics(prev => ({
      ...prev,
      [id]: initialPhysics
    }));
  }, []);
  
  // Remove a card
  const removeCard = useCallback((id: string) => {
    setCardPhysics(prev => {
      const newPhysics = { ...prev };
      delete newPhysics[id];
      return newPhysics;
    });
  }, []);
  
  // Start dragging a card
  const startDrag = useCallback((id: string, position: Position) => {
    updateCardPhysics(id, {
      isDragging: true,
      lastDragPosition: position,
      originalPosition: cardPhysics[id]?.position || position,
      velocity: { x: 0, y: 0 }
    });
  }, [updateCardPhysics, cardPhysics]);
  
  // Update drag position
  const updateDrag = useCallback((id: string, position: Position) => {
    const card = cardPhysics[id];
    if (!card || !card.isDragging) return;
    
    // Calculate velocity based on position change
    const velocity = card.lastDragPosition ? {
      x: (position.x - card.lastDragPosition.x) * 0.5,
      y: (position.y - card.lastDragPosition.y) * 0.5
    } : { x: 0, y: 0 };
    
    updateCardPhysics(id, {
      position,
      lastDragPosition: position,
      velocity
    });
  }, [cardPhysics, updateCardPhysics]);
  
  // End dragging a card
  const endDrag = useCallback((id: string, returnToPosition?: Position) => {
    const updates: Partial<CardPhysics> = {
      isDragging: false,
      lastDragPosition: undefined
    };
    
    if (returnToPosition) {
      updates.returnTo = returnToPosition;
    }
    
    updateCardPhysics(id, updates);
  }, [updateCardPhysics]);
  
  return {
    // Physics state
    cardPhysics,
    animationTime,
    
    // Physics actions
    updateCardPhysics,
    setCardPhysics,
    initializeCard,
    removeCard,
    
    // Drag operations
    startDrag,
    updateDrag,
    endDrag,
    
    // Utility functions
    getDistance,
    isColliding,
    findNearestCard,
    
    // Animation control
    startPhysicsLoop,
    stopPhysicsLoop,
  };
};