// js/shotgun.js
import * as THREE from 'three';
import { ITEM_SHOTGUN, TEX_SHOTGUN, AIR, BLOCK_WATER } from './constants.js';

const CONFIG = {
    maxAmmo: 6,
    maxReserve: 30,
    pelletCount: 10,
    pelletSpread: 0.065,
    pelletDamage: 5,
    recoilAngle: 0.22,
    recoilRecoverySpeed: 5.5,
    recoilBackward: 0.12,
    pumpDuration: 0.55,
    cooldownMin: 1.0,
    cooldownMax: 2.5,
    reloadStartDelay: 0.45,
    shellReloadTime: 0.5,
    reloadEndDelay: 0.35,
    tracerLifetime: 0.05,
    casingLifetime: 7.0,
    smokeLifetime: 1.4,
    muzzleFlashDuration: 0.05,
    dropThrowForce: 2.5,
    throwBaseForce: 5.5,
    throwMaxForce: 18,
    throwMaxChargeTime: 1.2,
    pickUpRange: 2.5,           // ← как в Minecraft: подойти близко
    reloadTiltAngle: 1.0,
    droppedGravity: 20,
    droppedBounce: 0.15,
    droppedHalfSize: 0.25,
};

export class Shotgun {
    constructor(scene, camera, world, player, inventory) {
        this.scene = scene;
        this.camera = camera;
        this.world = world;
        this.player = player;
        this.inventory = inventory;

        this.audioCtx = null;

        this.handRig = new THREE.Group();
        this.camera.add(this.handRig);
        this.handRig.position.set(0.45, -0.35, -0.55);
        this.handRig.visible = false;

        this._buildWeaponModel();

        this.shellCasings = [];
        this.smokeParticles = [];
        this.bulletTracers = [];
        this.impactSparks = [];

        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 80;
        this.raycaster.camera = this.camera;   // Sprite.raycast требует

        this.state = {
            equipped: false,
            ammo: CONFIG.maxAmmo,
            reserve: CONFIG.maxReserve,
            isReloading: false,
            reloadPhase: 'idle',
            reloadTimer: 0,
            shellsToLoad: 0,
            pumpCooldownTimer: 0,
            isPumping: false,
            pumpProgress: 0,
            recoilOffset: 0,
            targetRecoilOffset: 0,
            recoilBackOffset: 0,
            targetRecoilBackOffset: 0,
            holsterProgress: 1,
            targetHolsterProgress: 1,
            muzzleFlashTimer: 0,
            reloadTilt: 0,
            targetReloadTilt: 0,
            idleSwayTime: 0,

            droppedWeapon: null,
            droppedWeaponVelocity: new THREE.Vector3(),
            droppedWeaponAngularVel: new THREE.Vector3(),
            droppedAmmo: 0,
            droppedReserve: 0,
            droppedOrigin: new THREE.Vector3(),
            droppedPickupDelay: 0,
            droppedPlayerMovedAway: false,
        };

        this.hudElements = null;
    }

    // ---------- DEBUG ----------
    updateDebugLine(baseDirection) {
        if (!this.state.equipped || this.state.holsterProgress < 1) {
            this.debugLine.visible = false;
            return;
        }
        this.debugLine.visible = true;

        const muzzleWorldPos = new THREE.Vector3();
        this.muzzleMarker.getWorldPosition(muzzleWorldPos);

        const dir = baseDirection.clone().normalize();
        const endPoint = muzzleWorldPos.clone().add(dir.clone().multiplyScalar(10));

        const points = [muzzleWorldPos, endPoint];
        this.debugLineGeometry.dispose();
        this.debugLineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        this.debugLine.geometry = this.debugLineGeometry;
    }

