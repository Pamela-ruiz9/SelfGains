import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Edges, Html } from '@react-three/drei';
import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  LatheGeometry,
  MeshStandardMaterial,
  SphereGeometry,
  Vector2,
  type BufferGeometry,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION } from 'three-bvh-csg';
import { muscleLabel } from '../../../lib/muscles';

interface MuscleBodyProps {
  selectedMuscle: string | null;
  onSelectMuscle: (id: string) => void;
}

type PartGeometry =
  | { type: 'box'; args: [number, number, number]; radius?: number }
  | { type: 'sphere'; args: [number] }
  | { type: 'cylinder'; args: [number, number, number] };

interface MusclePartDef {
  muscleId: string;
  position: [number, number, number];
  geometry: PartGeometry;
  rotation?: [number, number, number];
}

interface StaticPartDef {
  position: [number, number, number];
  geometry: PartGeometry;
  rotation?: [number, number, number];
}

// Outward tilt (radians, about Z) applied to arm/leg segments below the
// shoulder/hip pivot so the pose reads as an open A-pose instead of limbs
// hanging straight down. Right side (+x) uses +angle, left (-x) uses -angle.
const ARM_ANGLE = 0.2443; // ~14°
const LEG_ANGLE = 0.1396; // ~8°

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

// Parts with no muscle overlay glued on top of them — rendered as plain,
// separate meshes since there's no seam to fuse away.
const STATIC_PARTS: StaticPartDef[] = [
  { position: [0, 1.56, 0], geometry: { type: 'sphere', args: [0.145] } },
  { position: [0.347, 0.86, 0], geometry: { type: 'sphere', args: [0.072] } },
  { position: [-0.347, 0.86, 0], geometry: { type: 'sphere', args: [0.072] } },
  { position: [0.472, 0.4, 0], geometry: { type: 'box', args: [0.09, 0.14, 0.06], radius: 0.025 } },
  { position: [-0.472, 0.4, 0], geometry: { type: 'box', args: [0.09, 0.14, 0.06], radius: 0.025 } },
  { position: [0.226, -0.35, 0.04], geometry: { type: 'sphere', args: [0.105] } },
  { position: [-0.226, -0.35, 0.04], geometry: { type: 'sphere', args: [0.105] } },
  { position: [0.333, -1.0, 0.08], geometry: { type: 'box', args: [0.13, 0.09, 0.28], radius: 0.035 } },
  { position: [-0.333, -1.0, 0.08], geometry: { type: 'box', args: [0.13, 0.09, 0.28], radius: 0.035 } },
];

function mirror(
  muscleId: string,
  x: number,
  y: number,
  z: number,
  geometry: PartGeometry,
  rotation?: [number, number, number]
): MusclePartDef[] {
  const mirroredRotation: [number, number, number] | undefined = rotation
    ? [rotation[0], rotation[1], -rotation[2]]
    : undefined;
  return [
    { muscleId, position: [x, y, z], geometry, rotation },
    { muscleId, position: [-x, y, z], geometry, rotation: mirroredRotation },
  ];
}

// antebrazo/gemelos are single-muscle limb segments — they ARE the limb (no
// separate skin cylinder underneath), so they render as their own mesh same
// as before. Every other muscle is CSG-fused onto its skin below.
const MUSCLE_PARTS: MusclePartDef[] = [
  ...mirror(
    'antebrazo',
    0.397,
    0.68,
    0,
    { type: 'cylinder', args: [0.072, 0.052, 0.36] },
    [0, 0, ARM_ANGLE]
  ),
  ...mirror(
    'gemelos',
    0.274,
    -0.65,
    -0.015,
    { type: 'cylinder', args: [0.105, 0.07, 0.6] },
    [0, 0, LEG_ANGLE]
  ),
];

const COLOR_STATIC = '#3a3520';
const COLOR_MUSCLE = '#565024';
const COLOR_ACTIVE = '#d7ff3f';

const SPHERE_SEGMENTS: [number, number] = [24, 20];
const CYLINDER_SEGMENTS = 18;

// --- CSG-fused regions -----------------------------------------------------
//
// Skin + muscle overlays that sit on the same volume (upper arms, thighs,
// shoulders, torso) are unioned into one real, continuous mesh via
// three-bvh-csg instead of being layered as separate meshes. This removes the
// visible seam between the "bump" and the base skin. Since raycasting can no
// longer be one-mesh-per-muscle, each muscle keeps its own THREE.Material
// instance tagged with `userData.muscleId` + `userData.labelPosition`; the
// CSG evaluator preserves those as geometry groups (one group per source
// material), and hover/click resolve the hit muscle from the group the
// pointer's face index falls into.

