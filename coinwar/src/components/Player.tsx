import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore, BOARD_SIZE, getTilePosition } from '../store';

// 根据一维的格子索引（允许小数），计算在 3D 空间中的实际坐标
export function getInterpolatedPosition(vPos: number): THREE.Vector3 {
  const index1 = Math.floor(vPos) % BOARD_SIZE;
  const index2 = (index1 + 1) % BOARD_SIZE;
  const t = vPos - Math.floor(vPos); // 获取小数部分作为插值比例
  const p1 = getTilePosition(index1);
  const p2 = getTilePosition(index2);
  return new THREE.Vector3(
    p1[0] + (p2[0] - p1[0]) * t,
    0, // 改为 0，修复浮空问题，使玩家底部贴合地面
    p1[2] + (p2[2] - p1[2]) * t
  );
}

// 单个玩家的 3D 渲染组件
export function PlayerComponent({ id }: { id: string }) {
  const player = useGameStore(state => state.players.find(p => p.id === id));
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  // 记录视觉位置（用于平滑移动，与逻辑位置区分开）
  const visualPosRef = useRef(player?.position || 0);

  // useFrame 是 React Three Fiber 的每帧渲染钩子
  useFrame((state, delta) => {
    if (!player || !groupRef.current) return;

    // 如果游戏重置，瞬间将视觉位置归零
    if (player.position === 0 && player.bankedCoins === 0 && player.carriedCoins === 0 && player.stepsRemaining === 0) {
      visualPosRef.current = 0;
    }

    // 计算视觉位置向逻辑位置移动的差值
    let diff = player.position - visualPosRef.current;
    // 处理环形棋盘的跨越（例如从 39 走到 0）
    if (diff < -BOARD_SIZE / 2) diff += BOARD_SIZE;
    if (diff > BOARD_SIZE / 2) diff -= BOARD_SIZE;

    // 移动速度：每秒 5 个格子
    const moveSpeed = 5;
    if (Math.abs(diff) > 0.01) {
      visualPosRef.current += Math.sign(diff) * Math.min(Math.abs(diff), moveSpeed * delta);
    } else {
      visualPosRef.current = player.position;
    }

    // 确保视觉位置在合法范围内循环
    if (visualPosRef.current >= BOARD_SIZE) visualPosRef.current -= BOARD_SIZE;
    if (visualPosRef.current < 0) visualPosRef.current += BOARD_SIZE;

    const pos3D = getInterpolatedPosition(visualPosRef.current);
    
    // 计算玩家朝向：获取稍微靠前一点的位置，计算方向向量
    const nextPos3D = getInterpolatedPosition((visualPosRef.current + 0.1) % BOARD_SIZE);
    const dx = nextPos3D.x - pos3D.x;
    const dz = nextPos3D.z - pos3D.z;
    const angle = Math.atan2(dx, dz);

    // 添加视觉偏移，避免玩家重叠
    const playerIndex = useGameStore.getState().players.findIndex(p => p.id === id);
    const offsetAmount = (playerIndex - 1) * 0.25; // 3个玩家分别偏移 -0.25, 0, 0.25
    const offsetX = Math.cos(angle) * offsetAmount;
    const offsetZ = -Math.sin(angle) * offsetAmount;

    groupRef.current.position.set(pos3D.x + offsetX, pos3D.y, pos3D.z + offsetZ);
    groupRef.current.rotation.y = angle;

    // 添加移动时的跳跃动画（利用正弦函数）
    const isMoving = Math.abs(diff) > 0.01;
    if (isMoving && bodyRef.current) {
      bodyRef.current.position.y = 0.5 + Math.abs(Math.sin(visualPosRef.current * Math.PI)) * 0.5;
    } else if (bodyRef.current) {
      bodyRef.current.position.y = 0.5;
    }
  });

  if (!player) return null;

  // Generate coin meshes for the backpack
  const maxCoins = Math.min(player.carriedCoins, 100); // Limit to 100 meshes for performance, tall stack!
  const coins = [];
  for (let i = 0; i < maxCoins; i++) {
    // Stack in a single tall column behind the player
    const stackX = 0;
    const stackZ = -0.4; // Negative Z is behind
    const stackY = i * 0.06 + 0.05; // 0.06 height per coin
    
    // Add a little randomness to make it look like a messy, precarious pile
    const randomOffsetX = Math.sin(i * 123) * 0.03;
    const randomOffsetZ = Math.cos(i * 321) * 0.03;
    const randomRotY = Math.sin(i * 456) * Math.PI;
    const randomRotX = Math.sin(i * 789) * 0.1; // slight tilt
    const randomRotZ = Math.cos(i * 987) * 0.1;

    coins.push(
      <mesh key={i} position={[stackX + randomOffsetX, stackY, stackZ + randomOffsetZ]} rotation={[randomRotX, randomRotY, randomRotZ]}>
        <cylinderGeometry args={[0.15, 0.15, 0.05, 12]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
      </mesh>
    );
  }

  return (
    <group ref={groupRef}>
      <group ref={bodyRef} position={[0, 0.5, 0]}>
        {/* Player Body */}
        <mesh>
          <cylinderGeometry args={[0.3, 0.3, 1, 16]} />
          <meshStandardMaterial color={player.color} />
        </mesh>
        
        {/* Visor (Front) to indicate facing direction */}
        <mesh position={[0, 0.2, 0.25]}>
          <boxGeometry args={[0.4, 0.2, 0.15]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        
        {/* "ME" Indicator for human player */}
        {!player.isAI && (
          <Billboard position={[0, 1.2, 0]}>
            <Text fontSize={0.4} color="#fbbf24" outlineWidth={0.04} outlineColor="#000" fontWeight="bold">
              ME
            </Text>
            <Text position={[0, -0.25, 0]} fontSize={0.2} color="#fbbf24" outlineWidth={0.02} outlineColor="#000">
              ▼
            </Text>
          </Billboard>
        )}
        
        {/* Carried Coins (Backpack) */}
        <group position={[0, -0.5, 0]}>
          {coins}
          
          {player.carriedCoins > 0 && (
            <Billboard position={[0, maxCoins * 0.06 + 0.3, -0.4]}>
              <Text fontSize={0.4} color="#fbbf24" outlineWidth={0.02} outlineColor="#000" fontWeight="bold">
                {player.carriedCoins}
              </Text>
            </Billboard>
          )}
        </group>
      </group>

      {/* Message */}
      {player.message && (
        <Billboard position={[0, 2.5, 0]}>
          <Text fontSize={0.4} color="#ef4444" outlineWidth={0.02} outlineColor="#fff" fontWeight="bold">
            {player.message}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

export function Players() {
  const players = useGameStore(state => state.players);
  const gameId = useGameStore(state => state.gameId);
  return (
    <group>
      {players.map(p => (
        <PlayerComponent key={`${gameId}-${p.id}`} id={p.id} />
      ))}
    </group>
  );
}
