import test from 'node:test';
import assert from 'node:assert/strict';
import { gardenCameraPose, fountain, proposal, pathX, pavingBounds } from '../src/garden-journey.js';

const heading = pose => [pose.lookX - pose.x, pose.lookY - pose.y, pose.lookZ - pose.z];
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('fountain to proposal keeps the same heading and lateral position, including pointer movement', () => {
  for (const mobile of [false, true]) {
    const reference = gardenCameraPose(.8, mobile);
    for (let chapter = .8; chapter <= 2.3; chapter += .01) {
      for (const pointer of [-.5, 0, .5]) {
        const pose = gardenCameraPose(chapter, mobile, pointer);
        assert.ok(distance(heading(pose), heading(reference)) < 1e-10);
        assert.ok(Math.abs(pose.x - reference.x) < 1e-10);
        assert.ok(Math.hypot(pose.x - fountain.x, pose.z - fountain.z) >= 4 - 1e-10, 'camera clears fountain basin');
      }
    }
  }
});

test('camera blends do not introduce position or heading jumps', () => {
  for (const mobile of [false, true]) {
    let previous = gardenCameraPose(0, mobile);
    for (let i = 1; i <= 4000; i++) {
      const pose = gardenCameraPose(i / 1000, mobile);
      assert.ok(distance([pose.x, pose.y, pose.z], [previous.x, previous.y, previous.z]) < .05);
      assert.ok(distance(heading(pose), heading(previous)) < .05);
      previous = pose;
    }
    for (const boundary of [.35, .8, 2.3, 2.85]) {
      const step = .00001, before = gardenCameraPose(boundary - step, mobile), at = gardenCameraPose(boundary, mobile), after = gardenCameraPose(boundary + step, mobile);
      const velocityBefore = ['x', 'y', 'z'].map(key => (at[key] - before[key]) / step);
      const velocityAfter = ['x', 'y', 'z'].map(key => (after[key] - at[key]) / step);
      assert.ok(distance(velocityBefore, velocityAfter) < .01, `smooth velocity at chapter ${boundary}`);
    }
  }
});

test('proposal display leaves the full central aisle open and has a paved side alcove', () => {
  assert.ok(proposal.x - 2.1 > pathX(proposal.z) + 2.75, 'rotating keepsake clears the aisle');
  for (let z = proposal.z - 4; z <= proposal.z + 4; z += .05) {
    const bounds = pavingBounds(z);
    assert.ok(bounds.left <= pathX(z) - 2.75);
    assert.ok(bounds.right >= pathX(z) + 2.75);
    if (Math.abs(z - proposal.z) < 1.7) {
      const baseWidth = Math.sqrt(1.7 ** 2 - (z - proposal.z) ** 2);
      assert.ok(bounds.right >= proposal.x + baseWidth);
    }
  }
});

test('fountain plaza retains a full walking loop around its basin', () => {
  for (let i = 0; i < 360; i++) {
    const angle = i * Math.PI / 180, z = fountain.z + Math.sin(angle) * 4.2, x = fountain.x + Math.cos(angle) * 4.2;
    const bounds = pavingBounds(z);
    assert.ok(x >= bounds.left && x <= bounds.right);
  }
});
