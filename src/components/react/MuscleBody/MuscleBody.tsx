import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Edges } from '@react-three/drei';

interface MuscleBodyProps {
  selectedMuscle: string | null;
  onSelectMuscle: (id: string) => void;
}

type PartGeometry =
  | { type: 'box'; args: [number, number, number]; radius?: number }
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
  // head
  { position: [0, 1.58, 0], geometry: { type: 'sphere', args: [0.16] } },
  // neck
  { position: [0, 1.4, 0], geometry: { type: 'capsule', args: [0.075, 0.04] } },
  // chest block (wide)
  { position: [0, 1.14, 0], geometry: { type: 'box', args: [0.42, 0.34, 0.26], radius: 0.1 } },
  // waist (narrower, tapered)
  { position: [0, 0.82, 0], geometry: { type: 'box', args: [0.32, 0.28, 0.22], radius: 0.09 } },
  // hips / pelvis (wide again)
  { position: [0, 0.5, 0], geometry: { type: 'box', args: [0.4, 0.3, 0.24], radius: 0.1 } },
  // shoulder joints
  { position: [0.29, 1.26, 0], geometry: { type: 'sphere', args: [0.12] } },
  { position: [-0.29, 1.26, 0], geometry: { type: 'sphere', args: [0.12] } },
  // elbows
  { position: [0.4, 0.85, 0], geometry: { type: 'sphere', args: [0.075] } },
  { position: [-0.4, 0.85, 0], geometry: { type: 'sphere', args: [0.075] } },
  // hands
  { position: [0.42, 0.28, 0], geometry: { type: 'box', args: [0.09, 0.15, 0.06], radius: 0.03 } },
  { position: [-0.42, 0.28, 0], geometry: { type: 'box', args: [0.09, 0.15, 0.06], radius: 0.03 } },
  // knees
  { position: [0.22, -0.42, 0.02], geometry: { type: 'sphere', args: [0.1] } },
  { position: [-0.22, -0.42, 0.02], geometry: { type: 'sphere', args: [0.1] } },
  // feet
  { position: [0.22, -1.28, 0.09], geometry: { type: 'box', args: [0.14, 0.09, 0.3], radius: 0.04 } },
  { position: [-0.22, -1.28, 0.09], geometry: { type: 'box', args: [0.14, 0.09, 0.3], radius: 0.04 } },
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
  {
    muscleId: 'pecho',
    position: [0, 1.16, 0.18],
    geometry: { type: 'box', args: [0.36, 0.24, 0.16], radius: 0.09 },
  },
  {
    muscleId: 'dorsales',
    position: [0, 0.98, -0.16],
    geometry: { type: 'box', args: [0.38, 0.36, 0.15], radius: 0.1 },
  },
  {
    muscleId: 'trapecio',
    position: [0, 1.34, -0.12],
    geometry: { type: 'box', args: [0.3, 0.14, 0.16], radius: 0.06 },
  },
  {
    muscleId: 'abdomen',
    position: [0, 0.82, 0.16],
    geometry: { type: 'box', args: [0.26, 0.3, 0.1], radius: 0.06 },
  },
  ...mirror('deltoide-frontal', 0.29, 1.28, 0.13, { type: 'sphere', args: [0.105] }),
  ...mirror('deltoide-lateral', 0.36, 1.26, 0, { type: 'sphere', args: [0.105] }),
  ...mirror('deltoide-posterior', 0.29, 1.26, -0.13, { type: 'sphere', args: [0.105] }),
  ...mirror('biceps', 0.4, 1.06, 0.075, { type: 'capsule', args: [0.075, 0.3] }),
  ...mirror('triceps', 0.4, 1.06, -0.075, { type: 'capsule', args: [0.075, 0.3] }),
  ...mirror('antebrazo', 0.41, 0.58, 0, { type: 'capsule', args: [0.065, 0.36] }),
  ...mirror('cuadriceps', 0.22, 0.08, 0.1, { type: 'capsule', args: [0.15, 0.62] }),
  ...mirror('isquiotibiales', 0.22, 0.08, -0.1, { type: 'capsule', args: [0.14, 0.62] }),
  ...mirror('gluteos', 0.2, 0.4, -0.16, { type: 'sphere', args: [0.17] }),
  ...mirror('gemelos', 0.22, -0.82, -0.02, { type: 'capsule', args: [0.115, 0.6] }),
];

