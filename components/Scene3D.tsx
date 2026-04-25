import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Center, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { PointCloudData } from '../types';

// Fix for missing JSX types in some environments
declare global {
  namespace JSX {
    interface IntrinsicElements {
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      pointsMaterial: any;
      ambientLight: any;
      color: any;
    }
  }
}

interface PointCloudProps {
  data: PointCloudData;
  pointSize: number;
}

const PointCloud: React.FC<PointCloudProps> = ({ data, pointSize }) => {
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // Update bounding sphere when data changes
  // Attributes are updated declaratively via the children of bufferGeometry.
  useEffect(() => {
    console.log('PointCloud data changed, positions length:', data.positions.length);
    if (geometryRef.current) {
      geometryRef.current.computeBoundingSphere();
      // Ensure attributes are updated
      const positionAttr = geometryRef.current.getAttribute('position');
      const colorAttr = geometryRef.current.getAttribute('color');
      if (positionAttr) positionAttr.needsUpdate = true;
      if (colorAttr) colorAttr.needsUpdate = true;
    }
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
        sizeAttenuation={true}
        depthWrite={true}
        transparent={false}
      />
    </points>
  );
};

// Camera adjustment helper
const CameraAdjuster = () => {
    const { camera } = useThree();
    useEffect(() => {
        camera.position.set(0, 0, 15);
        camera.lookAt(0, 0, 0);
    }, [camera]);
    return null;
}


interface Scene3DProps {
  data: PointCloudData;
  pointSize: number;
}

const Scene3D: React.FC<Scene3DProps> = ({ data, pointSize }) => {
  return (
    <div className="w-full h-full bg-black rounded-lg overflow-hidden border border-slate-700 shadow-2xl relative">
       <div className="hidden md:block absolute top-4 left-4 z-10 bg-slate-800/80 backdrop-blur px-3 py-1 rounded text-xs text-slate-300 pointer-events-none">
          Left Click: Rotate | Right Click: Pan | Scroll: Zoom
       </div>
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        
        <Center>
            <PointCloud data={data} pointSize={pointSize} />
        </Center>
        
        <OrbitControls makeDefault />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
        </GizmoHelper>
      </Canvas>
    </div>
  );
};

export default Scene3D;