import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface ClippedBuildingProps {
  modelPath: string;
  progress: number;
  position: [number, number, number];
  scale?: number;
  /**
   * 每个实例必须用不同的 base 来隔离 stencil buffer（0, 10, 20…）
   * 确保渲染顺序：stencil pass → cap → model，各玩家之间不冲突
   */
  renderOrderBase?: number;
}

export function ClippedBuilding({
  modelPath,
  progress,
  position,
  scale = 1,
  renderOrderBase = 0,
}: ClippedBuildingProps) {
  const gltf = useGLTF(modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const clipHeightRef = useRef(0);
  const { scene: rootScene } = useThree();

  const { clonedScene, clipPlane, capPlaneMesh, stencilGroup, modelMinY, modelMaxY } =
    useMemo(() => {
      const scene = gltf.scene.clone(true);

      // ---- 模型归一化 + 缩放 ----
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const normScale = (3.0 / maxDim) * scale;
      scene.scale.multiplyScalar(normScale);

      box.setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.x -= center.x;
      scene.position.z -= center.z;
      scene.position.y -= box.min.y;

      box.setFromObject(scene);
      const minY = box.min.y;
      const maxY = box.max.y;

      // ---- Clip Plane（世界空间，初始值卡在底部）----
      const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), minY);

      // ---- 给模型 mesh 上 clippingPlane ----
      scene.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const newMats = mats.map((m) => {
          const mc = (m as THREE.MeshStandardMaterial).clone();
          mc.clippingPlanes = [plane];
          mc.clipShadows = true;
          mc.side = THREE.DoubleSide;
          return mc;
        });
        mesh.material = Array.isArray(mesh.material) ? newMats : newMats[0];
        mesh.renderOrder = renderOrderBase + 6;
      });

      scene.updateMatrixWorld(true);

      // ---- Stencil Group（完全对照 model_test / Three.js 官方 webgl_clipping_stencil）----
      const sGroup = new THREE.Group();
      scene.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const geo = mesh.geometry;

        const baseMat = new THREE.MeshBasicMaterial();
        baseMat.depthWrite = false;
        baseMat.depthTest = false;
        baseMat.colorWrite = false;
        baseMat.stencilWrite = true;
        baseMat.stencilFunc = THREE.AlwaysStencilFunc;

        // 背面 → stencil +1
        const backMat = baseMat.clone();
        backMat.side = THREE.BackSide;
        backMat.clippingPlanes = [plane];
        backMat.stencilFail = THREE.IncrementWrapStencilOp;
        backMat.stencilZFail = THREE.IncrementWrapStencilOp;
        backMat.stencilZPass = THREE.IncrementWrapStencilOp;
        const backMesh = new THREE.Mesh(geo, backMat);
        backMesh.applyMatrix4(mesh.matrixWorld);
        backMesh.renderOrder = renderOrderBase + 1;
        sGroup.add(backMesh);

        // 正面 → stencil -1
        const frontMat = baseMat.clone();
        frontMat.side = THREE.FrontSide;
        frontMat.clippingPlanes = [plane];
        frontMat.stencilFail = THREE.DecrementWrapStencilOp;
        frontMat.stencilZFail = THREE.DecrementWrapStencilOp;
        frontMat.stencilZPass = THREE.DecrementWrapStencilOp;
        const frontMesh = new THREE.Mesh(geo, frontMat);
        frontMesh.applyMatrix4(mesh.matrixWorld);
        frontMesh.renderOrder = renderOrderBase + 1;
        sGroup.add(frontMesh);
      });

      // ---- Cap Plane（模型截面封口）----
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xccaa88,
        metalness: 0.1,
        roughness: 0.75,
        stencilWrite: true,
        stencilRef: 0,
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilFail: THREE.ReplaceStencilOp,
        stencilZFail: THREE.ReplaceStencilOp,
        stencilZPass: THREE.ReplaceStencilOp,
      });
      const capMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), capMat);
      capMesh.renderOrder = renderOrderBase + 1.1;
      capMesh.visible = false;
      capMesh.onAfterRender = (r: THREE.WebGLRenderer) => {
        r.clearStencil();
      };

      return {
        clonedScene: scene,
        clipPlane: plane,
        capPlaneMesh: capMesh,
        stencilGroup: sGroup,
        modelMinY: minY,
        modelMaxY: maxY,
      };
    }, [gltf.scene, scale, renderOrderBase]);

  // ---- 关键：stencilGroup 和 capPlaneMesh 挂到 scene 根节点（与 model_test 一致）----
  useEffect(() => {
    rootScene.add(stencilGroup);
    rootScene.add(capPlaneMesh);
    return () => {
      rootScene.remove(stencilGroup);
      rootScene.remove(capPlaneMesh);
    };
  }, [rootScene, stencilGroup, capPlaneMesh]);

  useEffect(() => {
    clipHeightRef.current = modelMinY;
  }, [modelMinY]);

  useFrame(() => {
    if (!groupRef.current) return;

    // 平滑插值 clip 高度
    const extra = (modelMaxY - modelMinY) * 0.02;
    const targetH = modelMinY + progress * (modelMaxY - modelMinY + extra);
    clipHeightRef.current += (targetH - clipHeightRef.current) * 0.08;

    // 模型组的世界坐标
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);

    // clipPlane 是世界空间的
    clipPlane.constant = clipHeightRef.current + worldPos.y;

    // stencilGroup 跟模型保持相同的世界偏移
    stencilGroup.position.copy(worldPos);

    // capPlaneMesh：用 coplanarPoint + lookAt，与 model_test 完全一致
    const showCap = progress > 0.005 && progress < 0.995;
    clipPlane.coplanarPoint(capPlaneMesh.position);
    capPlaneMesh.lookAt(
      capPlaneMesh.position.x - clipPlane.normal.x,
      capPlaneMesh.position.y - clipPlane.normal.y,
      capPlaneMesh.position.z - clipPlane.normal.z,
    );
    capPlaneMesh.visible = showCap;
    stencilGroup.visible = showCap;
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload('/models/sculpture.glb');