interface RegionPart {
  geometry: BufferGeometry;
  position: [number, number, number];
  rotationZ?: number;
  scale?: [number, number, number];
  color: string;
}

interface RegionMusclePart extends RegionPart {
  muscleId: string;
  labelOffset: number;
}

interface FusedMuscleMaterial extends MeshStandardMaterial {
  userData: { muscleId: string | null; labelPosition?: [number, number, number] };
}

interface FusedRegion {
  key: string;
  brush: Brush;
}

function rotateOffsetAroundZ(offsetY: number, angle: number): [number, number] {
  if (!angle) return [0, offsetY];
  return [-offsetY * Math.sin(angle), offsetY * Math.cos(angle)];
}

function buildFusedRegion(key: string, base: RegionPart, muscles: RegionMusclePart[]): FusedRegion {
  const baseMaterial = new MeshStandardMaterial({
    color: base.color,
    roughness: 0.65,
    metalness: 0.05,
    side: DoubleSide,
  }) as FusedMuscleMaterial;
  baseMaterial.userData = { muscleId: null };

  const baseBrush = new Brush(base.geometry, baseMaterial);
  baseBrush.position.set(...base.position);
  if (base.rotationZ) baseBrush.rotation.z = base.rotationZ;
  if (base.scale) baseBrush.scale.set(...base.scale);
  baseBrush.updateMatrixWorld();

  const evaluator = new Evaluator();

  let current: Brush = baseBrush;
  for (const muscle of muscles) {
    const material = new MeshStandardMaterial({
      color: muscle.color,
      roughness: 0.55,
      metalness: 0.05,
      side: DoubleSide,
    }) as FusedMuscleMaterial;
    const [offsetX, offsetY] = rotateOffsetAroundZ(muscle.labelOffset, muscle.rotationZ ?? 0);
    material.userData = {
      muscleId: muscle.muscleId,
      labelPosition: [
        muscle.position[0] + offsetX,
        muscle.position[1] + offsetY,
        muscle.position[2],
      ],
    };

    const brush = new Brush(muscle.geometry, material);
    brush.position.set(...muscle.position);
    if (muscle.rotationZ) brush.rotation.z = muscle.rotationZ;
    if (muscle.scale) brush.scale.set(...muscle.scale);
    brush.updateMatrixWorld();

    current = evaluator.evaluate(current, brush, ADDITION);
  }

  current.geometry.computeVertexNormals();
  return { key, brush: current };
}

function ellipsoidGeometry(): BufferGeometry {
  return new SphereGeometry(1, ...SPHERE_SEGMENTS);
}

// The torso's revolved profile is open at the neck and hip (its end radii
// aren't 0), so as a bare LatheGeometry it's not two-manifold — boolean CSG
// needs a closed volume, or unions near those rims produce degenerate
// triangles. Cap both ends with flat discs and weld the seam vertices.
function buildCappedTorsoGeometry(): BufferGeometry {
  const radialSegments = 24;
  const lathe = new LatheGeometry(
    TORSO_PROFILE.map(([r, y]) => new Vector2(r, y)),
    radialSegments
  );

  const [bottomRadius, bottomY] = TORSO_PROFILE[0];
  const [topRadius, topY] = TORSO_PROFILE[TORSO_PROFILE.length - 1];

  const bottomCap = new CircleGeometry(bottomRadius, radialSegments);
  bottomCap.rotateX(Math.PI / 2);
  bottomCap.translate(0, bottomY, 0);

  const topCap = new CircleGeometry(topRadius, radialSegments);
  topCap.rotateX(-Math.PI / 2);
  topCap.translate(0, topY, 0);

  const merged = mergeGeometries([lathe, bottomCap, topCap], false);
  return mergeVertices(merged, 1e-4);
}