const COLOR_STATIC = '#3a3520';
const COLOR_MUSCLE = '#565024';
const COLOR_ACTIVE = '#d7ff3f';

const SPHERE_SEGMENTS: [number, number] = [24, 20];
const CAPSULE_SEGMENTS: [number, number] = [10, 18];

function PartMesh({ geometry }: { geometry: PartGeometry }) {
  if (geometry.type === 'box') {
    return null; // boxes render via <RoundedBox>, handled by the caller
  }
  if (geometry.type === 'sphere') {
    return <sphereGeometry args={[geometry.args[0], ...SPHERE_SEGMENTS]} />;
  }
  return (
    <capsuleGeometry args={[geometry.args[0], geometry.args[1], ...CAPSULE_SEGMENTS]} />
  );
}

function StaticMesh({ part }: { part: StaticPartDef }) {
  const handlers = {
    onPointerOver: (e: any) => e.stopPropagation(),
    onPointerOut: (e: any) => e.stopPropagation(),
    onClick: (e: any) => e.stopPropagation(),
  };

  if (part.geometry.type === 'box') {
    const [w, h, d] = part.geometry.args;
    return (
      <RoundedBox
        position={part.position}
        args={[w, h, d]}
        radius={part.geometry.radius ?? 0.06}
        smoothness={4}
        {...handlers}
      >
        <meshStandardMaterial color={COLOR_STATIC} roughness={0.65} metalness={0.05} />
      </RoundedBox>
    );
  }

  return (
    <mesh position={part.position} {...handlers}>
      <PartMesh geometry={part.geometry} />
      <meshStandardMaterial color={COLOR_STATIC} roughness={0.65} metalness={0.05} />
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
  const handlers = {
    onPointerOver: (e: any) => {
      e.stopPropagation();
      onHover();
    },
    onPointerOut: (e: any) => {
      e.stopPropagation();
      onUnhover();
    },
    onClick: (e: any) => {
      e.stopPropagation();
      onClick();
    },
  };
  const color = active ? COLOR_ACTIVE : COLOR_MUSCLE;

  if (part.geometry.type === 'box') {
    const [w, h, d] = part.geometry.args;
    return (
      <RoundedBox
        position={part.position}
        args={[w, h, d]}
        radius={part.geometry.radius ?? 0.05}
        smoothness={4}
        {...handlers}
      >
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
        {active && <Edges color={COLOR_ACTIVE} />}
      </RoundedBox>
    );
  }

  return (
    <mesh position={part.position} {...handlers}>
      <PartMesh geometry={part.geometry} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
      {active && <Edges color={COLOR_ACTIVE} />}
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
      <div className="card-brutal flex h-[420px] items-center justify-center text-center sm:h-[520px]">
        <p className="font-mono text-sm text-paper-dim">Cargando...</p>
      </div>
    );
  }

  if (!webglAvailable) {
    return (
      <div className="card-brutal flex h-[420px] items-center justify-center text-center sm:h-[520px]">
        <p className="font-mono text-sm text-paper-dim">
          Tu navegador no soporta WebGL, así que no se puede mostrar el cuerpo 3D. Puedes
          seguir usando el resto de SelfGains con normalidad.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[420px] border-2 border-paper-dim/30 sm:h-[520px]">
      <Canvas camera={{ position: [0, 0.3, 4], fov: 38 }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 4, 4]} intensity={1.4} color="#fff4e0" />
        <directionalLight position={[-3, 1, -3]} intensity={0.5} color="#8fb8ff" />
        <directionalLight position={[0, -2, 2]} intensity={0.3} />
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
        <OrbitControls enablePan={false} minDistance={2.5} maxDistance={6} target={[0, 0.3, 0]} />
      </Canvas>
    </div>
  );
}
