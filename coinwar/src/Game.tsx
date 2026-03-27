import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Board } from './components/Board';
import { Players, getInterpolatedPosition } from './components/Player';
import { CenterLandmark } from './components/CenterLandmark';
import { UI } from './components/UI';
import { useGameStore } from './store';

function CameraController() {
  const players = useGameStore(state => state.players);
  const turnMode = useGameStore(state => state.settings.turnMode);
  const cameraMode = useGameStore(state => state.cameraMode);
  const cameraZoom = useGameStore(state => state.cameraZoom);
  const boardSize = useGameStore(state => state.settings.boardSize);
  
  // 获取当前人类玩家（非 AI）
  const humanPlayer = players.find(p => !p.isAI);

  // 决定摄像机跟随的目标
  let targetPlayer = humanPlayer || players[0];

  if (turnMode === 'turn-based') {
    const currentPlayerIndex = useGameStore(state => state.currentPlayerIndex);
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer) {
      targetPlayer = currentPlayer;
    }
  }

  // 记录摄像机当前跟随的视觉位置（用于平滑插值）
  const visualPosRef = useRef(targetPlayer?.position || 0);
  // 记录摄像机逻辑上的目标位置
  const logicalTargetPosRef = useRef(targetPlayer?.position || 0);
  // 记录摄像机当前的观察目标点
  const lookAtRef = useRef(new THREE.Vector3());
  // 标记是否为第一帧
  const isFirstFrame = useRef(true);

  // 记录回合是否刚刚切换
  const prevTurnIndexRef = useRef(useGameStore.getState().currentPlayerIndex);
  const turnJustSwitchedRef = useRef(false);

  // 记录 AI 回合的静态镜头目标
  const aiStaticCamPosRef = useRef<number | null>(null);
  const prevDiceResultRef = useRef<[number, number] | null>(null);

  // 在渲染阶段检测回合切换
  const currentTurnIndex = useGameStore(state => state.currentPlayerIndex);
  if (prevTurnIndexRef.current !== currentTurnIndex) {
    turnJustSwitchedRef.current = true;
    prevTurnIndexRef.current = currentTurnIndex;
  }

  // 辅助函数：计算环形棋盘上的最短距离
  const getDist = (a: number, b: number) => {
    let d = Math.abs(a - b);
    if (d > boardSize / 2) d = boardSize - d;
    return d;
  };

  const getDiff = (from: number, to: number) => {
    let diff = to - from;
    if (diff < -boardSize / 2) diff += boardSize;
    if (diff > boardSize / 2) diff -= boardSize;
    return diff;
  };

  const getMidpoint = (a: number, b: number) => {
    let mid = a + getDiff(a, b) / 2;
    return (mid + boardSize) % boardSize;
  };

  useFrame((state, delta) => {
    if (!targetPlayer) return;

    // 如果游戏重置（所有玩家的位置、金币、步数都归零），则瞬间将视觉位置归零
    const isGameReset = players.every(p => p.position === 0 && p.bankedCoins === 0 && p.carriedCoins === 0 && p.stepsRemaining === 0);
    if (isGameReset) {
      if (visualPosRef.current !== 0) {
        visualPosRef.current = 0;
        logicalTargetPosRef.current = 0;
        isFirstFrame.current = true;
      }
    }

    let targetCamPos = logicalTargetPosRef.current;
    let shouldHardCut = false;
    const VIEW_RADIUS = 12; // 视野半径（格），保证能看到一次完整的移动（最大12格）

    if (turnMode === 'turn-based') {
      const currentPlayerIndex = useGameStore.getState().currentPlayerIndex;
      const currentPlayer = players[currentPlayerIndex];
      const isHumanTurn = currentPlayer?.id === humanPlayer?.id;

      // 检查骰子结果是否发生变化（刚刚掷骰子）
      const justRolled = currentPlayer && currentPlayer.diceResult !== null && prevDiceResultRef.current === null;
      prevDiceResultRef.current = currentPlayer?.diceResult || null;

      // 如果回合切换，清除静态镜头记录
      if (turnJustSwitchedRef.current) {
        aiStaticCamPosRef.current = null;
      }

      if (isHumanTurn && humanPlayer) {
        // 1. 人类回合：跟随人类（带小死区，保持平滑）
        let diffToHuman = getDiff(logicalTargetPosRef.current, humanPlayer.position);
        const DEADZONE = 2; // 人类移动时的死区
        
        // 如果回合刚刚切换到人类，且人类不在死区内，则强切（跳变）
        if (turnJustSwitchedRef.current && Math.abs(diffToHuman) > DEADZONE) {
          shouldHardCut = true;
          targetCamPos = humanPlayer.position;
          useGameStore.getState().setPauseUntil(Date.now() + 500);
        } else {
          if (diffToHuman > DEADZONE) {
            targetCamPos = logicalTargetPosRef.current + (diffToHuman - DEADZONE);
          } else if (diffToHuman < -DEADZONE) {
            targetCamPos = logicalTargetPosRef.current + (diffToHuman + DEADZONE);
          }
        }
      } else if (currentPlayer) {
        // 2. AI 回合：计算静态最佳镜头位置，过程不平移
        const pendingDice = currentPlayer.diceResult || currentPlayer.nextDiceResult;
        
        // 只有在刚刚掷骰子时，或者还没有计算过时，才计算静态位置
        if (aiStaticCamPosRef.current === null && pendingDice !== null) {
          const startPos = currentPlayer.position;
          const steps = pendingDice[0] + pendingDice[1];
          const endPos = (startPos + steps) % boardSize;
          
          // 检查当前镜头是否能同时看到起点和终点
          const canSeeMove = getDist(logicalTargetPosRef.current, startPos) <= VIEW_RADIUS && 
                             getDist(logicalTargetPosRef.current, endPos) <= VIEW_RADIUS;
          
          if (canSeeMove) {
            // 情况1：完全不用动
            aiStaticCamPosRef.current = logicalTargetPosRef.current;
          } else {
            // 情况2&3：必须切，找一个最合适的地方
            shouldHardCut = true;
            useGameStore.getState().setPauseUntil(Date.now() + 500);
            const midPos = getMidpoint(startPos, endPos);
            
            const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
            const isHumanNext = players[nextPlayerIndex]?.id === humanPlayer?.id;

            if (isHumanNext && humanPlayer) {
              // 优先考虑人类位置：在保证能看到 AI 完整移动的前提下，尽量靠近人类，省去下一次切换
              const maxDev = Math.max(0, VIEW_RADIUS - steps / 2); // 镜头最多能偏离中点的距离
              const diffHumanMid = getDiff(midPos, humanPlayer.position);
              
              // 将镜头向人类方向偏移，但不能超过 maxDev
              const shift = Math.sign(diffHumanMid) * Math.min(Math.abs(diffHumanMid), maxDev);
              aiStaticCamPosRef.current = (midPos + shift + boardSize) % boardSize;
            } else {
              // 下一个不是人类，直接居中显示 AI 的移动
              aiStaticCamPosRef.current = midPos;
            }
          }
        }

        // 如果还没有掷骰子（等待中），或者已经计算好静态位置，保持镜头不动
        if (aiStaticCamPosRef.current !== null) {
          targetCamPos = aiStaticCamPosRef.current;
        } else {
          // 还没掷骰子，而且之前也没记录过，就保持当前位置
          targetCamPos = logicalTargetPosRef.current;
        }
      }
    } else {
      // simultaneous mode
      targetCamPos = humanPlayer?.position || 0;
    }

    // 重置回合切换标记
    turnJustSwitchedRef.current = false;

    // 规范化 targetCamPos
    targetCamPos = (targetCamPos + boardSize) % boardSize;

    if (shouldHardCut) {
      logicalTargetPosRef.current = targetCamPos;
      visualPosRef.current = targetCamPos;
      isFirstFrame.current = true;
    } else {
      logicalTargetPosRef.current = targetCamPos;
      // 平滑插值
      let diffToTarget = getDiff(visualPosRef.current, logicalTargetPosRef.current);
      const moveSpeed = Math.max(5, Math.abs(diffToTarget) * 3);
      if (Math.abs(diffToTarget) > 0.01) {
        visualPosRef.current += Math.sign(diffToTarget) * Math.min(Math.abs(diffToTarget), moveSpeed * delta);
      } else {
        visualPosRef.current = logicalTargetPosRef.current;
      }
    }

    // 规范化 visualPosRef
    visualPosRef.current = (visualPosRef.current + boardSize) % boardSize;

    const pos3D = getInterpolatedPosition(visualPosRef.current, boardSize);
    const nextPos3D = getInterpolatedPosition((visualPosRef.current + 0.1) % boardSize, boardSize);
    
    // 计算玩家朝向的角度 (Y轴旋转)
    const dx = nextPos3D.x - pos3D.x;
    const dz = nextPos3D.z - pos3D.z;
    const angle = Math.atan2(dx, dz);

    const groupOffsetY = 0; // 补偿整个场景组的 Y 轴偏移（已在 getInterpolatedPosition 中修复为 0）
    
    let targetPos: THREE.Vector3;
    let targetLookAt: THREE.Vector3;

    const z = 1 / cameraZoom;

    if (cameraMode === 'isometric') {
      targetPos = new THREE.Vector3(pos3D.x + 8 * z, pos3D.y + groupOffsetY + 10 * z, pos3D.z + 8 * z);
      targetLookAt = new THREE.Vector3(pos3D.x, pos3D.y + groupOffsetY, pos3D.z);
    } else if (cameraMode === 'top-down') {
      targetPos = new THREE.Vector3(pos3D.x, pos3D.y + groupOffsetY + 14 * z, pos3D.z + 3 * z);
      targetLookAt = new THREE.Vector3(pos3D.x, pos3D.y + groupOffsetY, pos3D.z);
    } else {
      const distance = 6 * z;
      const height = 4.5 * z;
      const camX = pos3D.x - Math.sin(angle) * distance;
      const camZ = pos3D.z - Math.cos(angle) * distance;
      const camY = pos3D.y + groupOffsetY + height;

      targetPos = new THREE.Vector3(camX, camY, camZ);
      targetLookAt = new THREE.Vector3(
        pos3D.x + Math.sin(angle) * 2,
        pos3D.y + groupOffsetY + 0.5,
        pos3D.z + Math.cos(angle) * 2
      );
    }

    if (isFirstFrame.current) {
      // 第一帧直接设置位置，不进行插值平滑
      state.camera.position.copy(targetPos);
      lookAtRef.current.copy(targetLookAt);
      isFirstFrame.current = false;
    } else {
      // 平滑插值摄像机位置和观察点
      state.camera.position.lerp(targetPos, 5 * delta);
      lookAtRef.current.lerp(targetLookAt, 5 * delta);
    }
    
    // 让摄像机看向目标点
    state.camera.lookAt(lookAtRef.current);
  });

  return null;
}

