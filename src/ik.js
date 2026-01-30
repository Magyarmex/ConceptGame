import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js";

const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();

export function solveIK(chain, target, options = {}) {
  const joints = chain.joints ?? [];
  if (joints.length !== 3) {
    throw new Error("solveIK expects a 2-bone chain with 3 joint positions.");
  }

  const root = joints[0].clone();
  const mid = joints[1].clone();
  const end = joints[2].clone();

  const lengthA = root.distanceTo(mid);
  const lengthB = mid.distanceTo(end);
  const maxReach = lengthA + lengthB;
  const tolerance = options.tolerance ?? 0.001;
  const iterations = options.iterations ?? 8;

  tempVectorA.subVectors(target, root);
  const distanceToTarget = tempVectorA.length();

  if (distanceToTarget >= maxReach) {
    tempVectorA.normalize();
    mid.copy(root).addScaledVector(tempVectorA, lengthA);
    end.copy(root).addScaledVector(tempVectorA, maxReach);
    return { joints: [root, mid, end] };
  }

  for (let i = 0; i < iterations; i += 1) {
    end.copy(target);

    tempVectorA.subVectors(mid, end).normalize();
    mid.copy(end).addScaledVector(tempVectorA, lengthB);

    tempVectorA.subVectors(mid, root).normalize();
    mid.copy(root).addScaledVector(tempVectorA, lengthA);

    tempVectorA.subVectors(end, mid).normalize();
    end.copy(mid).addScaledVector(tempVectorA, lengthB);

    if (end.distanceTo(target) <= tolerance) {
      break;
    }
  }

  return { joints: [root, mid, end] };
}

export function buildTwoBoneChain(root, lengthA, lengthB) {
  const mid = new THREE.Vector3(root.x, root.y - lengthA, root.z);
  const end = new THREE.Vector3(root.x, root.y - (lengthA + lengthB), root.z);
  return { joints: [root.clone(), mid, end] };
}