    // ---------- МОДЕЛЬ ----------
    _buildWeaponModel() {
        const skinMat   = new THREE.MeshStandardMaterial({ color: '#e8c9a0', roughness: 0.6, metalness: 0.02 });
        const gloveMat  = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.05 });
        const gunMetal  = new THREE.MeshStandardMaterial({ color: '#262626', roughness: 0.3, metalness: 0.9 });
        const gunDark   = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.35, metalness: 0.88 });
        const gunWood   = new THREE.MeshStandardMaterial({ color: '#5a3d2b', roughness: 0.65, metalness: 0.04 });
        const gunGrip   = new THREE.MeshStandardMaterial({ color: '#3d2518', roughness: 0.6, metalness: 0.03 });
        const gunBead   = new THREE.MeshStandardMaterial({ color: '#ffcc00', roughness: 0.2, metalness: 0.3, emissive: '#332200', emissiveIntensity: 0.4 });

        const leftHand = new THREE.Group();
        const palmGeo = new THREE.BoxGeometry(0.09, 0.13, 0.06);
        leftHand.add(new THREE.Mesh(palmGeo, gloveMat));
        const thumbGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.07, 6);
        const thumbLeft = new THREE.Mesh(thumbGeo, skinMat);
        thumbLeft.rotation.z = -0.5; thumbLeft.rotation.x = -0.3;
        thumbLeft.position.set(-0.04, 0.05, 0.01);
        leftHand.add(thumbLeft);
        const indexGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.06, 6);
        const indexLeft = new THREE.Mesh(indexGeo, skinMat);
        indexLeft.rotation.z = 0.2; indexLeft.position.set(0.02, 0.07, 0.02);
        leftHand.add(indexLeft);
        for (let i = 0; i < 3; i++) {
            const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.05, 6), skinMat);
            finger.position.set(0.03 - i * 0.025, 0.06, -0.01);
            finger.rotation.z = 0.25;
            leftHand.add(finger);
        }
        leftHand.position.set(0.1, 0.06, -0.1);
        this.handRig.add(leftHand);

        const rightHand = new THREE.Group();
        rightHand.add(new THREE.Mesh(palmGeo, gloveMat));
        const rightThumb = new THREE.Mesh(thumbGeo, skinMat);
        rightThumb.rotation.z = 0.5; rightThumb.rotation.x = -0.3;
        rightThumb.position.set(0.04, 0.05, 0.01);
        rightHand.add(rightThumb);
        const rightIndex = new THREE.Mesh(indexGeo, skinMat);
        rightIndex.rotation.z = -0.2; rightIndex.position.set(-0.02, 0.07, 0.02);
        rightHand.add(rightIndex);
        for (let i = 0; i < 3; i++) {
            const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.05, 6), skinMat);
            finger.position.set(-0.03 + i * 0.025, 0.06, -0.01);
            finger.rotation.z = -0.25;
            rightHand.add(finger);
        }
        rightHand.position.set(0.1, -0.01, 0.51);

        const shotgunGroup = new THREE.Group();
        shotgunGroup.position.set(0.03, 0.06, -0.05);
        shotgunGroup.rotation.y = Math.PI;
        shotgunGroup.scale.set(0.72, 0.72, 0.72);
        this.handRig.add(shotgunGroup);

        const barrelGroup = new THREE.Group();
        shotgunGroup.add(barrelGroup);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 1.6, 14), gunMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.15, 0.9);
        barrelGroup.add(barrel);
        const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 1.2, 14), gunDark);
        magTube.rotation.x = Math.PI / 2;
        magTube.position.set(0, 0.02, 0.7);
        barrelGroup.add(magTube);
        const bracketFront = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.1), gunMetal);
        bracketFront.position.set(0, 0.07, 0.45);
        barrelGroup.add(bracketFront);
        const bracketRear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.1), gunMetal);
        bracketRear.position.set(0, 0.07, 1.05);
        barrelGroup.add(bracketRear);
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), gunBead);
        bead.position.set(0, 0.18, 1.7);
        barrelGroup.add(bead);

        const receiverGroup = new THREE.Group();
        shotgunGroup.add(receiverGroup);
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.45), gunMetal);
        receiver.position.set(0, 0.14, 0.0);
        receiverGroup.add(receiver);
        const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.18), gunDark);
        ejectionPort.position.set(0.07, 0.16, 0.1);
        receiverGroup.add(ejectionPort);
        const boltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6), gunDark);
        boltHandle.rotation.z = Math.PI / 2;
        boltHandle.position.set(0.12, 0.16, 0.15);
        receiverGroup.add(boltHandle);
        const safetySwitch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.06), gunDark);
        safetySwitch.position.set(0.07, 0.19, -0.1);
        receiverGroup.add(safetySwitch);

        const pumpGroup = new THREE.Group();
        shotgunGroup.add(pumpGroup);
        this.pumpGroup = pumpGroup;
        const pumpHandle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.7), gunWood);
        pumpHandle.position.set(0, 0.05, 0.85);
        pumpGroup.add(pumpHandle);
        for (let i = -0.2; i <= 0.2; i += 0.08) {
            const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), gunGrip);
            rib.position.set(0, 0.12, 0.4 + i);
            pumpGroup.add(rib);
        }
        pumpGroup.add(rightHand);
        this.rightHand = rightHand;

        const stockGroup = new THREE.Group();
        shotgunGroup.add(stockGroup);
        const stockNeck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.25), gunWood);
        stockNeck.position.set(0, 0.1, -0.35);
        stockGroup.add(stockNeck);
        const stockMain = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.55), gunWood);
        stockMain.position.set(0, 0.08, -0.7);
        stockMain.rotation.x = -0.1;
        stockGroup.add(stockMain);
        const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.04), gunGrip);
        buttpad.position.set(0, 0.06, -0.97);
        buttpad.rotation.x = -0.1;
        stockGroup.add(buttpad);

        const triggerGuardGroup = new THREE.Group();
        shotgunGroup.add(triggerGuardGroup);
        const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 14, Math.PI), gunDark);
        triggerGuard.rotation.set(1, Math.PI / 2, 2.1);
        triggerGuard.position.set(0, 0.06, -0.15);
        triggerGuardGroup.add(triggerGuard);
        const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.02), gunDark);
        trigger.position.set(0, 0.07, -0.18);
        triggerGuardGroup.add(trigger);

        const muzzleMarker = new THREE.Object3D();
        muzzleMarker.position.set(0, 0.15, 1.72);
        muzzleMarker.name = 'muzzle';
        shotgunGroup.add(muzzleMarker);
        this.muzzleMarker = muzzleMarker;

        const ejectionMarker = new THREE.Object3D();
        ejectionMarker.position.set(0.07, 0.16, 0.1);
        ejectionMarker.name = 'ejection';
        shotgunGroup.add(ejectionMarker);
        this.ejectionMarker = ejectionMarker;

        const muzzleLight = new THREE.PointLight('#ffcc66', 0, 18);
        muzzleLight.name = 'muzzleLight';
        muzzleLight.position.copy(muzzleMarker.position);
        shotgunGroup.add(muzzleLight);
        this.muzzleLight = muzzleLight;

        const flashCanvas = document.createElement('canvas');
        flashCanvas.width = 80; flashCanvas.height = 80;
        const flashCtx = flashCanvas.getContext('2d');
        const flashGradient = flashCtx.createRadialGradient(40, 40, 0, 40, 40, 40);
        flashGradient.addColorStop(0, 'rgba(255,255,220,1)');
        flashGradient.addColorStop(0.08, 'rgba(255,220,80,0.9)');
        flashGradient.addColorStop(0.25, 'rgba(255,160,30,0.6)');
        flashGradient.addColorStop(0.5, 'rgba(255,90,15,0.25)');
        flashGradient.addColorStop(1, 'rgba(255,40,0,0)');
        flashCtx.fillStyle = flashGradient;
        flashCtx.fillRect(0, 0, 80, 80);
        const flashTexture = new THREE.CanvasTexture(flashCanvas);
        const muzzleFlashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: flashTexture,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0,
        }));
        muzzleFlashSprite.name = 'muzzleFlash';
        muzzleFlashSprite.position.copy(muzzleMarker.position);
        muzzleFlashSprite.scale.set(0.5, 0.5, 1);
        shotgunGroup.add(muzzleFlashSprite);
        this.muzzleFlashSprite = muzzleFlashSprite;

        this.shotgunGroup = shotgunGroup;

        this.debugLineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
        this.debugLineGeometry = new THREE.BufferGeometry();
        this.debugLine = new THREE.Line(this.debugLineGeometry, this.debugLineMaterial);
        this.debugLine.visible = false;
        this.scene.add(this.debugLine);

        if (!this.camera.parent) this.scene.add(this.camera);
    }

    // ---------- ЗВУКИ ----------
    _ensureAudioContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    }

    _playNoise(duration, volume, lowpassFreq) {
        this._ensureAudioContext();
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            data[i] = (Math.random() * 2 - 1) * Math.exp(-t * (1 / duration) * 3);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        if (lowpassFreq > 0) {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(lowpassFreq, now);
        }
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(now);
        source.stop(now + duration);
    }

    _playTone(freq, duration, volume, type = 'sine') {
        this._ensureAudioContext();
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    playShotgunSound() { this._playNoise(0.4, 0.7, 2500); this._playTone(80, 0.15, 0.6, 'sine'); this._playNoise(0.7, 0.4, 0); }
    playPumpSound()    { this._playNoise(0.35, 0.45, 600); this._playTone(400, 0.1, 0.3, 'triangle'); setTimeout(() => this._playTone(200, 0.04, 0.18, 'triangle'), 150); }
    playShellInsertSound() { this._playTone(600, 0.04, 0.18, 'triangle'); }
    playEmptyClickSound()  { this._playTone(700, 0.04, 0.22, 'square'); }
    playCasingSound()      { this._playNoise(0.2, 0.14, 0); }
    playThrowSound()       { this._playNoise(0.3, 0.5, 300); }

    // ---------- ЧАСТИЦЫ ----------
    spawnCasing(position, direction) {
        const casingGeo = new THREE.CylinderGeometry(0.02, 0.024, 0.08, 8);
        const casingMat = new THREE.MeshStandardMaterial({ color: '#c4973a', roughness: 0.3, metalness: 0.85 });
        const casing = new THREE.Mesh(casingGeo, casingMat);
        casing.position.copy(position);
        casing.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        casing.castShadow = true;
        this.scene.add(casing);

        const rightDir = new THREE.Vector3();
        rightDir.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
        const upDir = new THREE.Vector3(0, 1, 0);
        const vel = new THREE.Vector3()
            .addScaledVector(rightDir, 3 + Math.random() * 2.5)
            .addScaledVector(upDir, 3.5 + Math.random() * 5)
            .addScaledVector(direction, -0.8 + Math.random())
            .add(this.player.vel.clone().multiplyScalar(0.6));
        this.shellCasings.push({
            mesh: casing,
            velocity: vel,
            angularVel: new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30),
            age: 0, maxAge: CONFIG.casingLifetime, onGround: false, bounceCount: 0,
        });
    }

    spawnSmoke(position) {
        const canvas = document.createElement('canvas');
        canvas.width = 40; canvas.height = 40;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
        gradient.addColorStop(0, 'rgba(220,220,210,0.85)');
        gradient.addColorStop(0.25, 'rgba(190,190,180,0.55)');
        gradient.addColorStop(0.6, 'rgba(150,150,140,0.2)');
        gradient.addColorStop(1, 'rgba(100,100,90,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 40, 40);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture, blending: THREE.NormalBlending, depthWrite: false,
            transparent: true, opacity: 0.6,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.copy(position);
        sprite.scale.set(0.1, 0.1, 1);
        this.scene.add(sprite);
        this.smokeParticles.push({
            sprite, age: 0, maxAge: CONFIG.smokeLifetime, initialScale: 0.1,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.7, 1 + Math.random() * 2, (Math.random() - 0.5) * 0.7
            ),
        });
    }

    spawnBulletTracer(start, end) {
        const tracerGeo = new THREE.SphereGeometry(0.018, 5, 5);
        const tracerMat = new THREE.MeshBasicMaterial({ color: '#ffdd55' });
        const tracer = new THREE.Mesh(tracerGeo, tracerMat);
        tracer.position.copy(start);
        this.scene.add(tracer);
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setFromPoints([start, end]);
        const lineMat = new THREE.LineBasicMaterial({ color: '#ff9922', transparent: true, opacity: 0.5, depthWrite: false });
        const line = new THREE.Line(lineGeo, lineMat);
        this.scene.add(line);
        this.bulletTracers.push({
            tracer, line, start: start.clone(), end: end.clone(),
            age: 0, maxAge: CONFIG.tracerLifetime, progress: 0,
        });
    }

    spawnImpactSparks(position, normal) {
        for (let i = 0; i < 16; i++) {
            const sparkGeo = new THREE.SphereGeometry(0.015, 4, 4);
            const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffbb55' });
            const spark = new THREE.Mesh(sparkGeo, sparkMat);
            spark.position.copy(position);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 8, Math.random() * 6 + 3, (Math.random() - 0.5) * 8
            );
            if (normal) vel.addScaledVector(normal, 4);
            this.scene.add(spark);
            this.impactSparks.push({ mesh: spark, velocity: vel, age: 0, maxAge: 0.5 + Math.random() * 0.6 });
        }
        const flashGeo = new THREE.SphereGeometry(0.07, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.scene.add(flash);
        this.impactSparks.push({ mesh: flash, velocity: new THREE.Vector3(), age: 0, maxAge: 0.1, isFlash: true });
    }

    // ---------- ВЫСТРЕЛ ----------
    shoot() {
        if (!this.state.equipped || this.state.isReloading) {
            if (this.state.isReloading) {
                this.state.isReloading = false;
                this.state.reloadPhase = 'idle';
                this.state.targetReloadTilt = 0;
                this._updateHUD();
            }
            return;
        }
        if (this.state.pumpCooldownTimer > 0) return;
        if (this.state.ammo <= 0) {
            this.playEmptyClickSound();
            this.state.pumpCooldownTimer = 0.3;
            return;
        }

        this.state.ammo--;
        const cooldown = CONFIG.cooldownMin + Math.random() * (CONFIG.cooldownMax - CONFIG.cooldownMin);
        this.state.pumpCooldownTimer = cooldown;
        this.state.isPumping = true;
        this.state.pumpProgress = 0;
        this.state.targetRecoilOffset = CONFIG.recoilAngle;
        this.state.targetRecoilBackOffset = CONFIG.recoilBackward;

        const cameraPos = this.camera.position;
        const baseDir = new THREE.Vector3();
        this.camera.getWorldDirection(baseDir);

        const muzzleWorldPos = new THREE.Vector3();
        this.muzzleMarker.getWorldPosition(muzzleWorldPos);

        const rayTargets = [];
        if (this.world.group)       rayTargets.push(this.world.group);
        if (this.world.carsGroup)   rayTargets.push(this.world.carsGroup);
        if (this.world.towersGroup) rayTargets.push(this.world.towersGroup);

        this.raycaster.camera = this.camera;

        for (let i = 0; i < CONFIG.pelletCount; i++) {
            const pelletDir = this._getPelletDirection(baseDir, CONFIG.pelletSpread);
            this.raycaster.set(cameraPos, pelletDir);
            const intersects = this.raycaster.intersectObjects(rayTargets, true);
            const hitPoint = intersects.length > 0
                ? intersects[0].point
                : cameraPos.clone().add(pelletDir.clone().multiplyScalar(80));
            const hitNormal = intersects.length > 0 && intersects[0].face
                ? intersects[0].face.normal.clone()
                : null;

            this.spawnBulletTracer(muzzleWorldPos.clone(), hitPoint.clone());
            if (hitNormal) this.spawnImpactSparks(hitPoint.clone(), hitNormal);
        }

        this.playShotgunSound();
        this.playCasingSound();

        const ejectionWorldPos = new THREE.Vector3();
        this.ejectionMarker.getWorldPosition(ejectionWorldPos);
        this.spawnCasing(ejectionWorldPos, baseDir);

        for (let i = 0; i < 8; i++) {
            const smokePos = muzzleWorldPos.clone().add(
                new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.06, Math.random() * 0.1)
            );
            this.spawnSmoke(smokePos);
        }

        this.muzzleLight.intensity = 35;
        this.muzzleFlashSprite.material.opacity = 1;
        this.muzzleFlashSprite.scale.set(0.45 + Math.random() * 0.3, 0.45 + Math.random() * 0.3, 1);
        this.state.muzzleFlashTimer = CONFIG.muzzleFlashDuration;

        this._updateHUD();
    }

    _getPelletDirection(baseDir, spread) {
        const dir = baseDir.clone();
        dir.x += (Math.random() - 0.5) * spread * 2;
        dir.y += (Math.random() - 0.5) * spread * 2;
        dir.z += (Math.random() - 0.5) * spread * 2;
        return dir.normalize();
    }

    // ---------- ПЕРЕЗАРЯДКА ----------
    startReload() {
        if (!this.state.equipped) return;
        if (this.state.isReloading) return;
        if (this.state.ammo >= CONFIG.maxAmmo || this.state.reserve <= 0) return;
        if (this.state.pumpCooldownTimer > 0.3) return;

        this.state.isReloading = true;
        this.state.reloadPhase = 'start';
        this.state.reloadTimer = CONFIG.reloadStartDelay;
        this.state.shellsToLoad = CONFIG.maxAmmo - this.state.ammo;
        this.state.isPumping = false;
        this.state.targetReloadTilt = CONFIG.reloadTiltAngle;
        this._updateHUD();
    }

    _processReloadShell() {
        if (this.state.ammo < CONFIG.maxAmmo && this.state.reserve > 0) {
            this.state.ammo++;
            this.state.reserve--;
            this.state.shellsToLoad--;
            this.playShellInsertSound();
        }
    }

    _finishReload() {
        this.state.isReloading = false;
        this.state.reloadPhase = 'idle';
        this.state.reloadTimer = 0;
        this.state.shellsToLoad = 0;
        this.state.targetReloadTilt = 0;
        this._updateHUD();
    }

    _interruptReload() {
        if (this.state.isReloading) {
            this.state.isReloading = false;
            this.state.reloadPhase = 'idle';
            this.state.targetReloadTilt = 0;
        }
    }

    // ---------- ВЫБРОС ----------
    drop() {
        if (this.state.droppedWeapon || !this.state.equipped) return;
        this._interruptReload();
        const worldPos = new THREE.Vector3();
        this.shotgunGroup.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        this.shotgunGroup.getWorldQuaternion(worldQuat);
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        const velocity = dir.clone().multiplyScalar(CONFIG.dropThrowForce).add(new THREE.Vector3(0, -0.5, 0));
        this._createDroppedWeapon(worldPos, worldQuat, velocity);
        this.state.equipped = false;
        this.state.targetHolsterProgress = 0;
        this.handRig.visible = false;
        this._removeHUD();
        this.playThrowSound();
    }

    throwWeapon(chargePower) {
        if (!this.state.equipped || this.state.droppedWeapon) return;
        this._interruptReload();
        const worldPos = new THREE.Vector3();
        this.shotgunGroup.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        this.shotgunGroup.getWorldQuaternion(worldQuat);
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        const force = CONFIG.throwBaseForce + chargePower * (CONFIG.throwMaxForce - CONFIG.throwBaseForce);
        const velocity = dir.clone().multiplyScalar(force).add(new THREE.Vector3(0, 2.5, 0));
        this._createDroppedWeapon(worldPos, worldQuat, velocity);
        this.state.equipped = false;
        this.state.targetHolsterProgress = 0;
        this.handRig.visible = false;
        this._removeHUD();
        this.playThrowSound();
    }

    // ---------- БРОШЕННОЕ ОРУЖИЕ ----------
    _createDroppedWeapon(position, quaternion, velocity) {
        const droppedGroup = new THREE.Group();
        droppedGroup.position.copy(position);
        droppedGroup.quaternion.copy(quaternion);

        const clonedShotgun = this.shotgunGroup.clone(true);

        const toRemove = [];
        clonedShotgun.traverse(child => {
            if (child.name === 'muzzle' || child.name === 'ejection'
             || child.name === 'muzzleLight' || child.name === 'muzzleFlash') {
                toRemove.push(child);
            }
        });
        toRemove.forEach(c => c.parent && c.parent.remove(c));

        droppedGroup.add(clonedShotgun);
        droppedGroup.scale.set(0.55, 0.55, 0.55);
        this.scene.add(droppedGroup);

        this.state.droppedWeapon = droppedGroup;
        this.state.droppedWeaponVelocity = velocity.clone();
        this.state.droppedWeaponAngularVel = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 8
        );
        this.state.droppedAmmo = this.state.ammo;
        this.state.droppedReserve = this.state.reserve;

        // ⚠️ Для auto-pickup
        this.state.droppedOrigin.copy(position);
        this.state.droppedPickupDelay = 0;
        this.state.droppedPlayerMovedAway = false;
    }

    _removeDroppedWeapon() {
        if (this.state.droppedWeapon) {
            this.scene.remove(this.state.droppedWeapon);
            // Материалы и геометрии общие с оригиналом — НЕ dispose'им.
            this.state.droppedWeapon = null;
        }
        this.state.droppedWeaponVelocity.set(0, 0, 0);
        this.state.droppedWeaponAngularVel.set(0, 0, 0);
        this.state.droppedPlayerMovedAway = false;
        this.state.droppedPickupDelay = 0;
    }

    _droppedWeaponCollides(pos) {
        const half = CONFIG.droppedHalfSize;
        const minX = pos.x - half, maxX = pos.x + half;
        const minY = pos.y - half, maxY = pos.y + half;
        const minZ = pos.z - half, maxZ = pos.z + half;

        const bx0 = Math.floor(minX), bx1 = Math.floor(maxX);
        const by0 = Math.floor(minY), by1 = Math.floor(maxY);
        const bz0 = Math.floor(minZ), bz1 = Math.floor(maxZ);

        for (let bx = bx0; bx <= bx1; bx++) {
            for (let by = by0; by <= by1; by++) {
                for (let bz = bz0; bz <= bz1; bz++) {
                    const block = this.world.getBlock(bx, by, bz);
                    if (block === AIR || block === BLOCK_WATER) continue;
                    if (maxX > bx && minX < bx + 1 &&
                        maxY > by && minY < by + 1 &&
                        maxZ > bz && minZ < bz + 1) return true;
                }
            }
        }
        return false;
    }

    // ---------- ПОДБОР (auto, как в Minecraft) ----------
    tryPickup() {
        if (!this.state.droppedWeapon) return false;
        const playerPos = this.player.pos;
        const dropPos = this.state.droppedWeapon.position;
        if (playerPos.distanceTo(dropPos) > CONFIG.pickUpRange) return false;

        let added = false;
        for (let i = 0; i < this.inventory.hotbar.length; i++) {
            const slot = this.inventory.hotbar[i];
            if (slot.type === null) {
                slot.type = ITEM_SHOTGUN;
                slot.count = 1;
                added = true;
                break;
            } else if (slot.type === ITEM_SHOTGUN && slot.count < 64) {
                slot.count++;
                added = true;
                break;
            }
        }
        if (!added) added = this.inventory.add(ITEM_SHOTGUN, 1);
        if (!added) return false;

        this.state.ammo    = this.state.droppedAmmo;
        this.state.reserve = this.state.droppedReserve;
        this._removeDroppedWeapon();
        return true;
    }

    equip() {
        this.state.equipped = true;
        this.state.targetHolsterProgress = 1;
        this.handRig.visible = true;
        this._createHUD();
        this._updateHUD();
    }

    unequip() {
        this._interruptReload();
        this.state.equipped = false;
        this.state.targetHolsterProgress = 0;
        this.handRig.visible = false;
        this._removeHUD();
    }

    // ---------- HUD ----------
    _createHUD() {
        if (this.hudElements) return;
        const hudContainer = document.createElement('div');
        hudContainer.id = 'shotgun-hud';
        hudContainer.style.cssText = `
            position: fixed; bottom: 30px; right: 30px; z-index: 11;
            pointer-events: none; color: #fff; text-align: right;
            font-size: 16px; letter-spacing: 2px;
            text-shadow: 0 0 10px rgba(0,0,0,0.8);
        `;
        hudContainer.innerHTML = `
            <div class="ammo-count" style="font-size:52px;font-weight:bold;line-height:1;color:#ffcc66;">6</div>
            <div class="ammo-reserve" style="font-size:18px;opacity:0.7;margin-top:2px;">/ 30</div>
            <div class="weapon-status" style="font-size:14px;opacity:0.6;margin-top:8px;letter-spacing:1px;">ДРОБОВИК</div>
            <div class="reload-progress" style="font-size:12px;color:#ffaa44;opacity:0;margin-top:4px;"></div>
        `;
        document.body.appendChild(hudContainer);
        this.hudElements = {
            container: hudContainer,
            ammoCount: hudContainer.querySelector('.ammo-count'),
            ammoReserve: hudContainer.querySelector('.ammo-reserve'),
            status: hudContainer.querySelector('.weapon-status'),
            reloadProgress: hudContainer.querySelector('.reload-progress'),
        };
    }

    _removeHUD() {
        if (this.hudElements) {
            document.body.removeChild(this.hudElements.container);
            this.hudElements = null;
        }
    }

    _updateHUD() {
        if (!this.hudElements) return;
        const { ammoCount, ammoReserve, status, reloadProgress } = this.hudElements;
        ammoCount.textContent = this.state.ammo;
        ammoReserve.textContent = '/ ' + this.state.reserve;
        if (this.state.isReloading) {
            status.textContent = 'ПЕРЕЗАРЯДКА...';
            reloadProgress.style.opacity = '1';
            reloadProgress.textContent = '⚡ ' + this.state.ammo + '/' + CONFIG.maxAmmo;
        } else if (this.state.droppedWeapon) {
            status.textContent = 'БЕЗ ОРУЖИЯ';
            reloadProgress.style.opacity = '0';
        } else if (!this.state.equipped) {
            status.textContent = 'УБРАНО';
            reloadProgress.style.opacity = '0';
        } else if (this.state.isPumping) {
            status.textContent = 'ПОМПА...';
            reloadProgress.style.opacity = '0';
        } else {
            status.textContent = 'ДРОБОВИК';
            reloadProgress.style.opacity = '0';
        }
    }

    // ---------- ОБНОВЛЕНИЕ ----------
    update(dt) {
        // Перезарядка
        if (this.state.isReloading) {
            this.state.reloadTimer -= dt;
            if (this.state.reloadPhase === 'start' && this.state.reloadTimer <= 0) {
                this.state.reloadPhase = 'loading';
                this.state.reloadTimer = CONFIG.shellReloadTime;
                this._processReloadShell();
                if (this.state.shellsToLoad <= 0 || this.state.reserve <= 0 || this.state.ammo >= CONFIG.maxAmmo) {
                    this.state.reloadPhase = 'end';
                    this.state.reloadTimer = CONFIG.reloadEndDelay;
                }
            } else if (this.state.reloadPhase === 'loading' && this.state.reloadTimer <= 0) {
                this._processReloadShell();
                if (this.state.shellsToLoad <= 0 || this.state.reserve <= 0 || this.state.ammo >= CONFIG.maxAmmo) {
                    this.state.reloadPhase = 'end';
                    this.state.reloadTimer = CONFIG.reloadEndDelay;
                } else {
                    this.state.reloadTimer = CONFIG.shellReloadTime;
                }
            } else if (this.state.reloadPhase === 'end' && this.state.reloadTimer <= 0) {
                this._finishReload();
            }
            this._updateHUD();
        }

        this.state.reloadTilt += (this.state.targetReloadTilt - this.state.reloadTilt) * Math.min(dt * 8, 1);

        if (this.state.pumpCooldownTimer > 0) {
            this.state.pumpCooldownTimer -= dt;
            if (this.state.isPumping) {
                this.state.pumpProgress += dt / CONFIG.pumpDuration;
                if (this.state.pumpProgress >= 1.0) {
                    this.state.pumpProgress = 1.0;
                    this.state.isPumping = false;
                    this.playPumpSound();
                }
                const pumpZ = Math.sin(this.state.pumpProgress * Math.PI) * 0.14;
                this.pumpGroup.position.z = pumpZ;
            }
            if (this.state.pumpCooldownTimer <= 0) {
                this.state.pumpCooldownTimer = 0;
                this.state.isPumping = false;
                this.pumpGroup.position.z = 0;
            }
        }

        if (this.state.targetRecoilOffset > 0.0005) {
            this.state.recoilOffset += (this.state.targetRecoilOffset - this.state.recoilOffset) * Math.min(dt * CONFIG.recoilRecoverySpeed, 1);
            if (Math.abs(this.state.targetRecoilOffset - this.state.recoilOffset) < 0.0003) {
                this.state.recoilOffset = this.state.targetRecoilOffset;
                this.state.targetRecoilOffset = 0;
            }
        } else if (this.state.recoilOffset > 0.0001) {
            this.state.recoilOffset *= Math.exp(-CONFIG.recoilRecoverySpeed * dt);
            if (this.state.recoilOffset < 0.0001) this.state.recoilOffset = 0;
        }
        if (this.state.targetRecoilBackOffset > 0.0005) {
            this.state.recoilBackOffset += (this.state.targetRecoilBackOffset - this.state.recoilBackOffset) * Math.min(dt * CONFIG.recoilRecoverySpeed * 0.8, 1);
            if (Math.abs(this.state.targetRecoilBackOffset - this.state.recoilBackOffset) < 0.0003) {
                this.state.recoilBackOffset = this.state.targetRecoilBackOffset;
                this.state.targetRecoilBackOffset = 0;
            }
        } else if (this.state.recoilBackOffset > 0.0001) {
            this.state.recoilBackOffset *= Math.exp(-CONFIG.recoilRecoverySpeed * 0.7 * dt);
            if (this.state.recoilBackOffset < 0.0001) this.state.recoilBackOffset = 0;
        }

        const holsterSpeed = 6;
        if (Math.abs(this.state.holsterProgress - this.state.targetHolsterProgress) > 0.001) {
            this.state.holsterProgress += (this.state.targetHolsterProgress - this.state.holsterProgress) * Math.min(dt * holsterSpeed, 1);
            if (Math.abs(this.state.holsterProgress - this.state.targetHolsterProgress) < 0.002) {
                this.state.holsterProgress = this.state.targetHolsterProgress;
            }
        }

        const basePos = new THREE.Vector3(0.45, -0.35, -0.55);
        const holsterPos = new THREE.Vector3(0.6, -0.7, -0.4);
        const currentHolster = this.state.holsterProgress;
        let targetHandPos = basePos.clone().lerp(holsterPos, 1 - currentHolster);
        targetHandPos.z -= this.state.recoilBackOffset;
        targetHandPos.y += this.state.recoilOffset * 0.6;
        targetHandPos.x += this.state.recoilOffset * 0.3;

        this.handRig.position.lerp(targetHandPos, Math.min(dt * 9, 1));
        this.handRig.rotation.set(this.state.reloadTilt, 0, 0);
        this.handRig.rotation.x -= this.state.recoilOffset * 0.9;

        this.state.idleSwayTime += dt;
        if (this.state.equipped && !this.state.isReloading && this.state.recoilOffset < 0.002 && !this.state.isPumping) {
            this.handRig.position.x += Math.sin(this.state.idleSwayTime * 1.2) * 0.004;
            this.handRig.position.y += Math.cos(this.state.idleSwayTime * 1.7) * 0.005;
            this.handRig.rotation.z += Math.sin(this.state.idleSwayTime * 1.5) * 0.008;
        }

        if (this.state.muzzleFlashTimer > 0) {
            this.state.muzzleFlashTimer -= dt;
            if (this.state.muzzleFlashTimer <= 0) {
                this.muzzleLight.intensity = 0;
                this.muzzleFlashSprite.material.opacity = 0;
            } else {
                const fade = this.state.muzzleFlashTimer / CONFIG.muzzleFlashDuration;
                this.muzzleLight.intensity = 35 * fade;
                this.muzzleFlashSprite.material.opacity = fade;
            }
        }

        // ---------- БРОШЕННОЕ ОРУЖИЕ ----------
        if (this.state.droppedWeapon) {
            const dp = this.state.droppedWeapon;
            const vel = this.state.droppedWeaponVelocity;
            const angVel = this.state.droppedWeaponAngularVel;

            vel.y -= CONFIG.droppedGravity * dt;

            const speed = vel.length();
            const steps = Math.max(1, Math.ceil(speed * dt / 0.15));
            const stepDt = dt / steps;

            for (let s = 0; s < steps; s++) {
                const oldX = dp.position.x;
                dp.position.x += vel.x * stepDt;
                if (this._droppedWeaponCollides(dp.position)) { dp.position.x = oldX; vel.x *= -0.3; }
                const oldZ = dp.position.z;
                dp.position.z += vel.z * stepDt;
                if (this._droppedWeaponCollides(dp.position)) { dp.position.z = oldZ; vel.z *= -0.3; }
                const oldY = dp.position.y;
                dp.position.y += vel.y * stepDt;
                if (this._droppedWeaponCollides(dp.position)) {
                    dp.position.y = oldY;
                    if (vel.y < 0) {
                        vel.y = -vel.y * CONFIG.droppedBounce;
                        vel.x *= 0.75;
                        vel.z *= 0.75;
                        angVel.multiplyScalar(0.55);
                        if (Math.abs(vel.y) < 0.5) vel.y = 0;
                    } else {
                        vel.y = 0;
                    }
                }
            }

            dp.rotation.x += angVel.x * dt;
            dp.rotation.y += angVel.y * dt;
            dp.rotation.z += angVel.z * dt;

            if (vel.y === 0 && Math.abs(vel.x) < 0.05 && Math.abs(vel.z) < 0.05) {
                angVel.multiplyScalar(0.92);
                vel.x *= 0.85;
                vel.z *= 0.85;
            }

            if (dp.position.y < -20) this._removeDroppedWeapon();

            // ---------- AUTO-PICKUP (как в Minecraft) ----------
            // Условия:
            // 1) Игрок отошёл от точки броска ИЛИ оружие улетело (чтобы не подбирать мгновенно после выброса)
            // 2) Игрок находится в радиусе pickUpRange
            // 3) Прошло >0.2 сек (чтобы физика успела отработать)
            this.state.droppedPickupDelay += dt;

            if (!this.state.droppedPlayerMovedAway) {
                const playerFromOrigin = this.player.pos.distanceTo(this.state.droppedOrigin);
                const itemFromOrigin = dp.position.distanceTo(this.state.droppedOrigin);
                if (playerFromOrigin > 2.0 || itemFromOrigin > 2.0) {
                    this.state.droppedPlayerMovedAway = true;
                }
            }

            if (this.state.droppedPlayerMovedAway
                && this.state.droppedPickupDelay > 0.2
                && this.player.pos.distanceTo(dp.position) < CONFIG.pickUpRange) {
                if (this.tryPickup()) {
                    // Обновляем UI (auto-equip произойдёт в ui.updateHotbarSelection,
                    // если предмет попал в текущий активный слот)
                    window.ui?.renderAllSlots?.();
                }
            }
        }

        // Частицы
        this._updateShellCasings(dt);
        this._updateSmokeParticles(dt);
        this._updateBulletTracers(dt);
        this._updateImpactSparks(dt);
    }

    _updateShellCasings(dt) {
        for (let i = this.shellCasings.length - 1; i >= 0; i--) {
            const c = this.shellCasings[i];
            c.age += dt;
            if (c.age > c.maxAge) {
                this.scene.remove(c.mesh);
                if (c.mesh.material) c.mesh.material.dispose();
                c.mesh.geometry.dispose();
                this.shellCasings.splice(i, 1);
                continue;
            }
            c.velocity.y -= 9.8 * dt;
            c.mesh.position.x += c.velocity.x * dt;
            c.mesh.position.y += c.velocity.y * dt;
            c.mesh.position.z += c.velocity.z * dt;
            c.mesh.rotation.x += c.angularVel.x * dt;
            c.mesh.rotation.y += c.angularVel.y * dt;
            c.mesh.rotation.z += c.angularVel.z * dt;
            const groundY = 0.025;
            if (c.mesh.position.y < groundY) {
                c.mesh.position.y = groundY;
                if (c.velocity.y < 0 && c.bounceCount < 2) {
                    c.velocity.y = Math.abs(c.velocity.y) * 0.25;
                    c.velocity.x *= 0.5;
                    c.velocity.z *= 0.5;
                    c.angularVel.multiplyScalar(0.4);
                    c.bounceCount++;
                } else {
                    c.velocity.set(0, 0, 0);
                    c.angularVel.multiplyScalar(0.7);
                    c.onGround = true;
                }
            }
        }
    }

    _updateSmokeParticles(dt) {
        for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
            const p = this.smokeParticles[i];
            p.age += dt;
            if (p.age > p.maxAge) {
                this.scene.remove(p.sprite);
                if (p.sprite.material.map) p.sprite.material.map.dispose();
                p.sprite.material.dispose();
                this.smokeParticles.splice(i, 1);
                continue;
            }
            const progress = p.age / p.maxAge;
            p.sprite.position.add(p.velocity.clone().multiplyScalar(dt));
            const scale = p.initialScale * (1 + progress * 5);
            p.sprite.scale.set(scale, scale, 1);
            p.sprite.material.opacity = 0.6 * (1 - progress) * (1 - progress);
        }
    }

    _updateBulletTracers(dt) {
        for (let i = this.bulletTracers.length - 1; i >= 0; i--) {
            const t = this.bulletTracers[i];
            t.age += dt;
            t.progress = Math.min(t.age / t.maxAge, 1);
            t.tracer.position.lerpVectors(t.start, t.end, t.progress);
            const fade = 1 - t.progress;
            t.line.material.opacity = 0.5 * fade;
            t.tracer.material.opacity = fade;
            if (t.age > t.maxAge) {
                this.scene.remove(t.tracer);
                this.scene.remove(t.line);
                t.tracer.material.dispose();
                t.tracer.geometry.dispose();
                t.line.material.dispose();
                t.line.geometry.dispose();
                this.bulletTracers.splice(i, 1);
            }
        }
    }

    _updateImpactSparks(dt) {
        for (let i = this.impactSparks.length - 1; i >= 0; i--) {
            const s = this.impactSparks[i];
            s.age += dt;
            if (s.age > s.maxAge) {
                this.scene.remove(s.mesh);
                s.mesh.material.dispose();
                s.mesh.geometry.dispose();
                this.impactSparks.splice(i, 1);
                continue;
            }
            s.velocity.y -= 9.8 * dt;
            s.mesh.position.add(s.velocity.clone().multiplyScalar(dt));
            if (s.isFlash) {
                const fp = s.age / s.maxAge;
                s.mesh.scale.setScalar(1 + fp * 4);
                s.mesh.material.opacity = 0.85 * (1 - fp);
            } else {
                const fade = 1 - (s.age / s.maxAge);
                s.mesh.material.opacity = fade;
                s.mesh.scale.setScalar(fade);
            }
        }
    }
}