function FlyingCoins() {
  const flyingCoins = useGameStore(state => state.flyingCoins);
  
  return (
    <group>
      {flyingCoins.map(coin => (
        <FlyingCoinMesh key={coin.id} coin={coin} />
      ))}
    </group>
  );
}

function FlyingCoinMesh({ coin }: { coin: import('./store').FlyingCoin }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const baseScale = coin.scale ?? 1;

  useFrame(() => {
    if (!meshRef.current) return;
    
    const elapsed = Date.now() - coin.startTime;
    if (elapsed < 0 || elapsed > coin.duration) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    const progress = Math.min(elapsed / coin.duration, 1);
    const easeProgress = progress * (2 - progress);
    
    const arcHeight = 3;
    const yOffset = Math.sin(progress * Math.PI) * arcHeight;

    meshRef.current.position.set(
      coin.startPos[0] + (coin.endPos[0] - coin.startPos[0]) * easeProgress,
      coin.startPos[1] + (coin.endPos[1] - coin.startPos[1]) * easeProgress + yOffset,
      coin.startPos[2] + (coin.endPos[2] - coin.startPos[2]) * easeProgress
    );

    meshRef.current.rotation.y += 0.2;
    meshRef.current.rotation.x += 0.1;

    const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
    const s = baseScale * fadeOut;
    meshRef.current.scale.set(s, s, s);

    if (matRef.current) {
      matRef.current.opacity = fadeOut;
    }
  });

  const color = coin.color || '#fbbf24';

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[0.15, 0.15, 0.05, 12]} />
      <meshStandardMaterial ref={matRef} color={color} metalness={0.8} roughness={0.2} transparent />
    </mesh>
  );
}