function buildFusedRegions(): FusedRegion[] {
  const torso = buildFusedRegion(
    'torso',
    {
      geometry: buildCappedTorsoGeometry(),
      position: [0, 0, 0],
      scale: [1, 1, TORSO_DEPTH_SCALE],
      color: COLOR_STATIC,
    },
    [
      {
        muscleId: 'pecho',
        geometry: ellipsoidGeometry(),
        position: [0, 1.06, 0.1],
        scale: [0.16, 0.11, 0.085],
        color: COLOR_MUSCLE,
        labelOffset: 0.16,
      },
      {
        muscleId: 'dorsales',
        geometry: ellipsoidGeometry(),
        position: [0, 0.92, -0.1],
        scale: [0.17, 0.15, 0.075],
        color: COLOR_MUSCLE,
        labelOffset: 0.2,
      },
      {
        muscleId: 'trapecio',
        geometry: ellipsoidGeometry(),
        position: [0, 1.3, -0.06],
        scale: [0.13, 0.07, 0.08],
        color: COLOR_MUSCLE,
        labelOffset: 0.12,
      },
      {
        muscleId: 'abdomen',
        geometry: ellipsoidGeometry(),
        position: [0, 0.75, 0.09],
        scale: [0.12, 0.14, 0.06],
        color: COLOR_MUSCLE,
        labelOffset: 0.19,
      },
      {
        muscleId: 'oblicuos',
        geometry: ellipsoidGeometry(),
        position: [0.115, 0.75, 0],
        scale: [0.05, 0.13, 0.09],
        color: COLOR_MUSCLE,
        labelOffset: 0.18,
      },
      {
        muscleId: 'oblicuos',
        geometry: ellipsoidGeometry(),
        position: [-0.115, 0.75, 0],
        scale: [0.05, 0.13, 0.09],
        color: COLOR_MUSCLE,
        labelOffset: 0.18,
      },
      {
        muscleId: 'lumbares',
        geometry: ellipsoidGeometry(),
        position: [0, 0.55, -0.08],
        scale: [0.09, 0.1, 0.09],
        color: COLOR_MUSCLE,
        labelOffset: 0.15,
      },
      {
        muscleId: 'gluteos',
        geometry: new SphereGeometry(0.125, ...SPHERE_SEGMENTS),
        position: [0.15, 0.32, -0.11],
        color: COLOR_MUSCLE,
        labelOffset: 0.175,
      },
      {
        muscleId: 'gluteos',
        geometry: new SphereGeometry(0.125, ...SPHERE_SEGMENTS),
        position: [-0.15, 0.32, -0.11],
        color: COLOR_MUSCLE,
        labelOffset: 0.175,
      },
    ]
  );

  const shoulder = (side: 1 | -1) =>
    buildFusedRegion(
      side > 0 ? 'shoulder-right' : 'shoulder-left',
      {
        geometry: new SphereGeometry(0.115, ...SPHERE_SEGMENTS),
        position: [side * 0.19, 1.27, 0],
        color: COLOR_STATIC,
      },
      [
        {
          muscleId: 'deltoide-frontal',
          geometry: new SphereGeometry(0.072, ...SPHERE_SEGMENTS),
          position: [side * 0.2, 1.3, 0.075],
          color: COLOR_MUSCLE,
          labelOffset: 0.122,
        },
        {
          muscleId: 'deltoide-lateral',
          geometry: new SphereGeometry(0.078, ...SPHERE_SEGMENTS),
          position: [side * 0.255, 1.27, 0],
          color: COLOR_MUSCLE,
          labelOffset: 0.128,
        },
        {
          muscleId: 'deltoide-posterior',
          geometry: new SphereGeometry(0.072, ...SPHERE_SEGMENTS),
          position: [side * 0.2, 1.24, -0.075],
          color: COLOR_MUSCLE,
          labelOffset: 0.122,
        },
      ]
    );

  const upperArm = (side: 1 | -1) =>
    buildFusedRegion(
      side > 0 ? 'upper-arm-right' : 'upper-arm-left',
      {
        geometry: new CylinderGeometry(0.1, 0.072, 0.34, CYLINDER_SEGMENTS),
        position: [side * 0.295, 1.03, 0],
        rotationZ: side * ARM_ANGLE,
        color: COLOR_STATIC,
      },
      [
        {
          muscleId: 'biceps',
          geometry: ellipsoidGeometry(),
          position: [side * 0.305, 1.03, 0.045],
          rotationZ: side * ARM_ANGLE,
          scale: [0.06, 0.13, 0.06],
          color: COLOR_MUSCLE,
          labelOffset: 0.18,
        },
        {
          muscleId: 'triceps',
          geometry: ellipsoidGeometry(),
          position: [side * 0.3, 1.03, -0.045],
          rotationZ: side * ARM_ANGLE,
          scale: [0.06, 0.13, 0.06],
          color: COLOR_MUSCLE,
          labelOffset: 0.18,
        },
      ]
    );

  const thigh = (side: 1 | -1) =>
    buildFusedRegion(
      side > 0 ? 'thigh-right' : 'thigh-left',
      {
        geometry: new CylinderGeometry(0.155, 0.11, 0.65, CYLINDER_SEGMENTS),
        position: [side * 0.181, -0.025, 0.02],
        rotationZ: side * LEG_ANGLE,
        color: COLOR_STATIC,
      },
      [
        {
          muscleId: 'cuadriceps',
          geometry: ellipsoidGeometry(),
          position: [side * 0.196, -0.025, 0.06],
          rotationZ: side * LEG_ANGLE,
          scale: [0.095, 0.26, 0.095],
          color: COLOR_MUSCLE,
          labelOffset: 0.31,
        },
        {
          muscleId: 'isquiotibiales',
          geometry: ellipsoidGeometry(),
          position: [side * 0.186, -0.025, -0.06],
          rotationZ: side * LEG_ANGLE,
          scale: [0.09, 0.255, 0.09],
          color: COLOR_MUSCLE,
          labelOffset: 0.305,
        },
        {
          muscleId: 'aductores',
          geometry: ellipsoidGeometry(),
          position: [side * 0.095, -0.025, 0.02],
          rotationZ: side * LEG_ANGLE,
          scale: [0.075, 0.2, 0.075],
          color: COLOR_MUSCLE,
          labelOffset: 0.25,
        },
      ]
    );

  return [
    torso,
    shoulder(1),
    shoulder(-1),
    upperArm(1),
    upperArm(-1),
    thigh(1),
    thigh(-1),
  ];
}

