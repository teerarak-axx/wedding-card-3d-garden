import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pathX, fountain, proposal, pavingBounds, gardenCameraPose } from './garden-journey.js';
import { gardenModels } from './garden-models.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export default function Garden({ progress, names, onReady, onFailure, reducedMotion }) {
  const mount = useRef(null), pRef = useRef(0), nameRef=useRef(names);
  pRef.current=progress; nameRef.current=names;
  useEffect(()=>{
    const host=mount.current;
    let renderer,frame, disposed=false;
    const cleanups=[];
    try {
      const scene=new THREE.Scene();
      scene.background=new THREE.Color('#f3eee9');
      scene.fog=new THREE.Fog('#f3eee9',36,108);
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.4));
      renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.94;
      host.appendChild(renderer.domElement);
      const camera=new THREE.PerspectiveCamera(43,1,.1,230);
      const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
      const reflection=pmrem.fromScene(room,.04);
      room.dispose();pmrem.dispose();cleanups.push(()=>reflection.dispose());
      const hemi=new THREE.HemisphereLight(0xfff4ec,0xb7bfa7,1.7);scene.add(hemi);
      const sun=new THREE.DirectionalLight(0xfff4f8,2.2);sun.position.set(-18,32,15);sun.castShadow=true;
      sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:85});sun.shadow.bias=-.0007;sun.shadow.normalBias=.05;scene.add(sun,sun.target);
      const fill=new THREE.DirectionalLight(0xffffff,.65);fill.position.set(15,15,-15);scene.add(fill);
      const mats={};
      function mat(color,roughness=.8,metalness=0){const key=color+roughness+metalness;return mats[key] ||= new THREE.MeshStandardMaterial({color,roughness,metalness,...(metalness?{envMap:reflection.texture,envMapIntensity:.8}:{})});}
      const ivory=mat('#fffdfb'), stone=mat('#eadfe4'), timber=mat('#b3a18b'), gold=mat('#b69a5f',.3,.75);
      const leafColors=['#91a58d','#a1b398','#b0bea1','#839b83','#b6c1aa'];
      function mesh(geo,material,parent=scene,x=0,y=0,z=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
      function box(w,h,d,material,parent,x,y,z){return mesh(new THREE.BoxGeometry(w,h,d),material,parent,x,y,z);}
      function sphere(r,material,parent,x,y,z,sx=1,sy=1,sz=1){const m=mesh(new THREE.SphereGeometry(r,7,5),material,parent,x,y,z);m.scale.set(sx,sy,sz);return m;}
      function limb(from,to,radius,material,parent,tipRadius=radius*.75){
        const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),direction=end.clone().sub(start);
        const part=mesh(new THREE.CylinderGeometry(tipRadius,radius,direction.length(),10),material,parent);
        part.position.copy(start.add(end).multiplyScalar(.5));part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return part;
      }
      const details=gardenModels({mesh,mat,ivory,gold,limb,reflectionMap:reflection.texture});
      const ground=mesh(new THREE.PlaneGeometry(220,260),mat('#e6e9da'),scene,0,-.08,-65);ground.rotation.x=-Math.PI/2;
      const gardenFloor=mesh(new THREE.PlaneGeometry(30,220),mat('#dbe4cc'),scene,0,-.04,-65);gardenFloor.rotation.x=-Math.PI/2;
      let seed=9461;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
      const {z:fountainZ,x:fountainX,radius:plazaRadius}=fountain;
      // White brick paving in running bond, with genuine recessed mortar joints.
      const pathStart=32, pathEnd=-165, rowDepth=.56, brickWidth=1.1;
      const pavingPositions=[],pavingIndices=[];
      const rows=Math.ceil((pathStart-pathEnd)/rowDepth);
      for(let row=0;row<=rows;row++){
        const z=pathStart-row*rowDepth,{left,right}=pavingBounds(z);
        pavingPositions.push(left-.07,.015,z,right+.07,.015,z);
        if(row<rows){const v=row*2;pavingIndices.push(v,v+1,v+2,v+1,v+3,v+2);}
      }
      const groutGeometry=new THREE.BufferGeometry();
      groutGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pavingPositions,3));
      groutGeometry.setIndex(pavingIndices);groutGeometry.computeVertexNormals();
      mesh(groutGeometry,mat('#d7d3d6'));
      const bricks=[];
      for(let row=0;row<rows;row++){
        const z=pathStart-(row+.5)*rowDepth,offset=row%2?brickWidth*.5:0,{left,right}=pavingBounds(z);
        // Anchor every row to the same grid, including the widened fountain plaza.
        for(let edge=Math.floor((left-offset)/brickWidth)*brickWidth+offset;edge<right;edge+=brickWidth){
          const a=Math.max(left,edge),b=Math.min(right,edge+brickWidth);
          if(b-a>.06)bricks.push({x:(a+b)/2,z,width:b-a-.035,color:['#fffefd','#f9f7f7','#f4f1f2'][Math.floor(rand()*3)]});
        }
      }
      const brickMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:.94}),bricks.length);
      const brickTransform=new THREE.Object3D();
      bricks.forEach((brick,i)=>{brickTransform.position.set(brick.x,.075,brick.z);brickTransform.scale.set(brick.width,.12,rowDepth-.035);brickTransform.updateMatrix();brickMesh.setMatrixAt(i,brickTransform.matrix);brickMesh.setColorAt(i,new THREE.Color(brick.color));});
      brickMesh.receiveShadow=true;brickMesh.castShadow=false;scene.add(brickMesh);
      for(let z=pathStart;z>pathEnd;z-=1.1){
        if(Math.abs(z-fountainZ)<plazaRadius+.3)continue;
        for(const side of[-1,1]){
          if(side===1&&Math.abs(z-proposal.z)<proposal.radius+.5)continue;
          box(.16,.2,1.07,ivory,scene,pathX(z)+side*2.96,.08,z);
        }
      }
      // A single instanced botanical system keeps thousands of leaves and petals light.
      const stemItems=[],leafItems=[],petalItems=[],centerItems=[];
      const flowerColors=['#e8acc5','#fff9fb','#c7b7df','#f1d49c','#b4d4e5','#efc2d5','#efc5b2'];
      function flower(x,z,height=.65,colorIndex=0,scale=1){
        stemItems.push({x,y:height*.5,z,sx:.022*scale,sy:height,sz:.022*scale,color:'#7d906c'});
        for(let k=0;k<2;k++) leafItems.push({x:x+(k?-.11:.11)*scale,y:height*(.38+k*.19),z,sx:.18*scale,sy:.06*scale,sz:.065*scale,rz:k?-.55:.55,color:leafColors[colorIndex%5]});
        centerItems.push({x,y:height,z,sx:.08*scale,sy:.06*scale,sz:.08*scale,color:'#c6ab71'});
        for(let k=0;k<6;k++){const a=k*Math.PI/3;petalItems.push({x:x+Math.cos(a)*.12*scale,y:height+.02,z:z+Math.sin(a)*.12*scale,sx:.145*scale,sy:.065*scale,sz:.12*scale,ry:-a,color:flowerColors[colorIndex%flowerColors.length]});}
      }
      for(let z=20;z>-159;z-=1.6){for(const side of[-1,1]){
        const seatingZone=z < -82 && z > -94, fountainZone=Math.abs(z-fountainZ)<8.5;
        const proposalZone=side===1&&Math.abs(z-proposal.z)<4.2;
        const plazaEdge=Math.sqrt(Math.max(0,(plazaRadius+.45)**2-(z-fountainZ)**2));
        const ringEdge=Math.sqrt(Math.max(0,3.5**2-(z-proposal.z)**2));
        const offset=fountainZone?Math.max(3.8,plazaEdge+1.05):proposalZone?Math.max(3.8,proposal.x-pathX(z)+ringEdge+1):(seatingZone?6.1:3.8);
        const compact=fountainZone||proposalZone;
        const x=(fountainZone?fountainX:pathX(z))+side*(offset+rand()*(compact?.4:seatingZone?.7:1.7));
        sphere(compact?.45+rand()*.12:.55+rand()*.4,mat(leafColors[Math.floor(rand()*5)]),scene,x,.28,z,compact?.9:1.3,.7,compact?.9:1.1);
        for(let k=0;k<(compact?4:6);k++)flower(x+(rand()-.5)*(compact?.8:2),z+(rand()-.5)*(compact?.7:1.8),.5+rand()*.75,Math.floor(rand()*flowerColors.length),.8+rand()*.55);
      }}
      function instance(items,geometry){const m=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({roughness:.95}),items.length);const dummy=new THREE.Object3D();items.forEach((a,i)=>{dummy.position.set(a.x,a.y,a.z);dummy.scale.set(a.sx,a.sy,a.sz);dummy.rotation.set(a.rx||0,a.ry||0,a.rz||0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);m.setColorAt(i,new THREE.Color(a.color));});m.castShadow=false;m.receiveShadow=true;scene.add(m);}
      // Mature trees frame the path, leaving the centre open.
      function tree(x,z,size=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(size);scene.add(g);
        const bark=mat('#a3937e'),foliage=mat(leafColors[Math.floor(rand()*5)]);
        limb([0,0,0],[.08,5.6,-.04],.32,bark,g,.11);
        // Branches grow from the trunk into the crown; no detached wooden spikes.
        const crown=(x,y,z,r,sx=1,sy=1,sz=1)=>{
          const leaves=mesh(new THREE.SphereGeometry(r,16,12),foliage,g,x,y,z);leaves.scale.set(sx,sy,sz);
        };
        crown(0,6.2,0,2.05,1,1.1,.95);
        for(let i=0;i<6;i++){
          const a=i*Math.PI/3+.25,r=1.15+rand()*.35,y=5.3+rand()*1.1;
          const dx=Math.cos(a),dz=Math.sin(a);
          limb([.04,3.5+i*.18,0],[dx*r,y,dz*r],.13,bark,g,.04);
          crown(dx*r,y+.45,dz*r,1.45+rand()*.2,1,.95,1);
        }
      }
      for(let z=10;z>-150;z-=10){for(const side of[-1,1]){
        if(rand()>.22){const tx=side*(8+rand()*4),tz=z+rand()*3;if(Math.hypot(tx-fountainX,tz-fountainZ)>plazaRadius+1&&Math.hypot(tx-proposal.x,tz-proposal.z)>3.8)tree(tx,tz,.85+rand()*.45);}
        if(Math.hypot(side*7.5-fountainX,z-4-fountainZ)>plazaRadius+1&&Math.hypot(side*7.5-proposal.x,z-4-proposal.z)>3.8){const evergreen=details.evergreen();evergreen.position.set(side*7.5,0,z-4);evergreen.scale.setScalar(.94+rand()*.12);scene.add(evergreen);}
      }}
      function floral(x,y,z,s=1,parent=scene){
        for(let i=0;i<6;i++){const a=i*2.4;sphere(.22*s,mat(leafColors[i%5]),parent,x+Math.cos(a)*.35*s,y+Math.sin(a)*.2*s,z+(rand()-.5)*.35*s,1.6,.7,1);}
        for(let i=0;i<4;i++){const a=i*2.1,c=mat(flowerColors[Math.floor(rand()*flowerColors.length)]);const fx=x+Math.cos(a)*.3*s,fy=y+Math.sin(a)*.25*s;
          for(let k=0;k<5;k++){const b=k*Math.PI*2/5;sphere(.14*s,c,parent,fx+Math.cos(b)*.12*s,fy+Math.sin(b)*.12*s,z+.2*s,1,1,.7);}sphere(.075*s,gold,parent,fx,fy,z+.3*s);}
      }
      function textSign(text,w=4.6,h=1,parent=scene,x=0,y=5,z=0){
        const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');
        ctx.fillStyle='#c6ad8d';ctx.fillRect(0,0,1024,256);
        for(let i=0;i<25;i++){ctx.strokeStyle=`rgba(111,83,54,${.025+rand()*.05})`;ctx.beginPath();ctx.moveTo(0,i*11);ctx.bezierCurveTo(300,i*11+rand()*20,700,i*11-rand()*15,1024,i*11);ctx.stroke();}
        ctx.strokeStyle='#e8d5b9';ctx.lineWidth=3;ctx.strokeRect(15,15,994,226);ctx.fillStyle='#584e3d';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='italic 84px Georgia';ctx.fillText(text,512,132,950);
        const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
        const board=box(w,h,.14,timber,parent,x,y,z);mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:.9}),parent,x,y,z+.08);return board;
      }
      function arch(z,label){const g=new THREE.Group();g.position.set(pathX(z),0,z);scene.add(g);
        // Sculptural arched stone gateway.
        const shape=new THREE.Shape();shape.moveTo(-4.1,0);shape.lineTo(-4.1,5.8);shape.absarc(0,5.8,4.1,Math.PI,0,true);shape.lineTo(4.1,0);shape.lineTo(3.35,0);shape.lineTo(3.35,5.8);shape.absarc(0,5.8,3.35,0,Math.PI,false);shape.lineTo(-3.35,0);shape.closePath();
        mesh(new THREE.ExtrudeGeometry(shape,{depth:.55,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.07,bevelThickness:.07,curveSegments:30}),ivory,g);
        for(const s of[-1,1]){box(1.2,.22,1.2,ivory,g,s*3.72,.11,.25);box(.94,.2,.95,ivory,g,s*3.72,5.6,.25);mesh(new THREE.CylinderGeometry(.58,.75,.75,12),stone,g,s*4.8,.4,.4);floral(s*4.8,1.2,.5,1.5,g);
          for(let y=1.5;y<6.7;y+=.65)floral(s*3.75,y,.5,.9,g);
        }
        for(let a=.1;a<Math.PI;a+=.18)floral(Math.cos(a)*3.75,5.8+Math.sin(a)*3.75,.6,.9,g);
        for(const s of[-1,1]){mesh(new THREE.CylinderGeometry(.017,.017,1.8,5),gold,g,s*1.6,7.25,.25);}
        textSign(label,4.8,1.05,g,0,6.3,.3);
        // Open lattice gates.
        for(const s of[-1,1]){const gate=new THREE.Group();gate.position.set(s*3.5,.2,.25);gate.rotation.y=s*1.12;g.add(gate);
          for(let y of [.4,1.8,3.2])box(2.7,.045,.045,gold,gate,-s*1.35,y,0);
          for(let i=0;i<7;i++)mesh(new THREE.CylinderGeometry(.025,.025,3.5,5),gold,gate,-s*(.18+i*.4),1.9,0);
        }
        return g;
      }
      arch(3, nameRef.current || 'Kawin & Nalin');
      function bench(x,z,angle=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;scene.add(g);for(let j=0;j<4;j++){box(2.8,.12,.15,timber,g,0,.85,j*.2);box(2.8,.14,.11,timber,g,0,1.2+j*.19,.68);}for(const s of[-1,1]){box(.13,.85,.55,ivory,g,s*1.1,.4,.3);box(.12,1.5,.12,ivory,g,s*1.1,1,.7);}}
      bench(fountainX-5.7,fountainZ,-Math.PI/2);bench(fountainX+5.7,fountainZ,Math.PI/2);
      // Sculpted basins, floral reliefs and a feathered marble Cupid.
      const stonework=details.fountainStonework();stonework.position.set(fountainX,0,fountainZ);scene.add(stonework);
      const cupid=details.cupid();cupid.position.set(fountainX,2.4,fountainZ);scene.add(cupid);
      const fountainDynamics=new THREE.Group();fountainDynamics.position.set(fountainX,0,fountainZ);scene.add(fountainDynamics);
      const waterJetMaterial=new THREE.MeshPhysicalMaterial({color:'#76c5e5',emissive:'#96d4e9',emissiveIntensity:.18,roughness:.08,metalness:.05,transparent:true,opacity:.82,depthWrite:false});
      const jetCurves=[];
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,dx=Math.cos(a),dz=Math.sin(a);
        const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(dx*.57,2.3,dz*.57),new THREE.Vector3(dx*.95,3.1,dz*.95),new THREE.Vector3(dx*1.85,2.6,dz*1.85),new THREE.Vector3(dx*2.05,.51,dz*2.05));
        jetCurves.push(curve);const jet=mesh(new THREE.TubeGeometry(curve,30,.032,5,false),waterJetMaterial,fountainDynamics);jet.castShadow=false;jet.receiveShadow=false;
      }
      const dropletCount=144;
      const droplets=new THREE.InstancedMesh(new THREE.SphereGeometry(.047,6,4),new THREE.MeshStandardMaterial({color:'#d4f5ff',emissive:'#72c4df',emissiveIntensity:.3,roughness:.15}),dropletCount);
      droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);droplets.frustumCulled=false;fountainDynamics.add(droplets);
      const dropletTransform=new THREE.Object3D();
      const ripples=[];
      for(let i=0;i<3;i++){
        const ripple=mesh(new THREE.TorusGeometry(1,.014,5,64),new THREE.MeshBasicMaterial({color:'#daf7ff',transparent:true,opacity:.65,depthWrite:false}),fountainDynamics,0,.52,0);
        ripple.rotation.x=Math.PI/2;ripple.castShadow=false;const scale=.5+i*.55;ripple.scale.setScalar(scale);ripples.push(ripple);
      }
      function animateFountain(seconds){
        for(let i=0;i<dropletCount;i++){
          const t=(seconds*.38+(i%18)/18)%1,point=jetCurves[Math.floor(i/18)].getPoint(t);
          dropletTransform.position.copy(point);const size=.6+Math.sin(i*2.4)*.25;dropletTransform.scale.set(size,size*1.7,size);dropletTransform.updateMatrix();droplets.setMatrixAt(i,dropletTransform.matrix);
        }
        droplets.instanceMatrix.needsUpdate=true;
        ripples.forEach((r,i)=>{const phase=(seconds*.28+i/3)%1;r.scale.setScalar(.35+phase*1.75);r.material.opacity=(1-phase)*.7;});
      }
      animateFountain(0);
      // Proposal keepsake: guests can turn the ring by dragging.
      const ringGroup=details.proposalKeepsake();ringGroup.position.set(proposal.x,1.9,proposal.z);scene.add(ringGroup);
      mesh(new THREE.CylinderGeometry(1.55,1.7,.25,48),ivory,scene,proposal.x,.2,proposal.z);
      mesh(new THREE.CylinderGeometry(.7,1,1.8,32),stone,scene,proposal.x,1.1,proposal.z);
      for(let i=0;i<9;i++){const a=-Math.PI*.6+i*Math.PI*1.2/8;floral(proposal.x+Math.cos(a)*2.15,.6,proposal.z+Math.sin(a)*2.1,.7);}
      // An open white pavilion: all six columns are outside the walking aisle.
      const gz=-97,gazebo=new THREE.Group();gazebo.position.set(pathX(gz),0,gz);scene.add(gazebo);
      box(10.6,.08,9.4,ivory,gazebo,0,-.04,0);
      for(const side of[-1,1]){
        box(2.45,.12,9.4,mat('#faf8f9'),gazebo,side*3.975,.06,0);
        for(const z of[-4,0,4]){
          const x=side*4.35;
          box(.75,.2,.75,ivory,gazebo,x,.1,z);
          box(.32,5.1,.32,ivory,gazebo,x,2.75,z);
          box(.64,.2,.64,ivory,gazebo,x,5.32,z);
          for(const y of[1.4,3.25,4.7])floral(x,y,z,.65,gazebo);
        }
        box(.22,.26,9.6,ivory,gazebo,side*4.35,5.5,0);
      }
      for(const z of[-4.8,0,4.8])box(10.7,.24,.2,ivory,gazebo,0,5.5,z);
      const roofProfile=new THREE.Shape();roofProfile.moveTo(-5.4,5.62);roofProfile.lineTo(0,7.27);roofProfile.lineTo(5.4,5.62);roofProfile.lineTo(5.4,5.8);roofProfile.lineTo(0,7.46);roofProfile.lineTo(-5.4,5.8);roofProfile.closePath();
      mesh(new THREE.ExtrudeGeometry(roofProfile,{depth:10,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:1}),mat('#fffdfd'),gazebo,0,0,-5);
      // Shallow white roof battens add definition to the pitched roof.
      for(let z=-4.8;z<=4.8;z+=.8)for(const side of[-1,1]){
        const batten=box(5.65,.07,.055,mat('#eee8ed'),gazebo,side*2.7,6.63,z);batten.rotation.z=-side*Math.atan(1.65/5.4);
      }
      for(let x=-5;x<=5;x+=.65)floral(x,5.52,4.97,.78,gazebo);
      // A high floral arch at the rear uses side posts beyond the brick path.
      for(const side of[-1,1])mesh(new THREE.CylinderGeometry(.09,.12,2.4,12),ivory,gazebo,side*3.55,1.2,-4.1);
      mesh(new THREE.TorusGeometry(3.55,.09,8,48,Math.PI),ivory,gazebo,0,2.4,-4.1);
      for(let a=0;a<=Math.PI;a+=.16)floral(Math.cos(a)*3.55,2.4+Math.sin(a)*3.55,-4,.65,gazebo);
      for(const side of[-1,1])for(let y=.7;y<=2.4;y+=.65)floral(side*3.55,y,-4,.65,gazebo);
      // Two symmetrical seating blocks follow the curved path. Keep the full
      // walking aisle clear; every chair faces the ceremony at negative Z.
      const seating=new THREE.Group();seating.name='ceremony-seating';scene.add(seating);
      const cushion=mat('#edbfd0'), chairFrame=mat('#fdfbfc');
      for(let row=0;row<4;row++)for(const side of[-1,1])for(let col=0;col<2;col++){
        const z=-85.5-row*1.9, x=pathX(z)+side*(3.4+col*1.05);
        const chair=new THREE.Group();chair.position.set(x,0,z);chair.userData={row,side,column:col};seating.add(chair);
        // Raised white frame, blush seat, open slatted back on the guest's side.
        box(.76,.13,.76,chairFrame,chair,0,.84,0);box(.66,.09,.66,cushion,chair,0,.95,0);
        for(const sx of[-.33,.33]){box(.065,1.65,.065,chairFrame,chair,sx,.83,.33);box(.065,.84,.065,chairFrame,chair,sx,.42,-.3);}
        box(.78,.13,.09,chairFrame,chair,0,1.65,.33);
        for(const sx of[-.2,0,.2])box(.045,.56,.055,chairFrame,chair,sx,1.3,.33);
        // A small pink ribbon faces the arriving guests.
        box(.18,.15,.04,cushion,chair,0,1.6,.4);
      }
      for(const side of[-1,1])for(const z of[-84.6,-91.9]){
        const x=pathX(z)+side*2.95;
        mesh(new THREE.CylinderGeometry(.22,.32,.85,12),ivory,scene,x,.43,z);
        floral(x,1.05,z,1.05);
      }
      arch(-132,'With love, always');
      textSign('See you in the garden',3.5,.8,scene,5,2.2,-128);
      for(const x of[3.8,6.2])box(.08,2.2,.08,timber,scene,x,1.1,-128);
      // Flowerbeds also climb both entrance walls.
      instance(stemItems,new THREE.CylinderGeometry(1,1,1,4));instance(leafItems,new THREE.SphereGeometry(1,5,4));instance(petalItems,new THREE.SphereGeometry(1,6,5));instance(centerItems,new THREE.SphereGeometry(1,5,4));
      // Batch static garden pieces by material and distance. This reduces thousands
      // of individual draw calls while retaining the interactive ring as a model.
      scene.updateMatrixWorld(true);
      const batches=new Map(), originals=[];
      scene.traverse(o=>{
        if(!o.isMesh || o.isInstancedMesh || o.material.map) return;
        for(let p=o;p;p=p.parent) if(p===ringGroup || p===fountainDynamics)return;
        const world=new THREE.Vector3();o.getWorldPosition(world);
        const key=o.material.uuid+':'+Math.floor(world.z/40)+':'+Boolean(o.geometry.index);
        if(!batches.has(key))batches.set(key,{material:o.material,geometries:[]});
        batches.get(key).geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
        originals.push(o);
      });
      for(const {material,geometries} of batches.values()){
        const merged=mergeGeometries(geometries,false);
        if(merged)mesh(merged,material);
        geometries.forEach(g=>g.dispose());
      }
      originals.forEach(o=>{o.removeFromParent();o.geometry.dispose();});
      const particleCount=65,positions=new Float32Array(particleCount*3);
      for(let i=0;i<particleCount;i++){positions[i*3]=(rand()-.5)*20;positions[i*3+1]=rand()*10;positions[i*3+2]=rand()*70-20;}
      const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(positions,3));
      const particles=new THREE.Points(pg,new THREE.PointsMaterial({color:'#fff9df',size:.075,transparent:true,opacity:.85}));scene.add(particles);
      function resize(){
        const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;
        // A wider, slightly right-shifted mobile frame includes the side alcove
        // without turning the camera away from its steady forward heading.
        camera.fov=w>760?43:52;camera.setViewOffset(w,h,w>760?-w*.18:w*.12,0,w,h);camera.updateProjectionMatrix();
      }
      resize();window.addEventListener('resize',resize);cleanups.push(()=>window.removeEventListener('resize',resize));
      let dragging=false,lastX=0,turn=0,pointerX=0,current=pRef.current*4;
      const down=e=>{if(pRef.current>.35&&pRef.current<.65){dragging=true;lastX=e.clientX;}};
      const move=e=>{pointerX=(e.clientX/window.innerWidth-.5);if(dragging){turn+=(e.clientX-lastX)*.009;lastX=e.clientX;}};
      const up=()=>{dragging=false;};
      window.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
      cleanups.push(()=>{window.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);});
      const look=new THREE.Vector3();let last=performance.now(),firstFrame=true;
      function animate(now){if(disposed)return;const delta=Math.min((now-last)/1000,1);last=now;
        current=reducedMotion?pRef.current*4:THREE.MathUtils.lerp(current,pRef.current*4,1-Math.exp(-delta*8));
        const mobile=window.innerWidth<761;
        const pose=gardenCameraPose(current,mobile,reducedMotion?0:pointerX);
        const z=pose.z-(mobile?3:0);
        camera.position.set(pose.x,pose.y,pose.z);
        look.set(pose.lookX,pose.lookY,pose.lookZ);camera.lookAt(look);
        sun.position.set(-18,32,z+8);sun.target.position.set(0,0,z-12);sun.target.updateMatrixWorld();
        ringGroup.rotation.y=turn;
        if(!reducedMotion){animateFountain(now/1000);particles.position.z=z-5;particles.rotation.y=now*.000015;for(let i=0;i<particleCount;i++){positions[i*3+1]+=delta*.055;if(positions[i*3+1]>11)positions[i*3+1]=.3;}pg.attributes.position.needsUpdate=true;}
        renderer.render(scene,camera);if(firstFrame){firstFrame=false;onReady?.();}frame=requestAnimationFrame(animate);
      }
      frame=requestAnimationFrame(animate);
      const lost=e=>{e.preventDefault();onFailure?.();};renderer.domElement.addEventListener('webglcontextlost',lost);cleanups.push(()=>renderer.domElement.removeEventListener('webglcontextlost',lost));
      return()=>{disposed=true;cancelAnimationFrame(frame);cleanups.forEach(f=>f());scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});renderer.dispose();renderer.domElement.remove();};
    } catch(e){console.warn('3D garden unavailable',e);renderer?.dispose();onFailure?.();return()=>{disposed=true;cancelAnimationFrame(frame);cleanups.forEach(f=>f());renderer?.domElement.remove();};}
  },[reducedMotion]);
  return <div ref={mount} className="garden-canvas" aria-hidden="true"/>;
}
