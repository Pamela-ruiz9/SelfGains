import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Edges } from '@react-three/drei';
import { DoubleSide, Vector2 } from 'three';

interface MuscleBodyProps {
  selectedMuscle: string | null;
  onSelectMuscle: (id: string) => void;
}

type PartGeometry =
  | { type: 'box'; args: [number, number, number]; radius?: number }
  | { type: 'sphere'; args: [number] }
  | { type: 'capsule'; args: [number, number] }
  | { type: 'cylinder'; args: [number, number, number] };

interface MusclePartDef {
  muscleId: string;
  position: [number, number, number];
  geometry: PartGeometry;
}

interface StaticPartDef {
  position: [number, number, number];
  geometry: PartGeometry;
}

// (radius, y) pairs, hip to neck — revolved around Y to form a continuous torso,
// then flattened front-to-back so the cross-section reads as human, not circular.
const TORSO_PROFILE: [number, number][] = [
  [0.15, 0.3],
  [0.205, 0.42],
  [0.195, 0.55],
  [0.15, 0.7],
  [0.14, 0.8],
  [0.165, 0.9],
  [0.215, 1.02],
  [0.205, 1.14],
  [0.155, 1.24],
  [0.1, 1.32],
  [0.075, 1.4],
];
const TORSO_DEPTH_SCALE = 0.68;

// Continuous "skin" — head, torso, and the limb segments that are a single
// muscle-free base (shoulder caps, upper arms, elbows, thighs, knees, hands, feet).
const STATIC_PARTS: StaticPartDef[] = [
  { position: [0, 1.56, 0], geometry: { type: 'sphere', args: [0.145] } },
  { position: [0.19, 1.27, 0], geometry: { type: 'sphere', args: [0.115] } },
  { position: [-0.19, 1.27, 0], geometry: { type: 'sphere', args: [0.115] } },
  { position: [0.235, 1.03, 0], geometry: { type: 'cylinder', args: [0.1, 0.072, 0.34] } },
  { position: [-0.235, 1.03, 0], geometry: { type: 'cylinder', args: [0.1, 0.072, 0.34] } },
  { position: [0.245, 0.86, 0], geometry: { type: 'sphere', args: [0.072] } },
  { position: [-0.245, 0.86, 0], geometry: { type: 'sphere', args: [0.072] } },
  { position: [0.255, 0.4, 0], geometry: { type: 'box', args: [0.09, 0.14, 0.06], radius: 0.025 } },
  { position: [-0.255, 0.4, 0], geometry: { type: 'box', args: [0.09, 0.14, 0.06], radius: 0.025 } },
  { position: [0.135, -0.025, 0.02], geometry: { type: 'cylinder', args: [0.155, 0.11, 0.65] } },
  { position: [-0.135, -0.025, 0.02], geometry: { type: 'cylinder', args: [0.155, 0.11, 0.65] } },
  { position: [0.135, -0.35, 0.04], geometry: { type: 'sphere', args: [0.105] } },
  { position: [-0.135, -0.35, 0.04], geometry: { type: 'sphere', args: [0.105] } },
  { position: [0.15, -1.0, 0.08], geometry: { type: 'box', args: [0.13, 0.09, 0.28], radius: 0.035 } },
  { position: [-0.15, -1.0, 0.08], geometry: { type: 'box', args: [0.13, 0.09, 0.28], radius: 0.035 } },
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

// Thin, raised overlays on top of the skin above — read as muscle definition
// rather than separate volumes. antebrazo/gemelos are single-muscle limb
// segments, so they ARE the limb (no separate skin cylinder underneath).
const MUSCLE_PARTS: MusclePartDef[] = [
  {
    muscleId: 'pecho',
    position: [0, 1.06, 0.175],
    geometry: { type: 'box', args: [0.3, 0.2, 0.08], radius: 0.06 },
  },
  {
    muscleId: 'dorsales',
    position: [0, 0.92, -0.155],
    geometry: { type: 'box', args: [0.32, 0.28, 0.07], radius: 0.08 },
  },
  {
    muscleId: 'trapecio',
    position: [0, 1.3, -0.1],
    geometry: { type: 'box', args: [0.24, 0.12, 0.08], radius: 0.05 },
  },
  {
    muscleId: 'abdomen',
    position: [0, 0.75, 0.125],
    geometry: { type: 'box', args: [0.22, 0.26, 0.06], radius: 0.05 },
  },
  ...mirror('deltoide-frontal', 0.2, 1.3, 0.1, { type: 'sphere', args: [0.075] }),
  ...mirror('deltoide-lateral', 0.27, 1.27, 0, { type: 'sphere', args: [0.08] }),
  ...mirror('deltoide-posterior', 0.2, 1.24, -0.1, { type: 'sphere', args: [0.075] }),
  ...mirror('biceps', 0.255, 1.03, 0.075, { type: 'capsule', args: [0.065, 0.2] }),
  ...mirror('triceps', 0.245, 1.03, -0.08, { type: 'capsule', args: [0.065, 0.2] }),
  ...mirror('antebrazo', 0.25, 0.68, 0, { type: 'cylinder', args: [0.072, 0.052, 0.36] }),
  ...mirror('cuadriceps', 0.155, -0.025, 0.09, { type: 'capsule', args: [0.11, 0.44] }),
  ...mirror('isquiotibiales', 0.145, -0.025, -0.09, { type: 'capsule', args: [0.1, 0.44] }),
  ...mirror('gluteos', 0.15, 0.32, -0.15, { type: 'sphere', args: [0.15] }),
  ...mirror('gemelos', 0.14, -0.65, -0.015, { type: 'cylinder', args: [0.105, 0.07, 0.6] }),
];

const COLOR_STATIC = '#3a3520';
const COLOR_MUSCLE = '#565024';
const COLOR_ACTIVE = '#d7ff3f';

const SPHERE_SEGMENTS: [number, number] = [24, 20];
const CAPSULE_SEGMENTS: [number, number] = [10, 18];
const CYLINDER_SEGMENTS = 18;

function PartMesh({ geometry }: { geometry: PartGeometry }) {
  if (geometry.type === 'box') {
    return null; // boxes render via <RoundedBox>, handled by the caller
  }
  if (geometry.type === 'sphere') {
    return <sphereGeometry args={[geometry.args[0], ...SPHERE_SEGMENTS]} />;
  }
  if (geometry.type === 'cylinder') {
    return (
      <cylinderGeometry
        args={[geometry.args[0], geometry.args[1], geometry.args[2], CYLINDER_SEGMENTS]}
      />
    );
  }
  return <capsuleGeometry args={[geometry.args[0], geometry.args[1], ...CAPSULE_SEGMENTS]} />;
}

function TorsoMesh() {
  const points = useMemo(() => TORSO_PROFILE.map(([r, y]) => new Vector2(r, y)), []);
  return (
    <mesh
      scale={[1, 1, TORSO_DEPTH_SCALE]}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerOut={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <latheGeometry args={[points, 24]} />
      <meshStandardMaterial
        color={COLOR_STATIC}
        roughness={0.65}
        metalness={0.05}
        side={DoubleSide}
      />
    </mesh>
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
        <TorsoMesh />
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
