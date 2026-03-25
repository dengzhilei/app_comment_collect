import React from 'react';
import { useGameStore, getHalfGrid } from '../store';
import { Text } from '@react-three/drei';

export function CenterLandmark() {
  const players = useGameStore(state => state.players);
  const winTarget = useGameStore(state => state.settings.winTarget);
  const boardSize = useGameStore(state => state.settings.boardSize);

  const halfGrid = getHalfGrid(boardSize);
  const scale = halfGrid / 5;
  const baseRadius = 3 * scale;
  const pillarRadius = 1.5 * scale;
  const pillarWidth = 0.4 * scale;

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[baseRadius, baseRadius + 0.2 * scale, 0.2, 32]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      
      {players.map((p, i) => {
        const angle = (i / players.length) * Math.PI * 2;
        const x = Math.cos(angle) * pillarRadius;
        const z = Math.sin(angle) * pillarRadius;
        
        const progress = Math.min(p.bankedCoins / winTarget, 1);
        const maxHeight = 4;
        const currentHeight = Math.max(progress * maxHeight, 0.1);

        return (
          <group key={p.id} position={[x, 0, z]}>
            <mesh position={[0, currentHeight / 2, 0]}>
              <cylinderGeometry args={[pillarWidth, pillarWidth, currentHeight, 16]} />
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
