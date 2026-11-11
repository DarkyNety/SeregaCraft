// js/car-entity.js
import * as THREE from 'three';
import { GRAVITY, AIR, BLOCK_WATER, BLOCK_GRASS_PLANT, isTorchBlock } from './constants.js';
import { createCar as createCarModel } from './car-model.js';

export class CarEntity {
    static SPEED = 22;
    static REVERSE = 10;
    static ACCEL = 15;
    static BRAKE = 25;
    static FRICTION = 5;
    static TURN_SPEED = 2.0;

    constructor(pos, rotY = 0) {
        this.model = createCarModel(0.15);
        this.model.position.copy(pos);
        this.model.rotation.y = rotY;
        this.model.castShadow = true;
        this.model.receiveShadow = true;

        this.velocity = 0;
        this.velocityY = 0;
        this.yaw = rotY;
        this.onGround = false;

        this.driver = null;
        this.camYaw = 0;
        this.camPitch = 0.3;
        this.cameraDistance = 6.0;
        this.cameraHeight = 2.5;
    }

    get position() { return this.model.position; }

    // Более компактный AABB, чтобы не цепляться за каждый угол
    get aabb() {
        const p = this.position;
        const hw = 1.0, hh = 1.0, hl = 2.4;
        return {
            minX: p.x - hw, maxX: p.x + hw,
            minY: p.y,      maxY: p.y + hh,
            minZ: p.z - hl, maxZ: p.z + hl
        };
    }

    _collide(world) {
        const b = this.aabb;
        for (let bx = Math.floor(b.minX); bx <= Math.floor(b.maxX); bx++)
            for (let by = Math.floor(b.minY); by <= Math.floor(b.maxY); by++)
                for (let bz = Math.floor(b.minZ); bz <= Math.floor(b.maxZ); bz++) {
                    const block = world.getBlock(bx, by, bz);
                    if (block !== AIR && block !== BLOCK_WATER && block !== BLOCK_GRASS_PLANT && !isTorchBlock(block)) {
                        if (b.maxX > bx && b.minX < bx + 1 &&
                            b.maxY > by && b.minY < by + 1 &&
                            b.maxZ > bz && b.minZ < bz + 1)
                            return true;
                    }
                }
        return false;
    }

    /** Аккуратно ставит машину на землю при создании */
    placeOnGround(world) {
        for (let i = 0; i < 20; i++) {
            this.position.y -= 0.5;
            if (this._collide(world)) {
                while (this._collide(world)) this.position.y += 0.01;
                this.position.y += 0.01;
                break;
            }
        }
        this.velocityY = 0;
        this.onGround = true;
    }

    update(dt, world, input) {
    // Гравитация
    this.velocityY -= GRAVITY * dt;

    // Управление (только с водителем)
    if (this.driver) {
        let accel = 0;
        if (input.forward) accel = CarEntity.ACCEL;
        else if (input.backward) accel = -CarEntity.ACCEL;
        else accel = -Math.sign(this.velocity) * CarEntity.FRICTION;

        this.velocity += accel * dt;
        if (!input.forward && !input.backward && Math.abs(this.velocity) < 0.5) this.velocity = 0;

        const maxSpd = input.backward ? CarEntity.REVERSE : CarEntity.SPEED;
        if (this.velocity > maxSpd) this.velocity = maxSpd;
        if (this.velocity < -CarEntity.REVERSE) this.velocity = -CarEntity.REVERSE;

        // Поворот
        let turn = 0;
        if (input.left) turn = 1;
        else if (input.right) turn = -1;
        if (turn !== 0 && Math.abs(this.velocity) > 0.3)
            this.yaw += CarEntity.TURN_SPEED * (this.velocity / CarEntity.SPEED) * dt * turn;
    }

    // Горизонтальное движение
    const moveX = Math.sin(this.yaw) * this.velocity * dt;
    const moveZ = Math.cos(this.yaw) * this.velocity * dt;

    const origX = this.position.x, origZ = this.position.z;
    this.position.x += moveX;
    if (this._collide(world)) { this.position.x = origX; this.velocity = 0; }
    this.position.z += moveZ;
    if (this._collide(world)) { this.position.z = origZ; this.velocity = 0; }

    // Вертикальное движение
    this.position.y += this.velocityY * dt;
    if (this._collide(world)) {
        while (this._collide(world)) this.position.y += 0.01;
        this.velocityY = 0;
    }

    this.model.position.copy(this.position);
    this.model.rotation.y = this.yaw;

    // ⚡ Синхронизируем позицию игрока с машиной
    if (this.driver) {
        this.driver.pos.copy(this.position);
        this.driver.vel.set(0, 0, 0); // чтобы анимация ходьбы не проигрывалась
    }
}

    enter(player) {
        if (this.driver) return false;
        this.driver = player;
        this.velocity = 0;
        this.velocityY = 0;
        this.camYaw = 0;
        this.camPitch = 0.3;
        return true;
    }

    exit() {
        const p = this.driver;
        this.driver = null;
        this.velocity = 0;
        if (p) {
            p.pos.copy(this.position);
            p.pos.y += 0.5;
            p.pos.x -= 1.8;
            p.vel.set(0,0,0);
        }
        return p;
    }

    getCameraPosition() {
        const angle = this.yaw + this.camYaw;
        const dir = new THREE.Vector3(
            Math.sin(angle),
            Math.sin(this.camPitch),
            Math.cos(angle)
        ).normalize();
        const pos = this.position.clone();
        pos.add(dir.clone().multiplyScalar(this.cameraDistance));
        pos.y += this.cameraHeight;
        return pos;
    }
}