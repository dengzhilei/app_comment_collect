import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Board } from './components/Board';
import { Players, getInterpolatedPosition } from './components/Player';
import { CenterLandmark } from './components/CenterLandmark';
import { UI } from './components/UI';
import { useGameStore, BOARD_SIZE } from './store';

// 摄像机控制器：负责在 3D 场景中跟随玩家（主视角）
function CameraController() {
  const players = useGameStore(state => state.players);
  const turnMode = useGameStore(state => state.settings.turnMode);
  const cameraMode = useGameStore(state => state.cameraMode);
  
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

  // 在渲染阶段检测回合切换
  const currentTurnIndex = useGameStore(state => state.currentPlayerIndex);
  if (prevTurnIndexRef.current !== currentTurnIndex) {
    turnJustSwitchedRef.current = true;
    prevTurnIndexRef.current = currentTurnIndex;
  }

  // 辅助函数：计算环形棋盘上的最短距离
  const getDist = (a: number, b: number) => {
    let d = Math.abs(a - b);
    if (d > BOARD_SIZE / 2) d = BOARD_SIZE - d;
    return d;
  };

  // 辅助函数：计算环形棋盘上的有向差值 (from -> to)
  const getDiff = (from: number, to: number) => {
    let diff = to - from;
    if (diff < -BOARD_SIZE / 2) diff += BOARD_SIZE;
    if (diff > BOARD_SIZE / 2) diff -= BOARD_SIZE;
    return diff;
  };

  // 辅助函数：计算环形棋盘上的中点
  const getMidpoint = (a: number, b: number) => {
    let mid = a + getDiff(a, b) / 2;
    return (mid + BOARD_SIZE) % BOARD_SIZE;
  };

  useFrame((state, delta) => {
    if (!targetPlayer) return;

    // 如果游戏重置（位置、金币、步数都归零），则瞬间将视觉位置归零
    // 只有当所有玩家都在起点时，才认为是游戏重置
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

      if (currentPlayer) {
        // 统一逻辑：跟随当前玩家（带小死区，保持平滑）
        let diffToPlayer = getDiff(logicalTargetPosRef.current, currentPlayer.position);
        const DEADZONE = 2; // 移动时的死区
        
        // 如果回合刚刚切换，且玩家不在死区内，则强切（跳变）
        if (turnJustSwitchedRef.current && Math.abs(diffToPlayer) > DEADZONE) {
          shouldHardCut = true;
          targetCamPos = currentPlayer.position;
          useGameStore.getState().setPauseUntil(Date.now() + 500);
        } else {
          if (diffToPlayer > DEADZONE) {
            targetCamPos = logicalTargetPosRef.current + (diffToPlayer - DEADZONE);
          } else if (diffToPlayer < -DEADZONE) {
            targetCamPos = logicalTargetPosRef.current + (diffToPlayer + DEADZONE);
          }
        }
      }
    } else {
      // simultaneous mode
      targetCamPos = humanPlayer?.position || 0;
    }

    // 重置回合切换标记
    turnJustSwitchedRef.current = false;

    // 规范化 targetCamPos
    targetCamPos = (targetCamPos + BOARD_SIZE) % BOARD_SIZE;

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
    visualPosRef.current = (visualPosRef.current + BOARD_SIZE) % BOARD_SIZE;

    // 获取当前视觉位置和稍微靠前一点的位置，用于计算玩家的朝向
    const pos3D = getInterpolatedPosition(visualPosRef.current);
    const nextPos3D = getInterpolatedPosition((visualPosRef.current + 0.1) % BOARD_SIZE);
    
    // 计算玩家朝向的角度 (Y轴旋转)
    const dx = nextPos3D.x - pos3D.x;
    const dz = nextPos3D.z - pos3D.z;
    const angle = Math.atan2(dx, dz);

    const groupOffsetY = 0; // 补偿整个场景组的 Y 轴偏移（已在 getInterpolatedPosition 中修复为 0）
    
    let targetPos: THREE.Vector3;
    let targetLookAt: THREE.Vector3;

    if (cameraMode === 'isometric') {
      // 等距视角：固定角度，跟随玩家
      targetPos = new THREE.Vector3(pos3D.x + 10, pos3D.y + groupOffsetY + 12, pos3D.z + 10);
      targetLookAt = new THREE.Vector3(pos3D.x, pos3D.y + groupOffsetY, pos3D.z);
    } else if (cameraMode === 'top-down') {
      // 俯视角：从正上方往下看，稍微带点角度
      targetPos = new THREE.Vector3(pos3D.x, pos3D.y + groupOffsetY + 18, pos3D.z + 4);
      targetLookAt = new THREE.Vector3(pos3D.x, pos3D.y + groupOffsetY, pos3D.z);
    } else {
      // 默认跟随视角：位于玩家后方，随玩家旋转
      const distance = 8;
      const height = 6;
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

  useFrame(() => {
    if (!meshRef.current) return;
    
    const elapsed = Date.now() - coin.startTime;
    if (elapsed < 0 || elapsed > coin.duration) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    const progress = Math.min(elapsed / coin.duration, 1);
    
    // Simple easing
    const easeProgress = progress * (2 - progress); // easeOutQuad
    
    // Arc height
    const arcHeight = 3;
    const yOffset = Math.sin(progress * Math.PI) * arcHeight;

    meshRef.current.position.set(
      coin.startPos[0] + (coin.endPos[0] - coin.startPos[0]) * easeProgress,
      coin.startPos[1] + (coin.endPos[1] - coin.startPos[1]) * easeProgress + yOffset,
      coin.startPos[2] + (coin.endPos[2] - coin.startPos[2]) * easeProgress
    );

    // Spin
    meshRef.current.rotation.y += 0.2;
    meshRef.current.rotation.x += 0.1;
  });

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[0.15, 0.15, 0.05, 12]} />
      <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
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
        <Canvas shadows camera={{ position: [0, 15, 15], fov: 45 }}>
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
