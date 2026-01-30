import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js";

const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();

export function createRigidBody({
  position = new THREE.Vector3(),
  velocity = new THREE.Vector3(),
  acceleration = new THREE.Vector3(),
  mass = 1,
  gravityScale = 1,
} = {}) {
  return {
    position,
    velocity,
    acceleration,
    mass,
    gravityScale,
    onGround: false,
  };
}

export function createCapsuleCollider({ radius, halfHeight }) {
  return { radius, halfHeight };
}

export function integrateBody(body, delta, gravity) {
  body.velocity.addScaledVector(body.acceleration, delta);
  body.velocity.y -= gravity * body.gravityScale * delta;
  body.position.addScaledVector(body.velocity, delta);
  body.acceleration.set(0, 0, 0);
}

function computeCapsuleBoxContact(body, capsule, box, out) {
  const segMinY = body.position.y - capsule.halfHeight;
  const segMaxY = body.position.y + capsule.halfHeight;
  let closestY = body.position.y;

  if (segMaxY < box.min.y) {
    closestY = segMaxY;
  } else if (segMinY > box.max.y) {
    closestY = segMinY;
  } else {
    closestY = THREE.MathUtils.clamp(body.position.y, box.min.y, box.max.y);
  }

  tempVectorA.set(body.position.x, closestY, body.position.z);
  box.clampPoint(tempVectorA, tempVectorB);
  tempVectorC.subVectors(tempVectorA, tempVectorB);

  let distance = tempVectorC.length();
  let penetration = capsule.radius - distance;

  if (distance === 0) {
    const distX = Math.min(
      Math.abs(tempVectorA.x - box.min.x),
      Math.abs(box.max.x - tempVectorA.x)
    );
    const distY = Math.min(
      Math.abs(tempVectorA.y - box.min.y),
      Math.abs(box.max.y - tempVectorA.y)
    );
    const distZ = Math.min(
      Math.abs(tempVectorA.z - box.min.z),
      Math.abs(box.max.z - tempVectorA.z)
    );
    const minDist = Math.min(distX, distY, distZ);
    if (minDist === distX) {
      tempVectorC.set(
        tempVectorA.x > (box.min.x + box.max.x) * 0.5 ? 1 : -1,
        0,
        0
      );
    } else if (minDist === distY) {
      tempVectorC.set(
        0,
        tempVectorA.y > (box.min.y + box.max.y) * 0.5 ? 1 : -1,
        0
      );
    } else {
      tempVectorC.set(
        0,
        0,
        tempVectorA.z > (box.min.z + box.max.z) * 0.5 ? 1 : -1
      );
    }
    penetration = capsule.radius + minDist;
    distance = 1;
  }

  if (penetration <= 0) {
    return false;
  }

  out.normal.copy(tempVectorC).divideScalar(distance);
  out.penetration = penetration;
  return true;
}

export function resolveCollisions(body, capsule, colliders, options = {}) {
  const iterations = options.iterations ?? 3;
  const contact = {
    normal: new THREE.Vector3(),
    penetration: 0,
  };

  body.onGround = false;

  for (let i = 0; i < iterations; i += 1) {
    let hadCollision = false;
    for (const collider of colliders) {
      if (!computeCapsuleBoxContact(body, capsule, collider.box, contact)) {
        continue;
      }

      body.position.addScaledVector(contact.normal, contact.penetration);
      const velocityIntoSurface = body.velocity.dot(contact.normal);
      if (velocityIntoSurface < 0) {
        body.velocity.addScaledVector(contact.normal, -velocityIntoSurface);
      }
      if (contact.normal.y > 0.5) {
        body.onGround = true;
      }
      hadCollision = true;
    }
    if (!hadCollision) {
      break;
    }
  }
}
