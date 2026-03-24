import React from 'react';
import { useGameStore } from '../store';
import { Text } from '@react-three/drei';

export function CenterLandmark() {
  const players = useGameStore(state => state.players);
  const winTarget = useGameStore(state => state.settings?.winTarget || 200);

  return (
    <group position={[0, 0, 0]}>
      {/* Base */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[3, 3.2, 0.2, 32]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      
      {/* Progress Pillars */}
      {players.map((p, i) => {
        const angle = (i / players.length) * Math.PI * 2;
        const radius = 1.5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        const progress = Math.min(p.bankedCoins / winTarget, 1);
        const maxHeight = 4;
        const currentHeight = Math.max(progress * maxHeight, 0.1);

        return (
          <group key={p.id} position={[x, 0, z]}>
            <mesh position={[0, currentHeight / 2, 0]}>
              <cylinderGeometry args={[0.4, 0.4, currentHeight, 16]} />
              <meshStandardMaterial color={p.color} />
            </mesh>
            <Text position={[0, currentHeight + 0.5, 0]} fontSize={0.4} color={p.color} outlineWidth={0.02} outlineColor="#fff">
              {p.bankedCoins}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
