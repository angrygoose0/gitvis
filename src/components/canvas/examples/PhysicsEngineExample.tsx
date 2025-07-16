/**
 * Example component demonstrating how to use the usePhysicsEngine hook
 * This shows the integration pattern that would be used in the refactored DraggableCanvas
 */

import React, { useEffect } from 'react';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine';
import { CardPhysics } from '../types/canvas';

export const PhysicsEngineExample: React.FC = () => {
  const {
    cardPhysics,
    animationTime,
    initializeCard,
    updateCardPhysics,
    startDrag,
    updateDrag,
    endDrag,
    getDistance,
    findNearestCard,
  } = usePhysicsEngine({
    friction: 0.95,
    minVelocity: 0.1,
    collisionRadius: 30,
    enableCollisions: false,
    enableBounceBack: true,
  });

  // Initialize some example cards
  useEffect(() => {
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

    initializeCard('main', card1);
    initializeCard('feature-branch', card2);
  }, [initializeCard]);

  // Example drag handlers
  const handleStartDrag = (id: string, position: { x: number; y: number }) => {
    startDrag(id, position);
  };

  const handleDrag = (id: string, position: { x: number; y: number }) => {
    updateDrag(id, position);
    
    // Example: Find nearest card for drag targeting
    const nearestCard = findNearestCard(position, id);
    if (nearestCard) {
      const distance = getDistance(position, cardPhysics[nearestCard].position);
      if (distance < 50) {
        // Mark as drag target
        updateCardPhysics(nearestCard, { isDragTarget: true });
      }
    }
  };

  const handleEndDrag = (id: string) => {
    // Clear all drag targets
    Object.keys(cardPhysics).forEach(cardId => {
      if (cardPhysics[cardId].isDragTarget) {
        updateCardPhysics(cardId, { isDragTarget: false });
      }
    });
    
    endDrag(id);
  };

  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-hidden">
      <div className="absolute top-4 left-4 text-white">
        <h2 className="text-xl font-bold mb-2">Physics Engine Example</h2>
        <p className="text-sm text-gray-400">Animation Time: {Math.floor(animationTime / 1000)}s</p>
        <p className="text-sm text-gray-400">Cards: {Object.keys(cardPhysics).length}</p>
      </div>
      
      {/* Render cards */}
      {Object.entries(cardPhysics).map(([id, physics]) => (
        <div
          key={id}
          className={`absolute w-16 h-16 rounded-full border-2 cursor-pointer transition-all duration-200 ${
            physics.isDragTarget 
              ? 'bg-orange-400 border-orange-300 shadow-lg shadow-orange-400/50' 
              : physics.isDragging
              ? 'bg-blue-400 border-blue-300 shadow-lg shadow-blue-400/50'
              : 'bg-green-400 border-green-300 shadow-lg shadow-green-400/50'
          }`}
          style={{
            left: `${physics.position.x - 32}px`,
            top: `${physics.position.y - 32}px`,
            transform: physics.isDragTarget ? 'scale(1.2)' : physics.isDragging ? 'scale(1.1)' : 'scale(1)',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            handleStartDrag(id, { x: e.clientX, y: e.clientY });
            
            const handleMouseMove = (moveEvent: MouseEvent) => {
              handleDrag(id, { x: moveEvent.clientX, y: moveEvent.clientY });
            };
            
            const handleMouseUp = () => {
              handleEndDrag(id);
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-white">{id.slice(0, 4)}</span>
          </div>
          
          {/* Velocity indicator */}
          {(Math.abs(physics.velocity.x) > 0.1 || Math.abs(physics.velocity.y) > 0.1) && (
            <div
              className="absolute w-1 h-8 bg-red-400 origin-bottom"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) rotate(${Math.atan2(physics.velocity.y, physics.velocity.x) * 180 / Math.PI + 90}deg)`,
                height: `${Math.min(Math.sqrt(physics.velocity.x ** 2 + physics.velocity.y ** 2) * 10, 40)}px`,
              }}
            />
          )}
        </div>
      ))}
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-white text-sm">
        <p>• Drag the circles to move them around</p>
        <p>• Orange glow indicates drag target</p>
        <p>• Red lines show velocity vectors</p>
      </div>
    </div>
  );
};