import React from 'react';
import { useGameStore, BOARD_SIZE, HALF_GRID, TileType, getTilePosition } from '../store';
import { Box, Text, Billboard } from '@react-three/drei';

const TILE_COLORS: Record<TileType, string> = {
  bank: '#fcd34d', // yellow-300
  normal: '#e5e7eb', // gray-200
  bonus: '#6ee7b7', // emerald-300
};

export function Board() {
  const tiles = useGameStore(state => state.tiles);
  const traps = useGameStore(state => state.traps);
  const droppedCoins = useGameStore(state => state.droppedCoins);

  return (
    <group>
      {tiles.map((type, index) => {
        const pos = getTilePosition(index);
        return (
          <group key={`tile-${index}`} position={pos}>
            <Box args={[0.9, 0.2, 0.9]} position={[0, -0.1, 0]}>
              <meshStandardMaterial color={TILE_COLORS[type]} />
            </Box>
            {type === 'bank' && (
              <Billboard position={[0, 0.4, 0]}>
                <Text fontSize={0.25} color="#fbbf24" outlineWidth={0.02} outlineColor="#000" fontWeight="bold">
                  BANK
                </Text>
              </Billboard>
            )}
            {type === 'bonus' && (
              <Billboard position={[0, 0.4, 0]}>
                <Text fontSize={0.25} color="#6ee7b7" outlineWidth={0.02} outlineColor="#000" fontWeight="bold">
                  BONUS
                </Text>
              </Billboard>
            )}
          </group>
        );
      })}

      {/* Render traps */}
      {traps.map(trap => {
        const pos = getTilePosition(trap.position);
        return (
          <Box key={trap.id} args={[0.5, 0.1, 0.5]} position={[pos[0], 0.05, pos[2]]}>
            <meshStandardMaterial color="#ef4444" />
          </Box>
        );
      })}

      {/* Render dropped coins */}
      {droppedCoins.map((coin) => {
        const pos = getTilePosition(coin.position);
        // Use coin.id as a stable seed instead of array index to prevent shifting
        const seed = parseInt(coin.id.substring(0, 8), 16) || coin.position;
        const offsetX = Math.sin(seed * 1234.5) * 0.2;
        const offsetZ = Math.cos(seed * 1234.5) * 0.2;
        
        const maxCoins = Math.min(coin.amount, 50); // 最多渲染 50 个金币模型以保证性能
        const coinMeshes = [];
        for (let j = 0; j < maxCoins; j++) {
          const stackY = j * 0.06 + 0.05;
          const randomOffsetX = Math.sin(j * 123) * 0.03;
          const randomOffsetZ = Math.cos(j * 321) * 0.03;
          const randomRotY = Math.sin(j * 456) * Math.PI;
          const randomRotX = Math.sin(j * 789) * 0.1;
          const randomRotZ = Math.cos(j * 987) * 0.1;

          coinMeshes.push(
            <mesh key={j} position={[randomOffsetX, stackY, randomOffsetZ]} rotation={[randomRotX, randomRotY, randomRotZ]}>
              <cylinderGeometry args={[0.15, 0.15, 0.05, 12]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
            </mesh>
          );
        }

        return (
          <group key={coin.id} position={[pos[0] + offsetX, 0, pos[2] + offsetZ]}>
            {coinMeshes}
            <Billboard position={[0, maxCoins * 0.06 + 0.3, 0]}>
              <Text fontSize={0.3} color="#fbbf24" outlineWidth={0.02} outlineColor="#000" fontWeight="bold">
                {coin.amount}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
