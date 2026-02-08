import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js";

const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();
const tempVectorD = new THREE.Vector3();
const tempMatrixB = new THREE.Matrix3();

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

export function applyPlanarInertia(body, moveDirection, delta, config = {}) {
  const maxSpeed = config.maxSpeed ?? 5;
  const acceleration = body.onGround
    ? config.groundAcceleration ?? 28
    : config.airAcceleration ?? 10;
  const drag = body.onGround
    ? config.groundDrag ?? 14
    : config.airDrag ?? 2.5;
  const inputStrength = Math.min(1, moveDirection.length());

  if (inputStrength > 0) {
    tempVectorA
      .copy(moveDirection)
      .normalize()
      .multiplyScalar(maxSpeed * inputStrength);
    const accelStep = Math.min(1, acceleration * delta);
    body.velocity.x += (tempVectorA.x - body.velocity.x) * accelStep;
    body.velocity.z += (tempVectorA.z - body.velocity.z) * accelStep;
    return;
  }

  const dragStep = Math.exp(-drag * delta);
  body.velocity.x *= dragStep;
  body.velocity.z *= dragStep;
}

export function integrateBody(body, delta, gravity) {
  body.velocity.addScaledVector(body.acceleration, delta);
  body.velocity.y -= gravity * body.gravityScale * delta;
  body.position.addScaledVector(body.velocity, delta);
  body.acceleration.set(0, 0, 0);
}

function computeCapsuleBoxContact(body, capsule, collider, out) {
  const box = collider.box;

  tempVectorA.copy(body.position);
  if (collider.inverseWorldMatrix) {
    tempVectorA.applyMatrix4(collider.inverseWorldMatrix);
  }

  const segMinY = tempVectorA.y - capsule.halfHeight;
  const segMaxY = tempVectorA.y + capsule.halfHeight;
  let closestY = tempVectorA.y;

  if (segMaxY < box.min.y) {
    closestY = segMaxY;
  } else if (segMinY > box.max.y) {
    closestY = segMinY;
  } else {
    closestY = THREE.MathUtils.clamp(tempVectorA.y, box.min.y, box.max.y);
  }

  tempVectorC.set(tempVectorA.x, closestY, tempVectorA.z);
  box.clampPoint(tempVectorC, tempVectorD);
  tempVectorB.subVectors(tempVectorC, tempVectorD);

  let distance = tempVectorB.length();
  let penetration = capsule.radius - distance;

  if (distance === 0) {
    const distX = Math.min(
      Math.abs(tempVectorC.x - box.min.x),
      Math.abs(box.max.x - tempVectorC.x)
    );
    const distY = Math.min(
      Math.abs(tempVectorC.y - box.min.y),
      Math.abs(box.max.y - tempVectorC.y)
    );
    const distZ = Math.min(
      Math.abs(tempVectorC.z - box.min.z),
      Math.abs(box.max.z - tempVectorC.z)
    );
    const minDist = Math.min(distX, distY, distZ);
    if (minDist === distX) {
      tempVectorB.set(
        tempVectorC.x > (box.min.x + box.max.x) * 0.5 ? 1 : -1,
        0,
        0
      );
    } else if (minDist === distY) {
      tempVectorB.set(
        0,
        tempVectorC.y > (box.min.y + box.max.y) * 0.5 ? 1 : -1,
        0
      );
    } else {
      tempVectorB.set(
        0,
        0,
        tempVectorC.z > (box.min.z + box.max.z) * 0.5 ? 1 : -1
      );
    }
    penetration = capsule.radius + minDist;
    distance = 1;
  }

  if (penetration <= 0) {
    return false;
  }

  out.normal.copy(tempVectorB).divideScalar(distance);
  if (collider.worldMatrix) {
    tempMatrixB.setFromMatrix4(collider.worldMatrix);
    out.normal.applyMatrix3(tempMatrixB).normalize();
  }
  out.penetration = penetration;
  return true;
}

export function resolveCollisions(body, capsule, colliders, options = {}) {
  const iterations = options.iterations ?? 3;
  const onContact = typeof options.onContact === "function" ? options.onContact : null;
  const contact = {
    normal: new THREE.Vector3(),
    penetration: 0,
  };
  const summary = {
    contacts: 0,
    maxPenetration: 0,
    groundContacts: 0,
  };

  body.onGround = false;

  for (let i = 0; i < iterations; i += 1) {
    let hadCollision = false;
    for (let colliderIndex = 0; colliderIndex < colliders.length; colliderIndex += 1) {
      const collider = colliders[colliderIndex];
      if (!computeCapsuleBoxContact(body, capsule, collider, contact)) {
        continue;
      }

      summary.contacts += 1;
      summary.maxPenetration = Math.max(summary.maxPenetration, contact.penetration);

      body.position.addScaledVector(contact.normal, contact.penetration);
      const velocityIntoSurface = body.velocity.dot(contact.normal);
      if (velocityIntoSurface < 0) {
        body.velocity.addScaledVector(contact.normal, -velocityIntoSurface);
      }
      if (contact.normal.y > 0.5) {
        body.onGround = true;
        summary.groundContacts += 1;
      }
      if (onContact) {
        onContact({
          colliderIndex,
          penetration: contact.penetration,
          normal: contact.normal,
        });
      }
      hadCollision = true;
    }
    if (!hadCollision) {
      break;
    }
  }

  return summary;
}