function resolveFusedHit(
  brush: Brush,
  faceIndex: number | undefined
): { muscleId: string; labelPosition: [number, number, number] } | null {
  if (faceIndex === undefined) return null;
  const groups = brush.geometry.groups;
  if (!groups || groups.length === 0) return null;

  const materials = Array.isArray(brush.material) ? brush.material : [brush.material];
  for (const group of groups) {
    const groupStartFace = group.start / 3;
    const groupEndFace = groupStartFace + group.count / 3;
    if (faceIndex >= groupStartFace && faceIndex < groupEndFace) {
      const material = materials[group.materialIndex ?? 0] as FusedMuscleMaterial | undefined;
      const data = material?.userData;
      if (!data?.muscleId || !data.labelPosition) return null;
      return { muscleId: data.muscleId, labelPosition: data.labelPosition };
    }
  }
  return null;
}

// --------------------------------------------------------------------------

function PartMesh({ geometry }: { geometry: PartGeometry }) {
  if (geometry.type === 'box') {
    return null; // boxes render via <RoundedBox>, handled by the caller
  }
  if (geometry.type === 'sphere') {
    return <sphereGeometry args={[geometry.args[0], ...SPHERE_SEGMENTS]} />;
  }
  return (
    <cylinderGeometry
      args={[geometry.args[0], geometry.args[1], geometry.args[2], CYLINDER_SEGMENTS]}
    />
  );
}

// Rough "how far this bump pokes out" so the hover label floats just above it.
function labelOffset(geometry: PartGeometry): number {
  if (geometry.type === 'sphere') return geometry.args[0] + 0.05;
  return geometry.args[2] / 2 + 0.05;
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
        rotation={part.rotation}
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
    <mesh position={part.position} rotation={part.rotation} {...handlers}>
      <PartMesh geometry={part.geometry} />
      <meshStandardMaterial color={COLOR_STATIC} roughness={0.65} metalness={0.05} />
    </mesh>
  );
}

function MuscleLabel({ muscleId, offset }: { muscleId: string; offset: number }) {
  return (
    <Html position={[0, offset, 0]} center zIndexRange={[100, 0]}>
      <div className="pointer-events-none whitespace-nowrap border border-acid bg-ink px-2 py-1 font-mono text-xs uppercase tracking-[0.15em] text-acid">
        {muscleLabel(muscleId)}
      </div>
    </Html>
  );
}

function MuscleLabelAt({
  muscleId,
  position,
}: {
  muscleId: string;
  position: [number, number, number];
}) {
  return (
    <Html position={position} center zIndexRange={[100, 0]}>
      <div className="pointer-events-none whitespace-nowrap border border-acid bg-ink px-2 py-1 font-mono text-xs uppercase tracking-[0.15em] text-acid">
        {muscleLabel(muscleId)}
      </div>
    </Html>
  );
}