export function Game() {
  const tick = useGameStore(state => state.tick);
  const players = useGameStore(state => state.players);

  // 游戏主循环：每 200ms 执行一次 tick，处理玩家移动、AI 决策、触发陷阱等逻辑
  useEffect(() => {
    if (players.length === 0) return;
    const interval = setInterval(tick, 200); // 每秒走 5 步
    return () => clearInterval(interval);
  }, [tick, players.length]);

  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-hidden font-sans">
      {/* 2D UI 覆盖层：显示骰子、玩家状态、游戏结束画面等 */}
      <UI />
      
      {players.length > 0 && (
        // 3D 渲染画布
        <Canvas shadows camera={{ position: [0, 15, 15], fov: 45 }} gl={{ localClippingEnabled: true, stencil: true }}>
          <color attach="background" args={['#111827']} />
          <ambientLight intensity={0.5} />
          <directionalLight
            castShadow
            position={[10, 20, 10]}
            intensity={1.5}
            shadow-mapSize={[1024, 1024]}
          />
          
          {/* 游戏场景主体，整体向下偏移一点以居中 */}
          <group position={[0, -0.5, 0]}>
            <Board />
            <Players />
            <CenterLandmark />
            <FlyingCoins />
            {/* 接触阴影，让物体看起来更贴合地面 */}
            <ContactShadows position={[0, -0.1, 0]} opacity={0.4} scale={20} blur={2} far={4} />
          </group>

          {/* 摄像机控制器：跟随玩家移动 */}
          <CameraController />
          {/* 环境光预设，提供更真实的反射和照明 */}
          <Environment preset="city" />
        </Canvas>
      )}
    </div>
  );
}
