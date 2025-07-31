'use client';

/**
 * Canvas interaction hook for handling pan, zoom, and drag operations
 * Extracts canvas state management and interaction logic from the main component
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Position } from '../types/canvas';
import { screenToWorld, mouseToWorld } from '../utils/coordinate-transformer';

export interface CanvasInteractionConfig {
  minScale?: number;
  maxScale?: number;
  zoomSensitivity?: number;
  enablePanning?: boolean;
  enableZooming?: boolean;
}

export interface CanvasInteractionReturn {
  // Canvas state
  scale: number;
  offset: Position;
  isPanning: boolean;
  isSpacePressed: boolean;
  
  // Canvas actions
  setScale: (scale: number) => void;
  setOffset: (offset: Position) => void;
  resetView: () => void;
  zoomToFit: (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => void;
  
  // Event handlers
  handleCanvasMouseDown: (e: React.MouseEvent) => void;
  handleWheel: (e: WheelEvent) => void;
  
  // Coordinate transformations
  screenToWorldCoords: (screenPosition: Position) => Position;
  mouseToWorldCoords: (clientX: number, clientY: number, dragOffset?: Position) => Position;
  
  // Canvas ref
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

const DEFAULT_CONFIG: Required<CanvasInteractionConfig> = {
  minScale: 0.1,
  maxScale: 5,
  zoomSensitivity: 0.1,
  enablePanning: true,
  enableZooming: true,
};

export const useCanvasInteraction = (
  config: CanvasInteractionConfig = {}
): CanvasInteractionReturn => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Canvas state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });
  
  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Handle space key press for panning mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!finalConfig.enableZooming) return;
    
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom
    const zoomFactor = e.deltaY > 0 ? (1 - finalConfig.zoomSensitivity) : (1 + finalConfig.zoomSensitivity);
    const newScale = Math.min(Math.max(finalConfig.minScale, scale * zoomFactor), finalConfig.maxScale);

    // Calculate new offset to zoom towards mouse position
    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;

    const newOffset = {
      x: mouseX - worldX * newScale,
      y: mouseY - worldY * newScale,
    };

    setScale(newScale);
    setOffset(newOffset);
  }, [scale, offset, finalConfig.enableZooming, finalConfig.zoomSensitivity, finalConfig.minScale, finalConfig.maxScale]);
  
  // Handle canvas mouse down for panning
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!finalConfig.enablePanning) return;
    
    // Check if we're clicking on a card/node (avoid panning when interacting with nodes)
    const target = e.target as HTMLElement;
    const isCard = target.closest('[data-node-id]') !== null;
    
    // Only pan if space is pressed or if not clicking on a card
    if (isSpacePressed || !isCard) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }, [offset, isSpacePressed, finalConfig.enablePanning]);
  
  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning && finalConfig.enablePanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, panStart, finalConfig.enablePanning]);
  
  // Handle mouse up to end panning
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  // Set up global event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseMove, handleMouseUp]);
  
  // Coordinate transformation helpers
  const screenToWorldCoords = useCallback((screenPosition: Position): Position => {
    return screenToWorld(screenPosition, scale, offset);
  }, [scale, offset]);
  
  const mouseToWorldCoords = useCallback((
    clientX: number, 
    clientY: number, 
    dragOffset?: Position
  ): Position => {
    return mouseToWorld(clientX, clientY, scale, offset, dragOffset);
  }, [scale, offset]);
  
  // Canvas actions
  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);
  
  const zoomToFit = useCallback((bounds: { 
    minX: number; 
    minY: number; 
    maxX: number; 
    maxY: number; 
  }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const padding = 50; // Padding around the content
    
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    const scaleX = (rect.width - padding * 2) / contentWidth;
    const scaleY = (rect.height - padding * 2) / contentHeight;
    
    const newScale = Math.min(
      Math.max(finalConfig.minScale, Math.min(scaleX, scaleY)), 
      finalConfig.maxScale
    );
    
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    const newOffset = {
      x: rect.width / 2 - centerX * newScale,
      y: rect.height / 2 - centerY * newScale,
    };
    
    setScale(newScale);
    setOffset(newOffset);
  }, [finalConfig.minScale, finalConfig.maxScale]);
  
  return {
    // Canvas state
    scale,
    offset,
    isPanning,
    isSpacePressed,
    
    // Canvas actions
    setScale,
    setOffset,
    resetView,
    zoomToFit,
    
    // Event handlers
    handleCanvasMouseDown,
    handleWheel,
    
    // Coordinate transformations
    screenToWorldCoords,
    mouseToWorldCoords,
    
    // Canvas ref
    canvasRef,
  };
};