function MuscleMesh({
  part,
  active,
  hovered,
  onHover,
  onUnhover,
  onClick,
}: {
  part: MusclePartDef;
  active: boolean;
  hovered: boolean;
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
        rotation={part.rotation}
        args={[w, h, d]}
        radius={part.geometry.radius ?? 0.05}
        smoothness={4}
        {...handlers}
      >
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
        {active && <Edges color={COLOR_ACTIVE} />}
        {hovered && <MuscleLabel muscleId={part.muscleId} offset={h / 2 + 0.05} />}
      </RoundedBox>
    );
  }

  return (
    <group position={part.position} rotation={part.rotation} {...handlers}>
      <mesh>
        <PartMesh geometry={part.geometry} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
        {active && <Edges color={COLOR_ACTIVE} />}
      </mesh>
      {hovered && <MuscleLabel muscleId={part.muscleId} offset={labelOffset(part.geometry)} />}
    </group>
  );
}

function FusedRegionMesh({
  region,
  onHoverMuscle,
  onSelectMuscle,
}: {
  region: FusedRegion;
  onHoverMuscle: (hit: { muscleId: string; labelPosition: [number, number, number] } | null) => void;
  onSelectMuscle: (muscleId: string) => void;
}) {
  return (
    <primitive
      object={region.brush}
      onPointerMove={(e: any) => {
        e.stopPropagation();
        onHoverMuscle(resolveFusedHit(region.brush, e.faceIndex));
      }}
      onPointerOut={(e: any) => {
        e.stopPropagation();
        onHoverMuscle(null);
      }}
      onClick={(e: any) => {
        e.stopPropagation();
        const hit = resolveFusedHit(region.brush, e.faceIndex);
        if (hit) onSelectMuscle(hit.muscleId);
      }}
    />
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
  const [hoverLabel, setHoverLabel] = useState<{
    muscleId: string;
    position: [number, number, number];
  } | null>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglAvailable(hasWebGL());
  }, []);

  const fusedRegions = useMemo(() => (webglAvailable ? buildFusedRegions() : []), [webglAvailable]);

  useEffect(() => {
    return () => {
      for (const region of fusedRegions) {
        region.brush.geometry.dispose();
        const materials = Array.isArray(region.brush.material)
          ? region.brush.material
          : [region.brush.material];
        materials.forEach((material) => material.dispose());
      }
    };
  }, [fusedRegions]);

  useEffect(() => {
    for (const region of fusedRegions) {
      const materials = Array.isArray(region.brush.material)
        ? region.brush.material
        : [region.brush.material];
      for (const material of materials) {
        const data = (material as FusedMuscleMaterial).userData;
        if (!data?.muscleId) continue;
        const isActive = data.muscleId === selectedMuscle || data.muscleId === hoveredMuscle;
        (material as MeshStandardMaterial).color.set(isActive ? COLOR_ACTIVE : COLOR_MUSCLE);
      }
    }
  }, [fusedRegions, selectedMuscle, hoveredMuscle]);

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
        {fusedRegions.map((region) => (
          <FusedRegionMesh
            key={region.key}
            region={region}
            onHoverMuscle={(hit) => {
              setHoveredMuscle((prev) => {
                const next = hit?.muscleId ?? null;
                return prev === next ? prev : next;
              });
              setHoverLabel((prev) => {
                if (!hit) return prev === null ? prev : null;
                if (prev && prev.muscleId === hit.muscleId && prev.position === hit.labelPosition) {
                  return prev;
                }
                return { muscleId: hit.muscleId, position: hit.labelPosition };
              });
            }}
            onSelectMuscle={onSelectMuscle}
          />
        ))}
        {STATIC_PARTS.map((part, i) => (
          <StaticMesh key={i} part={part} />
        ))}
        {MUSCLE_PARTS.map((part, i) => (
          <MuscleMesh
            key={i}
            part={part}
            active={part.muscleId === selectedMuscle || part.muscleId === hoveredMuscle}
            hovered={part.muscleId === hoveredMuscle}
            onHover={() => setHoveredMuscle(part.muscleId)}
            onUnhover={() => setHoveredMuscle((prev) => (prev === part.muscleId ? null : prev))}
            onClick={() => onSelectMuscle(part.muscleId)}
          />
        ))}
        {hoverLabel && <MuscleLabelAt muscleId={hoverLabel.muscleId} position={hoverLabel.position} />}
        <OrbitControls enablePan={false} minDistance={2.5} maxDistance={6} target={[0, 0.3, 0]} />
      </Canvas>
    </div>
  );
}
