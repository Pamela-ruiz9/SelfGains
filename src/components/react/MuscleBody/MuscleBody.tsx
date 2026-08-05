import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';

interface MuscleBodyProps {
  selectedMuscle: string | null;
  onSelectMuscle: (id: string) => void;
}

type PartGeometry =
  | { type: 'box'; args: [number, number, number] }
  | { type: 'sphere'; args: [number] }
  | { type: 'capsule'; args: [number, number] };

interface MusclePartDef {
  muscleId: string;
  position: [number, number, number];
  geometry: PartGeometry;
}

interface StaticPartDef {
  position: [number, number, number];
  geometry: PartGeometry;
}

const STATIC_PARTS: StaticPartDef[] = [
  { position: [0, 1.55, 0], geometry: { type: 'sphere', args: [0.22] } },
  { position: [0, 1.3, 0], geometry: { type: 'box', args: [0.18, 0.16, 0.18] } },
  { position: [0, 0.85, 0], geometry: { type: 'box', args: [0.34, 0.75, 0.22] } },
  { position: [0.28, 1.13, 0], geometry: { type: 'sphere', args: [0.13] } },
  { position: [-0.28, 1.13, 0], geometry: { type: 'sphere', args: [0.13] } },
  { position: [0, 0.15, 0], geometry: { type: 'box', args: [0.4, 0.28, 0.24] } },
  { position: [0.2, -0.98, 0.08], geometry: { type: 'box', args: [0.14, 0.08, 0.28] } },
  { position: [-0.2, -0.98, 0.08], geometry: { type: 'box', args: [0.14, 0.08, 0.28] } },
];

function mirror(
  muscleId: string,
  x: number,
  y: number,
  z: number,
  geometry: PartGeometry
): MusclePartDef[] {
  return [
    { muscleId, position: [x, y, z], geometry },
    { muscleId, position: [-x, y, z], geometry },
  ];
}

const MUSCLE_PARTS: MusclePartDef[] = [
  { muscleId: 'pecho', position: [0, 0.98, 0.18], geometry: { type: 'box', args: [0.46, 0.32, 0.14] } },
  { muscleId: 'dorsales', position: [0, 0.82, -0.18], geometry: { type: 'box', args: [0.46, 0.4, 0.14] } },
  { muscleId: 'trapecio', position: [0, 1.2, -0.14], geometry: { type: 'box', args: [0.34, 0.16, 0.16] } },
  { muscleId: 'abdomen', position: [0, 0.55, 0.16], geometry: { type: 'box', args: [0.36, 0.3, 0.12] } },
  ...mirror('deltoide-frontal', 0.43, 1.15, 0.156, { type: 'sphere', args: [0.08] }),
  ...mirror('deltoide-lateral', 0.52, 1.15, 0, { type: 'sphere', args: [0.08] }),
  ...mirror('deltoide-posterior', 0.43, 1.15, -0.156, { type: 'sphere', args: [0.08] }),
  ...mirror('biceps', 0.44, 0.82, 0.1, { type: 'capsule', args: [0.09, 0.32] }),
  ...mirror('triceps', 0.44, 0.82, -0.1, { type: 'capsule', args: [0.09, 0.32] }),
  ...mirror('antebrazo', 0.44, 0.42, 0, { type: 'capsule', args: [0.075, 0.36] }),
  ...mirror('cuadriceps', 0.22, -0.05, 0.12, { type: 'capsule', args: [0.14, 0.5] }),
  ...mirror('isquiotibiales', 0.22, -0.05, -0.12, { type: 'capsule', args: [0.13, 0.5] }),
  ...mirror('gluteos', 0.2, 0.18, -0.16, { type: 'sphere', args: [0.16] }),
  ...mirror('gemelos', 0.22, -0.62, -0.02, { type: 'capsule', args: [0.11, 0.42] }),
];

const COLOR_STATIC = '#201e16';
const COLOR_MUSCLE = '#33311f';
const COLOR_ACTIVE = '#d7ff3f';
const COLOR_EDGE = '#f4f1e4';

function PartMesh({ geometry }: { geometry: PartGeometry }) {
  if (geometry.type === 'box') return <boxGeometry args={geometry.args} />;
  if (geometry.type === 'sphere') return <sphereGeometry args={[geometry.args[0], 12, 12]} />;
  return <capsuleGeometry args={[geometry.args[0], geometry.args[1], 4, 8]} />;
}

function StaticMesh({ part }: { part: StaticPartDef }) {
  return (
    <mesh
      position={part.position}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerOut={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <PartMesh geometry={part.geometry} />
      <meshStandardMaterial color={COLOR_STATIC} flatShading />
      <Edges color={COLOR_EDGE} />
    </mesh>
  );
}

function MuscleMesh({
  part,
  active,
  onHover,
  onUnhover,
  onClick,
}: {
  part: MusclePartDef;
  active: boolean;
  onHover: () => void;
  onUnhover: () => void;
  onClick: () => void;
}) {
  return (
    <mesh
      position={part.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onUnhover();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <PartMesh geometry={part.geometry} />
      <meshStandardMaterial color={active ? COLOR_ACTIVE : COLOR_MUSCLE} flatShading />
      <Edges color={COLOR_EDGE} />
    </mesh>
  );
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export default function MuscleBody({ selectedMuscle, onSelectMuscle }: MuscleBodyProps) {
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglAvailable(hasWebGL());
  }, []);

  if (webglAvailable === null) {
    return (
      <div className="card-brutal flex h-[420px] items-center justify-center text-center">
        <p className="font-mono text-sm text-paper-dim">Cargando...</p>
      </div>
    );
  }

  if (!webglAvailable) {
    return (
      <div className="card-brutal flex h-[420px] items-center justify-center text-center">
        <p className="font-mono text-sm text-paper-dim">
          Tu navegador no soporta WebGL, así que no se puede mostrar el cuerpo 3D. Puedes
          seguir usando el resto de SelfGains con normalidad.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[420px] border-2 border-paper-dim/30 sm:h-[520px]">
      <Canvas camera={{ position: [0, 0.4, 4], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 4]} intensity={1} />
        <directionalLight position={[-3, 2, -4]} intensity={0.4} />
        {STATIC_PARTS.map((part, i) => (
          <StaticMesh key={i} part={part} />
        ))}
        {MUSCLE_PARTS.map((part, i) => (
          <MuscleMesh
            key={i}
            part={part}
            active={part.muscleId === selectedMuscle || part.muscleId === hoveredMuscle}
            onHover={() => setHoveredMuscle(part.muscleId)}
            onUnhover={() => setHoveredMuscle((prev) => (prev === part.muscleId ? null : prev))}
            onClick={() => onSelectMuscle(part.muscleId)}
          />
        ))}
        <OrbitControls enablePan={false} minDistance={2.5} maxDistance={6} target={[0, 0.4, 0]} />
      </Canvas>
    </div>
  );
}
