'use client';

import React from 'react';
import DraggableCanvas from '../components/DraggableCanvas';

export default function DragTest() {
  return (
    <div className="w-full h-screen">
      <DraggableCanvas 
        owner="facebook" 
        repo="react"
      />
    </div>
  );
}