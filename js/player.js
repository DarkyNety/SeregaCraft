// js/player.js
import {
    GRAVITY, JUMP_VEL, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE_HEIGHT,
    AIR, BLOCK_WATER, BLOCK_GRASS_PLANT, isTorchBlock
} from './constants.js';
import * as THREE from 'three';


//this.bobPhase = 0;             // фаза шага (радианы)
// this.bobAmplitude = 0.08;      // вертикальная амплитуда (в блоках)
// this.bobHorizontal = 0.03;     // горизонтальная амплитуда (в блоках)
// this.bobSpeed = 8.0;           // скорость изменения фазы (зависит от скорости игрока)
// this.bobDamping = 5.0;         // скорость затухания покачивания при остановке
// this.isOnGround = false;       // должно уже существовать
// this.velocity = new THREE.Vector3(); // вектор скорости (должен быть)



export class Player {
    constructor(world) {
        this.world = world;
        this.pos = new THREE.Vector3(0, 50, 0);
        this.vel = new THREE.Vector3(0, 0, 0);
        this.yaw = 0;
        this.pitch = 0;
        this.onGround = false;
        this.inWater = false;
        this.w = PLAYER_WIDTH;
        this.h = PLAYER_HEIGHT;
        this.eye = PLAYER_EYE_HEIGHT;
        this.bobTimer = 0;
    }

    // AABB игрока
    aabb(px, py, pz) {
        const hw = this.w / 2;
        return {
            minX: px - hw,
            maxX: px + hw,
            minY: py,
            maxY: py + this.h,
            minZ: pz - hw,
            maxZ: pz + hw
        };
    }


    update(dt) {
        if (isNaN(this.pos.x) || isNaN(this.pos.y) || isNaN(this.pos.z)) {
            console.error('Player position is NaN, resetting to safe spot');
            this.pos.set(0, 70, 0);
            this.vel.set(0, 0, 0);
            return;
        }

        const waterFactor = this.inWater ? 0.4 : 1.0;
        this.vel.y -= GRAVITY * dt * waterFactor;

        // Перемещение с проверкой коллизий по осям
        const nx = this.pos.x + this.vel.x * dt;
        const ny = this.pos.y + this.vel.y * dt;
        const nz = this.pos.z + this.vel.z * dt;

        // X
        if (!this.collide(nx, this.pos.y, this.pos.z)) {
            this.pos.x = nx;
        } else {
            this.vel.x = 0;
        }
        // Y
        if (!this.collide(this.pos.x, ny, this.pos.z)) {
            this.pos.y = ny;
            this.onGround = false;
        } else {
            if (this.vel.y < 0) this.onGround = true;
            this.vel.y = 0;
        }
        // Z
        if (!this.collide(this.pos.x, this.pos.y, nz)) {
            this.pos.z = nz;
        } else {
            this.vel.z = 0;
        }

        // Сопротивление воды
        if (this.inWater) {
            this.vel.x *= (0.8 * 0.7);
            this.vel.z *= (0.8 * 0.7);
            if (this.vel.y < 0) this.vel.y *= 0.85;
            if (this.vel.y < -2) this.vel.y = -2;
        }

        // Трение
        const friction = this.onGround ? 8 : 2;
        this.vel.x *= Math.exp(-friction * dt);
        this.vel.z *= Math.exp(-friction * dt);

        // Ограничение падения
        if (this.vel.y < -40) this.vel.y = -40;

        // Ограничение горизонтальной скорости
        const hsp = Math.sqrt(this.vel.x ** 2 + this.vel.z ** 2);
        if (hsp > 12) {
            const scale = 12 / hsp;
            this.vel.x *= scale;
            this.vel.z *= scale;
        }

        const blockUnder = this.world.getBlock(
        Math.floor(this.pos.x), Math.floor(this.pos.y - 0.1), Math.floor(this.pos.z)
    );
    // console.log(`Block under feet: ${blockUnder}, y=${this.pos.y.toFixed(2)}`);
    }

    jump() {
        if (this.inWater) {
            this.vel.y = 5;
            this.onGround = false;
        } else if (this.onGround) {
            this.vel.y = JUMP_VEL;
            this.onGround = false;
        }
    }

    eyePos() {
        return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z);
    }

    collide(px, py, pz) {
        const b = this.aabb(px, py, pz);
        this.inWater = false; // сбрасываем, будет установлен, если найдём воду
        // console.log('collide check at', px.toFixed(2), py.toFixed(2), pz.toFixed(2));
        for (let bx = Math.floor(b.minX); bx <= Math.floor(b.maxX); bx++) {
            for (let by = Math.floor(b.minY); by <= Math.floor(b.maxY); by++) {
                for (let bz = Math.floor(b.minZ); bz <= Math.floor(b.maxZ); bz++) {
                    const block = this.world.getBlock(bx, by, bz);
                    if (block === BLOCK_WATER) {
                        this.inWater = true;
                        continue;
                    }
                    if (block !== AIR && block !== BLOCK_GRASS_PLANT && !isTorchBlock(block)) {
                        // console.log('block found:', block, 'at', bx, by, bz);
                        // Проверка пересечения AABB игрока и блока
                        if (
                            b.maxX > bx && b.minX < bx + 1 &&
                            b.maxY > by && b.minY < by + 1 &&
                            b.maxZ > bz && b.minZ < bz + 1
                        ) {
                            return true;
                        }
                    }
                }
            }
        }
        // console.log('collide returning false');
        return false;
    }
}