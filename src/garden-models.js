import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared materials come from the garden, so static ornaments still batch together.
export function gardenModels({ mesh, mat, ivory, gold, limb, reflectionMap }) {
  const soft = (parent, r, material, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const part = mesh(new THREE.SphereGeometry(r, 16, 12), material, parent, x, y, z);
    part.scale.set(sx, sy, sz); return part;
  };
  const roundedBox = (parent, w, h, d, radius, material, x = 0, y = 0, z = 0) =>
    mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material, parent, x, y, z);
  const lathe = (parent, points, material, x = 0, y = 0, z = 0, segments = 48) =>
    mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), segments), material, parent, x, y, z);
  const tube = (parent, points, radius, material, closed = false) =>
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed), Math.max(16, points.length * 5), radius, 6, closed), material, parent);
  const band = (parent, radius, thickness, material, y) => {
    const part = mesh(new THREE.TorusGeometry(radius, thickness, 8, 64), material, parent, 0, y, 0);
    part.rotation.x = Math.PI / 2; return part;
  };
  const capsule = (parent, from, to, radius, material) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const part = mesh(new THREE.CapsuleGeometry(radius, Math.max(.001, delta.length() - radius * 2), 4, 10), material, parent);
    part.position.copy(a.add(b).multiplyScalar(.5));
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return part;
  };

  let evergreenCount = 0;
  const cypressMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94, side: THREE.DoubleSide });
  function evergreen() {
    const group = new THREE.Group(), variation = evergreenCount++ * .73;
    const bark = mat('#9b8873');
    limb([0, 0, 0], [.035, 3.5, 0], .145, bark, group, .045);
    // One continuous, slightly asymmetric cypress crown. Fine leafy sprays give
    // it texture without the round knobs or stacked skirts of the previous tree.
    const profile = new THREE.SplineCurve([[0, .52], [.35, .58], [.66, .85], [.78, 1.3], [.73, 1.95], [.59, 2.65], [.38, 3.3], [.16, 3.86], [0, 4.18]].map(p => new THREE.Vector2(...p))).getPoints(44);
    profile.forEach(p => { p.x = Math.max(0, p.x); });
    const crown = new THREE.LatheGeometry(profile, 36), positions = crown.attributes.position, colors = [];
    const green = new THREE.Color('#819d7c'), tint = new THREE.Color();
    const modulation = (a, y) => 1 + .045 * Math.sin(a * 5 + y * 2.8 + variation) + .025 * Math.sin(a * 11 - y * 5.3 + variation);
    const sway = y => .045 * Math.sin(y * .9 + variation);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), a = Math.atan2(x, z), scale = modulation(a, y);
      positions.setXYZ(i, x * scale + sway(y), y, z * scale);
      tint.copy(green).multiplyScalar(.93 + .055 * Math.sin(a * 7 + y * 9 + variation) + .035 * Math.cos(a * 13 - y * 15));
      colors.push(tint.r, tint.g, tint.b);
    }
    crown.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));crown.computeVertexNormals();mesh(crown, cypressMaterial, group);
    const radiusAt = y => {
      let i = 0;while (i < profile.length - 2 && profile[i + 1].y < y) i++;
      return THREE.MathUtils.lerp(profile[i].x, profile[i + 1].x, (y - profile[i].y) / (profile[i + 1].y - profile[i].y));
    };
    const leafPositions = [], leafColors = [];
    const triangle = (a, b, c, shade) => {
      leafPositions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
      tint.copy(green).multiplyScalar(shade);for (let i = 0; i < 3; i++) leafColors.push(tint.r, tint.g, tint.b);
    };
    for (let sprig = 0; sprig < 950; sprig++) {
      const random = Math.sin(sprig * 12.9898 + variation * 7.13) * 43758.5453;
      const y = .64 + (random - Math.floor(random)) * 3.43, a = sprig * 2.399963 + variation;
      const radius = radiusAt(y) * modulation(a, y), radial = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), tangent = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
      const root = radial.clone().multiplyScalar(radius - .008);root.x += sway(y);root.y = y;
      const size = .65 + .35 * Math.sin(sprig * 5.7) ** 2;
      for (const side of [-1, 0, 1]) {
        const tip = root.clone().addScaledVector(radial, .025 * size).addScaledVector(tangent, side * .022 * size);tip.y += (.075 - Math.abs(side) * .02) * size;
        const middle = root.clone().lerp(tip, .48).addScaledVector(radial, .01);
        const left = middle.clone().addScaledVector(tangent, -.007 * size), right = middle.clone().addScaledVector(tangent, .007 * size);
        triangle(root, left, tip, 1.02 + side * .025);triangle(root, tip, right, .94 + side * .025);
      }
    }

    const sprigs = new THREE.BufferGeometry();sprigs.setAttribute('position', new THREE.Float32BufferAttribute(leafPositions, 3));sprigs.setAttribute('color', new THREE.Float32BufferAttribute(leafColors, 3));sprigs.computeVertexNormals();mesh(sprigs, cypressMaterial, group);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      capsule(group, [0, .14, 0], [Math.cos(a) * .27, .06, Math.sin(a) * .27], .06, bark);
    }
    return group;
  }

  function fountainStonework() {
    const group = new THREE.Group(), carved = mat('#e5dcd8'), accent = mat('#ccb992', .38, .45);
    lathe(group, [[0, 0], [3.2, 0], [3.2, .08], [3.1, .16], [2.97, .21], [0, .21]], ivory);
    // The profile folds back inside the basin: an actual hollow bowl, not a disc.
    lathe(group, [[0, .2], [2.28, .2], [2.48, .3], [2.57, .45], [2.57, .58], [2.51, .66], [2.39, .66], [2.3, .57], [2.22, .46], [0, .46]], ivory);
    band(group, 2.48, .055, ivory, .65); band(group, 2.48, .02, accent, .59);
    band(group, 2.4, .035, carved, .29);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, medallion = new THREE.Group();
      medallion.position.set(Math.sin(a) * 2.57, .44, Math.cos(a) * 2.57);medallion.rotation.y = a;group.add(medallion);
      for (let petal = 0; petal < 5; petal++) {
        const angle = petal * Math.PI * 2 / 5;
        const p = soft(medallion, .065, carved, Math.cos(angle) * .055, Math.sin(angle) * .055, .015, .7, 1, .35);p.rotation.z = angle - Math.PI / 2;
      }
      soft(medallion, .03, ivory, 0, 0, .035, 1, 1, .5);
    }
    lathe(group, [[0, .48], [.48, .48], [.48, .57], [.34, .65], [.24, 1.15], [.37, 1.35], [.4, 1.4], [0, 1.4]], ivory);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      soft(group, .032, carved, Math.cos(a) * .28, .95, Math.sin(a) * .28, 1, 8, 1);
    }
    band(group, .4, .045, ivory, .6);band(group, .32, .025, accent, 1.22);
    lathe(group, [[0, 1.29], [.35, 1.29], [.62, 1.34], [1.03, 1.44], [1.13, 1.53], [1.12, 1.62], [1.02, 1.62], [.95, 1.53], [0, 1.48]], ivory);
    band(group, 1.09, .05, ivory, 1.61);
    lathe(group, [[0, 1.5], [.28, 1.5], [.25, 1.68], [.16, 1.95], [.23, 2.17], [0, 2.17]], ivory);
    lathe(group, [[0, 2.13], [.24, 2.13], [.48, 2.2], [.65, 2.29], [.65, 2.37], [.57, 2.37], [.51, 2.29], [0, 2.26]], ivory);
    band(group, .62, .035, ivory, 2.37);
    const water = new THREE.MeshPhysicalMaterial({ color: '#9cd9e7', roughness: .16, metalness: .08, clearcoat: 1, envMap: reflectionMap, envMapIntensity: .4 });
    for (const [radius, y] of [[2.28, .51], [.97, 1.54], [.53, 2.325]])
      mesh(new THREE.CylinderGeometry(radius, radius, .018, 48), water, group, 0, y, 0);
    return group;
  }

  function cupid() {
    const group = new THREE.Group();group.rotation.y = -.12;
    const marble = mat('#fff2e5', .58), feather = mat('#e6dcd4'), hair = mat('#d9cbb7'), relief = mat('#b8a99d');
    lathe(group, [[0, -.08], [.44, -.08], [.44, .03], [.37, .09], [0, .09]], ivory, 0, 0, 0, 32);
    for (const side of [-1, 1]) {
      capsule(group, [side * .14, .76, 0], [side * .22, .4, .05], .115, marble);
      capsule(group, [side * .22, .4, .05], [side * .2, .13, .14], .085, marble);
      soft(group, .105, marble, side * .22, .4, .08);
      soft(group, .13, marble, side * .2, .12, .22, .9, .62, 1.5);
      for (let toe = 0; toe < 3; toe++) soft(group, .029, marble, side * .2 + (toe - 1) * .045, .1, .38, .8, .7, 1);
    }
    // The shoulder, elbow and wrist form a curved wing armature. Rounded flight
    // feathers fan out from it, with shorter coverts layered over their roots.
    function flightFeather(from, to, width, material, depth) {
      const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy), shape = new THREE.Shape();
      shape.moveTo(-width * .2, 0);
      shape.bezierCurveTo(-width * .52, length * .23, -width * .58, length * .65, -width * .24, length * .93);
      shape.bezierCurveTo(-width * .1, length * 1.015, width * .15, length * 1.015, width * .27, length * .93);
      shape.bezierCurveTo(width * .55, length * .64, width * .46, length * .24, width * .2, 0);shape.closePath();
      const plume = mesh(new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1, curveSegments: 10 }), material, group, from[0], from[1], depth);
      plume.rotation.z = Math.atan2(-dx, dy);
      const shaft = tube(group, [[from[0], from[1], depth + .047], [from[0] + dx * .42, from[1] + dy * .42, depth + .055], [from[0] + dx * .87, from[1] + dy * .87, depth + .04]], .006, feather);
      shaft.castShadow = false;
    }
    const primaries = [
      [[1.02, 1.98], [1.46, 1.96]], [[1.04, 1.94], [1.57, 1.78]],
      [[1.04, 1.88], [1.59, 1.57]], [[1.02, 1.81], [1.53, 1.36]],
      [[.98, 1.73], [1.43, 1.17]], [[.92, 1.65], [1.28, 1.02]],
      [[.84, 1.56], [1.09, .92]], [[.75, 1.48], [.88, .88]],
    ];
    for (const side of [-1, 1]) {
      const mirror = p => [side * p[0], p[1]];
      const wing = new THREE.Shape();
      wing.moveTo(side * .18, 1.13);
      wing.bezierCurveTo(side * .31, 1.54, side * .68, 1.99, side * 1.03, 2.07);
      wing.bezierCurveTo(side * 1.18, 2.1, side * 1.19, 1.91, side * 1.07, 1.73);
      wing.bezierCurveTo(side * .88, 1.42, side * .55, 1.05, side * .23, 1.02);wing.closePath();
      mesh(new THREE.ExtrudeGeometry(wing, { depth: .105, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 2, curveSegments: 16 }), feather, group, 0, 0, -.32);
      primaries.forEach(([root, tip], i) => flightFeather(mirror(root), mirror(tip), .19, i % 3 ? ivory : marble, -.21 + i * .003));
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        flightFeather(mirror([.29 + t * .43, 1.24 + t * .38]), mirror([.36 + t * .43, .96 + t * .04]), .17, ivory, -.13 + i * .002);
      }
      for (let row = 0; row < 2; row++) for (let i = 0; i < 8; i++) {
        const t = i / 7, root = [.28 + t * .75, 1.3 + t * .68 - row * .11];
        flightFeather(mirror(root), mirror([root[0] + .08, root[1] - .24 - row * .035]), .14, row ? marble : ivory, -.085 + row * .042);
      }
    }

    soft(group, .3, marble, 0, 1.03, 0, 1, 1.43, .88);
    const clothGeometry = new THREE.LatheGeometry([[.24, .85], [.28, .8], [.31, .69], [.37, .5], [.33, .47], [0, .47]].reverse().map(p => new THREE.Vector2(...p)), 64);
    const vertices = clothGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), z = vertices.getZ(i), a = Math.atan2(z, x), fold = 1 + Math.sin(a * 10) * .045;
      vertices.setXYZ(i, x * fold, vertices.getY(i) + Math.cos(a * 5) * .014, z * fold);
    }
    clothGeometry.computeVertexNormals();mesh(clothGeometry, ivory, group);
    const belt = band(group, .256, .018, mat('#d6c5ab', .5, .3), .83);belt.scale.z = .86;
    // A slight head turn follows the arrow, rather than facing away from the bow.
    const head = new THREE.Group();head.position.set(0, 1.67, .035);head.rotation.y = .24;head.rotation.z = -.07;group.add(head);
    soft(head, .29, marble, 0, 0, 0, 1, 1.08, .95);
    soft(head, .285, hair, 0, .12, -.07, 1.02, .75, .94);
    soft(head, .059, marble, 0, -.03, .268, .7, .85, 1);
    for (const side of [-1, 1]) {
      soft(head, .065, marble, side * .28, 0, .035, .65, 1, .7);
      soft(head, .052, mat('#ecdbce'), side * .15, -.055, .245, 1, .6, .28);
      soft(head, .035, ivory, side * .095, .045, .266, 1.2, .55, .35);
      soft(head, .012, relief, side * .095 + .012, .045, .28, .8, 1, .4);
      tube(head, [[side * .05, .095, .245], [side * .09, .11, .252], [side * .135, .095, .235]], .008, hair);
    }
    tube(head, [[-.055, -.09, .265], [0, -.108, .281], [.055, -.09, .265]], .008, relief);
    for (let i = 0; i < 14; i++) {
      const a = i * Math.PI * 2 / 14;
      soft(head, .073, hair, Math.cos(a) * .24, .17 + Math.sin(a) * .055, Math.sin(a) * .21);
    }
    for (let i = 0; i < 5; i++) {
      const curl = [];
      for (let j = 0; j < 12; j++) { const a = j / 11 * Math.PI * 1.8;curl.push([(i - 2) * .09 + Math.cos(a) * .045, .2 + Math.sin(a) * .045, .225 + j * .001]); }
      tube(head, curl, .016, hair);
    }
    // The arrow's nock is also the string's draw point. The extended hand wraps
    // around the actual grip; the bent arm brings the other fingers to the nock.
    const drawPoint = [-.26, 1.45, .43], grip = [.86, 1.28, .43];
    const arms = [
      [[-.24, 1.24, .04], [-.53, 1.25, .16], [-.29, 1.45, .4]],
      [[.24, 1.24, .04], [.51, 1.24, .24], [.81, 1.28, .45]],
    ];
    for (const [shoulder, elbow, hand] of arms) {
      soft(group, .105, marble, ...shoulder);capsule(group, shoulder, elbow, .09, marble);capsule(group, elbow, hand, .072, marble);
      soft(group, .079, marble, ...elbow);soft(group, .075, marble, ...hand, .85, 1.14, .82);
    }
    const bowPoints = [[.4, 1.97, .43], [.66, 1.9, .43], [.83, 1.61, .43], grip, [.96, .95, .43], [.87, .66, .43], [.62, .57, .43]];
    tube(group, bowPoints, .026, gold);
    limb([.856, 1.205, .43], [.866, 1.355, .43], .039, mat('#b6976b', .55, .3), group, .039);
    for (let finger = 0; finger < 3; finger++) {
      const y = 1.235 + finger * .037;
      tube(group, [[.79, y, .48], [.85, y, .5], [.9, y, .46], [.88, y, .405]], .018, marble);
    }
    tube(group, [[.77, 1.33, .45], [.8, 1.35, .49], [.865, 1.32, .49]], .022, marble);
    tube(group, [[-.3, 1.49, .42], [-.23, 1.48, .48], [-.22, 1.44, .48], [-.26, 1.435, .445]], .019, marble);
    tube(group, [[-.3, 1.425, .43], [-.245, 1.41, .48], [-.24, 1.375, .445]], .018, marble);
    tube(group, [[-.34, 1.41, .43], [-.3, 1.45, .49], [-.25, 1.45, .48]], .022, marble);
    const string = mat('#9d8a73');
    limb(bowPoints[0], drawPoint, .007, string, group, .007);limb(drawPoint, bowPoints.at(-1), .007, string, group, .007);
    const arrowDirection = new THREE.Vector3(...grip).sub(new THREE.Vector3(...drawPoint)).normalize();
    const arrowEnd = new THREE.Vector3(...grip).addScaledVector(arrowDirection, .6);
    limb(drawPoint, arrowEnd.toArray(), .015, gold, group, .015);
    const arrowHead = mesh(new THREE.ConeGeometry(.07, .19, 4), gold, group, ...arrowEnd.toArray());
    arrowHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowDirection);
    const tail = new THREE.Group();tail.position.set(...drawPoint);tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowDirection);group.add(tail);
    for (const side of [-1, 1]) {
      const vane = soft(tail, .055, ivory, side * .043, .105, 0, .55, 1.8, .22);vane.rotation.z = side * .18;
    }

    return group;
  }

  function proposalKeepsake() {
    const group = new THREE.Group(), shell = mat('#fff6f2', .42), trim = mat('#c5a472', .2, .9);
    const velvet = new THREE.MeshPhysicalMaterial({ color: '#cf9eb0', roughness: .94, sheen: 1, sheenColor: '#f2d5df', sheenRoughness: .8 });
    const satin = mat('#edd3dd', .75);
    function outline(parent, w, d, r, y, material, thickness, centerZ = 0) {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 + r, -d / 2);shape.lineTo(w / 2 - r, -d / 2);shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
      shape.lineTo(w / 2, d / 2 - r);shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
      shape.lineTo(-w / 2 + r, d / 2);shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
      shape.lineTo(-w / 2, -d / 2 + r);shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
      const points = shape.getPoints(8);points.pop();
      tube(parent, points.map(p => [p.x, y, centerZ + p.y]), thickness, material, true);
    }
    roundedBox(group, 2.5, .68, 2.1, .16, shell, 0, .3, 0);
    roundedBox(group, 2.28, .16, 1.87, .12, velvet, 0, .65, 0);
    // Move the supporting slot forward with the ring, keeping the band seated.
    roundedBox(group, 2.12, .22, .96, .09, velvet, 0, .73, -.38);
    roundedBox(group, 2.12, .22, .6, .09, velvet, 0, .73, .56);
    roundedBox(group, 1.38, .025, .12, .012, mat('#a8798b'), 0, .775, .18);
    outline(group, 2.42, 2.02, .2, .58, trim, .018);
    outline(group, 2.12, 1.73, .18, .772, satin, .009);
    roundedBox(group, .27, .19, .065, .035, trim, 0, .48, 1.055);
    roundedBox(group, .15, .085, .018, .02, shell, 0, .48, 1.094);
    for (const side of [-1, 1]) {
      const hinge = mesh(new THREE.CylinderGeometry(.065, .065, .4, 14), trim, group, side * .8, .61, -.98);hinge.rotation.z = Math.PI / 2;
    }
    const lid = new THREE.Group();lid.position.set(0, .59, -.99);lid.rotation.x = -1.86;group.add(lid);
    roundedBox(lid, 2.5, .25, 2.1, .14, shell, 0, 0, 1.02);
    roundedBox(lid, 2.24, .07, 1.84, .1, velvet, 0, -.153, 1.02);
    outline(lid, 2.3, 1.9, .16, -.165, trim, .016, 1.02);
    outline(lid, 2.08, 1.68, .13, -.193, satin, .009, 1.02);
    // A symmetric, softly bevelled heart sits flat against the lid lining.
    const heart = new THREE.Shape();heart.moveTo(0, .07);
    heart.bezierCurveTo(-.12, .22, -.3, .11, -.15, -.06);
    heart.bezierCurveTo(-.1, -.12, -.04, -.16, 0, -.2);
    heart.bezierCurveTo(.04, -.16, .1, -.12, .15, -.06);
    heart.bezierCurveTo(.3, .11, .12, .22, 0, .07);heart.closePath();
    const emblem = mesh(new THREE.ExtrudeGeometry(heart, { depth: .015, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 2, curveSegments: 18 }), mat('#be9869', .5, .45), lid, 0, -.2, .78);
    emblem.rotation.x = Math.PI / 2;
    // Keep the band upright and centred in its cushion slot. Clearance comes
    // from the opened lid and forward position, rather than tilting the ring.
    const jewel = new THREE.Group();jewel.position.set(0, 1.4, .18);group.add(jewel);
    const ringGold = mat('#d6b16b', .18, 1), platinum = mat('#eee8dd', .17, 1);
    mesh(new THREE.TorusGeometry(.59, .074, 16, 80), ringGold, jewel);
    for (const z of [-.038, .038]) mesh(new THREE.TorusGeometry(.59, .023, 8, 80), platinum, jewel, 0, 0, z);
    const smallStone = new THREE.MeshPhysicalMaterial({ color: '#fffafb', roughness: .07, metalness: .15, clearcoat: 1 });
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + side * (.34 + i * .16), x = Math.cos(a) * .59, y = Math.sin(a) * .59;
      mesh(new THREE.OctahedronGeometry(.037), smallStone, jewel, x, y, .08);
    }
    // Raise the complete basket and stone together, with the basket anchored
    // into the band rather than leaving the gemstone floating above it.
    const setting = new THREE.Group();setting.position.set(0, .08, .025);jewel.add(setting);
    band(setting, .205, .025, ringGold, .58);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, dx = Math.cos(a), dz = Math.sin(a);
      tube(setting, [[dx * .16, .52, dz * .16], [dx * .28, .75, dz * .28], [dx * .305, .89, dz * .305], [dx * .27, .94, dz * .27]], .022, ringGold);
      soft(setting, .03, ringGold, dx * .27, .94, dz * .27);
    }
    const positions = [], colors = [], facetColors = ['#ffffff', '#c7deed', '#f8eff9', '#9ebbd2'];
    const triangle = (a, b, c, colorIndex) => {
      positions.push(...a, ...b, ...c);const color = new THREE.Color(facetColors[colorIndex % 4]);
      for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
    };
    const point = (i, radius, y) => [Math.cos(i * Math.PI / 8) * radius, y, Math.sin(i * Math.PI / 8) * radius];
    for (let i = 0; i < 16; i++) {
      const top = point(i, .16, 1.04), nextTop = point(i + 1, .16, 1.04), girdle = point(i, .32, .86), nextGirdle = point(i + 1, .32, .86);
      triangle([0, 1.04, 0], nextTop, top, 0);
      triangle(top, nextTop, girdle, i);triangle(nextTop, nextGirdle, girdle, i + 1);
      triangle(girdle, nextGirdle, [0, .58, 0], i + 2);
    }
    const diamondGeometry = new THREE.BufferGeometry();diamondGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));diamondGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));diamondGeometry.computeVertexNormals();
    // Cut facets and the studio reflection provide the sparkle without a costly
    // full-scene transmission pass on every animation frame.
    const diamondMaterial = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: '#ffffff', roughness: .035, metalness: .12, ior: 2.4, clearcoat: 1, envMap: reflectionMap, envMapIntensity: 1.3 });
    mesh(diamondGeometry, diamondMaterial, setting);
    // The keepsake rotates as one rigid model; batch its ornaments in local space.
    group.updateMatrixWorld(true);
    const batches = new Map(), originals = [];
    group.traverse(part => {
      if (!part.isMesh) return;
      const key = part.material.uuid + ':' + Boolean(part.geometry.index);
      if (!batches.has(key)) batches.set(key, { material: part.material, geometries: [] });
      batches.get(key).geometries.push(part.geometry.clone().applyMatrix4(part.matrixWorld));originals.push(part);
    });
    for (const { material, geometries } of batches.values()) {
      mesh(mergeGeometries(geometries, false), material, group);geometries.forEach(g => g.dispose());
    }
    originals.forEach(part => { part.removeFromParent();part.geometry.dispose(); });
    return group;
  }

  return { evergreen, fountainStonework, cupid, proposalKeepsake };
}
