import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Center, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { PointCloudData } from '../types';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      pointsMaterial: any;
      ambientLight: any;
      color: any;
      fog: any;
    }
  }
}

interface PointCloudProps {
  data: PointCloudData;
  pointSize: number;
}

const PointCloud: React.FC<PointCloudProps> = ({ data, pointSize }) => {
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    if (!geometryRef.current) return;
    geometryRef.current.computeBoundingSphere();
    const positionAttr = geometryRef.current.getAttribute('position');
    const colorAttr = geometryRef.current.getAttribute('color');
    if (positionAttr) positionAttr.needsUpdate = true;
    if (colorAttr) colorAttr.needsUpdate = true;
  }, [data]);

  return (
    <points>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={data.positions.length / 3}
          array={data.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={data.colors.length / 3}
          array={data.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={pointSize}
        vertexColors
        sizeAttenuation
        depthWrite
        transparent={false}
      />
    </points>
  );
};

const CameraAdjuster: React.FC = () => {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
};

interface Scene3DProps {
  data: PointCloudData;
  pointSize: number;
}

const Scene3D: React.FC<Scene3DProps> = ({ data, pointSize }) => {
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const pointCount = data.positions.length / 3;
  const formattedCount =
    pointCount >= 1000
      ? `${(pointCount / 1000).toFixed(1)}k`
      : `${pointCount}`;

  return (
    <div className="relative w-full h-full rounded-md overflow-hidden border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] bg-black">
      {/* Top-left: stats */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="glass rounded-sm px-3 py-1.5 flex items-center gap-2 text-[11px] font-mono text-white/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
          {formattedCount} points
        </div>
        <div className="hidden sm:block glass rounded-sm px-3 py-1.5 text-[11px] font-mono text-white/60">
          {data.width}×{data.height}
        </div>
      </div>

      {/* Top-right: hint (auto-hides) */}
      {hintVisible && (
        <div className="absolute top-3 right-3 z-10 hidden md:flex items-center gap-3 glass rounded-sm px-3 py-1.5 text-[11px] font-mono text-white/70 animate-fade-in">
          <span><kbd className="text-white/90">L-Click</kbd> rotate</span>
          <span className="text-white/30">·</span>
          <span><kbd className="text-white/90">R-Click</kbd> pan</span>
          <span className="text-white/30">·</span>
          <span><kbd className="text-white/90">Scroll</kbd> zoom</span>
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 15], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={['#04040a']} />
        <fog attach="fog" args={['#04040a', 25, 55]} />
        <ambientLight intensity={0.6} />
        <CameraAdjuster />

        <Center>
          <PointCloud data={data} pointSize={pointSize} />
        </Center>

        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport axisColors={['#f87171', '#4ade80', '#60a5fa']} labelColor="white" />
        </GizmoHelper>
      </Canvas>
    </div>
  );
};

export default Scene3D;
