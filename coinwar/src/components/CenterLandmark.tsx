import React, { Suspense } from 'react';
import { useGameStore, getHalfGrid } from '../store';
import { Text, Billboard } from '@react-three/drei';
import { ClippedBuilding } from './ClippedBuilding';

const MODEL_PATH = '/models/sculpture.glb';

function CylinderFallback({ color, progress, maxHeight, width }: { color: string; progress: number; maxHeight: number; width: number }) {
  const currentHeight = Math.max(progress * maxHeight, 0.1);
  return (
    <mesh position={[0, currentHeight / 2, 0]}>
      <cylinderGeometry args={[width, width, currentHeight, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function CenterLandmark() {
  const players = useGameStore(state => state.players);
  const winTarget = useGameStore(state => state.settings.winTarget);
  const boardSize = useGameStore(state => state.settings.boardSize);

  const halfGrid = getHalfGrid(boardSize);
  const layoutScale = halfGrid / 5;
  const pillarRadius = 2.0 * layoutScale;
  const modelScale = 1.2 * layoutScale;

  return (
    <group position={[0, 0, 0]}>
      {players.map((p, i) => {
        const angle = (i / players.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * pillarRadius;
        const z = Math.sin(angle) * pillarRadius;
        const progress = Math.min(p.bankedCoins / winTarget, 1);
        const labelY = progress * 3 * modelScale + 1.0;

        return (
          <group key={p.id} position={[x, 0, z]}>
            <Suspense fallback={<CylinderFallback color={p.color} progress={progress} maxHeight={3 * modelScale} width={0.3 * modelScale} />}>
              <ClippedBuilding
                modelPath={MODEL_PATH}
                progress={progress}
                position={[0, 0, 0]}
                scale={modelScale}
                renderOrderBase={i * 10}
              />
            </Suspense>
            <Billboard position={[0, labelY, 0]}>
              <Text fontSize={0.5} color={p.color} outlineWidth={0.03} outlineColor="#000" fontWeight="bold">
                {p.bankedCoins}
              </Text>
            </Billboard>
            <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.8 * modelScale, 1.1 * modelScale, 32]} />
              <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={0.6} transparent opacity={0.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
