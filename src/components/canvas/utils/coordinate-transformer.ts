/**
 * Coordinate transformation utilities for canvas interactions
 */

import { Position } from '../types/canvas';

/**
 * Converts world coordinates to screen coordinates
 * @param worldPosition - Position in world space
 * @param scale - Current zoom scale
 * @param offset - Canvas pan offset
 * @returns Position in screen space
 */
export const worldToScreen = (
  worldPosition: Position,
  scale: number,
  offset: Position
): Position => {
  return {
    x: worldPosition.x * scale + offset.x,
    y: worldPosition.y * scale + offset.y
  };
};

/**
 * Converts screen coordinates to world coordinates
 * @param screenPosition - Position in screen space
 * @param scale - Current zoom scale
 * @param offset - Canvas pan offset
 * @returns Position in world space
 */
export const screenToWorld = (
  screenPosition: Position,
  scale: number,
  offset: Position
): Position => {
  return {
    x: (screenPosition.x - offset.x) / scale,
    y: (screenPosition.y - offset.y) / scale
  };
};

/**
 * Converts mouse event coordinates to world coordinates
 * @param clientX - Mouse X coordinate from event
 * @param clientY - Mouse Y coordinate from event
 * @param scale - Current zoom scale
 * @param offset - Canvas pan offset
 * @param dragOffset - Optional drag offset for precise positioning
 * @returns Position in world space
 */
export const mouseToWorld = (
  clientX: number,
  clientY: number,
  scale: number,
  offset: Position,
  dragOffset?: Position
): Position => {
  const adjustedX = dragOffset ? clientX - dragOffset.x : clientX;
  const adjustedY = dragOffset ? clientY - dragOffset.y : clientY;
  
  return {
    x: (adjustedX - offset.x) / scale,
    y: (adjustedY - offset.y) / scale
  };
};

/**
 * Calculates the bounds of a node in screen space
 * @param worldPosition - Node position in world space
 * @param radius - Node radius
 * @param scale - Current zoom scale
 * @param offset - Canvas pan offset
 * @returns Bounding box in screen space
 */
export const getNodeBounds = (
  worldPosition: Position,
  radius: number,
  scale: number,
  offset: Position
) => {
  const screenPos = worldToScreen(worldPosition, scale, offset);
  const scaledRadius = radius * scale;
  
  return {
    left: screenPos.x - scaledRadius,
    top: screenPos.y - scaledRadius,
    right: screenPos.x + scaledRadius,
    bottom: screenPos.y + scaledRadius,
    width: scaledRadius * 2,
    height: scaledRadius * 2,
    centerX: screenPos.x,
    centerY: screenPos.y
  };
};