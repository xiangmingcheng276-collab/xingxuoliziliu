import React from 'react';
import { Visualizer } from './components/Visualizer';

export default function App() {
  return (
    <div className="fixed inset-0 w-full h-full bg-black text-white overflow-hidden">
      <Visualizer />
    </div>
  );
}