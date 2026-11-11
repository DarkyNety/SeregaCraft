// js/player-model.js
import * as THREE from 'three';

// ---------- UV‑маппинг и вспомогательные функции ----------
function setFaceUVs(geometry, faceIndex, px, py, w, h, texW = 64, texH = 64) {
    const uvAttr = geometry.attributes.uv;
    const uScale = w / texW;
    const vScale = h / texH;
    const uOff = px / texW;
    const vOff = py / texH;
    const startIdx = faceIndex * 4;
    for (let i = 0; i < 4; i++) {
        const idx = startIdx + i;
        const u = uvAttr.getX(idx);
        const v = uvAttr.getY(idx);
        uvAttr.setXY(idx, uOff + u * uScale, vOff + v * vScale);
    }
    uvAttr.needsUpdate = true;
}

function invertVCoordinates(geometry) {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
        const v = uv.getY(i);
        uv.setY(i, 1 - v);
    }
    uv.needsUpdate = true;
}

// Создаёт часть с pivot в верхней точке (для рук и ног)
function createPivotedPart(w, h, d, uvMapBase, uvMapOverlay, material) {
    const group = new THREE.Group();

    const baseGeom = new THREE.BoxGeometry(w, h, d);
    invertVCoordinates(baseGeom);
    setFaceUVs(baseGeom, 4, ...uvMapBase.front);
    setFaceUVs(baseGeom, 5, ...uvMapBase.back);
    setFaceUVs(baseGeom, 0, ...uvMapBase.right);
    setFaceUVs(baseGeom, 1, ...uvMapBase.left);
    setFaceUVs(baseGeom, 2, ...uvMapBase.top);
    setFaceUVs(baseGeom, 3, ...uvMapBase.bottom);
    const baseMesh = new THREE.Mesh(baseGeom, material);
    baseMesh.position.y = -h / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    if (uvMapOverlay) {
        const inflate = 0.5;
        const overlayGeom = new THREE.BoxGeometry(w + inflate, h + inflate, d + inflate);
        invertVCoordinates(overlayGeom);
        setFaceUVs(overlayGeom, 4, ...uvMapOverlay.front);
        setFaceUVs(overlayGeom, 5, ...uvMapOverlay.back);
        setFaceUVs(overlayGeom, 0, ...uvMapOverlay.right);
        setFaceUVs(overlayGeom, 1, ...uvMapOverlay.left);
        setFaceUVs(overlayGeom, 2, ...uvMapOverlay.top);
        setFaceUVs(overlayGeom, 3, ...uvMapOverlay.bottom);
        const overlayMesh = new THREE.Mesh(overlayGeom, material);
        overlayMesh.position.y = -h / 2;
        overlayMesh.castShadow = true;
        overlayMesh.receiveShadow = true;
        overlayMesh.renderOrder = 1;
        group.add(overlayMesh);
    }
    return group;
}

// Создаёт часть с pivot в центре (голова, тело)
function createCenteredPart(w, h, d, uvMapBase, uvMapOverlay, material) {
    const group = new THREE.Group();

    const baseGeom = new THREE.BoxGeometry(w, h, d);
    invertVCoordinates(baseGeom);
    setFaceUVs(baseGeom, 4, ...uvMapBase.front);
    setFaceUVs(baseGeom, 5, ...uvMapBase.back);
    setFaceUVs(baseGeom, 0, ...uvMapBase.right);
    setFaceUVs(baseGeom, 1, ...uvMapBase.left);
    setFaceUVs(baseGeom, 2, ...uvMapBase.top);
    setFaceUVs(baseGeom, 3, ...uvMapBase.bottom);
    const baseMesh = new THREE.Mesh(baseGeom, material);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    if (uvMapOverlay) {
        const inflate = 0.5;
        const overlayGeom = new THREE.BoxGeometry(w + inflate, h + inflate, d + inflate);
        invertVCoordinates(overlayGeom);
        setFaceUVs(overlayGeom, 4, ...uvMapOverlay.front);
        setFaceUVs(overlayGeom, 5, ...uvMapOverlay.back);
        setFaceUVs(overlayGeom, 0, ...uvMapOverlay.right);
        setFaceUVs(overlayGeom, 1, ...uvMapOverlay.left);
        setFaceUVs(overlayGeom, 2, ...uvMapOverlay.top);
        setFaceUVs(overlayGeom, 3, ...uvMapOverlay.bottom);
        const overlayMesh = new THREE.Mesh(overlayGeom, material);
        overlayMesh.castShadow = true;
        overlayMesh.receiveShadow = true;
        overlayMesh.renderOrder = 1;
        group.add(overlayMesh);
    }
    return group;
}

// ---------- Текстура по умолчанию (Steve) ----------
function createDefaultSkinCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);

    const hairColor = '#4C3B2B', hairDark = '#3A2C1F';
    const skinColor = '#C8A882', skinShadow = '#B89A72';
    const shirtColor = '#3A7D9C', shirtShadow = '#2E6A85', shirtDetail = '#4A90B0';
    const pantsColor = '#2C3E50', pantsShadow = '#1F2E3D';
    const bootColor = '#4A4A4A', bootDark = '#353535';
    const eyeWhite = '#F0F0F0', eyePupil = '#1A0A00';
    const mouthColor = '#8B5E4B';
    const beltColor = '#8B7355', beltBuckle = '#C0A878';

    function fill(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

    // Голова
    fill(8,0,8,8,hairColor); fill(16,0,8,8,skinShadow);
    fill(8,8,8,8,skinColor);
    fill(9,10,2,2,eyeWhite); fill(13,10,2,2,eyeWhite);
    fill(10,11,1,1,eyePupil); fill(14,11,1,1,eyePupil);
    fill(10,13,4,1,mouthColor);
    ctx.fillStyle = hairDark; ctx.fillRect(9,9,2,1); ctx.fillRect(13,9,2,1);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(8,8,1,8); ctx.fillRect(15,8,1,8);
    fill(24,8,8,8,hairDark); fill(0,8,8,8,hairColor); fill(16,8,8,8,hairColor);

    // Тело
    fill(20,16,8,4,shirtDetail); fill(28,16,8,4,shirtShadow);
    fill(20,20,8,12,shirtColor); fill(22,20,4,2,shirtDetail);
    fill(21,22,1,3,shirtShadow); fill(26,22,1,3,shirtShadow);
    fill(20,29,8,2,beltColor); fill(23,29,2,2,beltBuckle);
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(21,23,6,5);
    fill(32,20,8,12,shirtShadow); fill(16,20,4,12,shirtShadow); fill(28,20,4,12,shirtShadow);

    // Правая рука
    fill(44,16,4,4,shirtDetail); fill(48,16,4,4,skinColor);
    fill(44,20,4,12,shirtColor); fill(44,26,4,6,skinColor);
    fill(52,20,4,12,shirtShadow); fill(52,26,4,6,skinShadow);
    fill(40,20,4,12,shirtShadow); fill(40,26,4,6,skinShadow);
    fill(48,20,4,12,shirtShadow); fill(48,26,4,6,skinShadow);

    // Левая рука
    fill(36,48,4,4,shirtDetail); fill(40,48,4,4,skinColor);
    fill(36,52,4,12,shirtColor); fill(36,58,4,6,skinColor);
    fill(44,52,4,12,shirtShadow); fill(44,58,4,6,skinShadow);
    fill(32,52,4,12,shirtShadow); fill(32,58,4,6,skinShadow);
    fill(40,52,4,12,shirtShadow); fill(40,58,4,6,skinShadow);

    // Правая нога
    fill(4,16,4,4,pantsColor); fill(8,16,4,4,bootDark);
    fill(4,20,4,12,pantsColor); fill(4,28,4,4,bootColor);
    fill(12,20,4,12,pantsShadow); fill(12,28,4,4,bootDark);
    fill(0,20,4,12,pantsShadow); fill(0,28,4,4,bootDark);
    fill(8,20,4,12,pantsShadow); fill(8,28,4,4,bootDark);

    // Левая нога
    fill(20,48,4,4,pantsColor); fill(24,48,4,4,bootDark);
    fill(20,52,4,12,pantsColor); fill(20,60,4,4,bootColor);
    fill(28,52,4,12,pantsShadow); fill(28,60,4,4,bootDark);
    fill(16,52,4,12,pantsShadow); fill(16,60,4,4,bootDark);
    fill(24,52,4,12,pantsShadow); fill(24,60,4,4,bootDark);

    // Overlay голова
    fill(40,0,8,8,hairColor); fill(48,0,8,8,skinShadow);
    fill(40,8,8,8,hairColor); fill(56,8,8,8,hairDark);
    fill(32,8,8,8,hairColor); fill(48,8,8,8,hairColor);

    // Overlay тело
    fill(20,32,8,4,shirtDetail); fill(28,32,8,4,shirtShadow);
    fill(20,36,8,12,shirtColor); fill(22,36,4,2,shirtDetail);
    ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.fillRect(21,38,6,8);
    fill(32,36,8,12,shirtShadow); fill(16,36,4,12,shirtShadow); fill(28,36,4,12,shirtShadow);

    return canvas;
}

// ---------- Создание всей модели ----------
export function createPlayerModel() {
    const defaultCanvas = createDefaultSkinCanvas();
    const defaultTexture = new THREE.CanvasTexture(defaultCanvas);
    defaultTexture.flipY = false;
    defaultTexture.magFilter = THREE.NearestFilter;
    defaultTexture.minFilter = THREE.NearestFilter;
    defaultTexture.colorSpace = THREE.SRGBColorSpace;
    defaultTexture.needsUpdate = true;

    const material = new THREE.MeshStandardMaterial({
        map: defaultTexture,
        roughness: 0.55,
        metalness: 0.02,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.FrontSide,
    });

    // UV‑карты (полный набор)
    const uvHead = {front:[8,8,8,8],back:[24,8,8,8],right:[0,8,8,8],left:[16,8,8,8],top:[8,0,8,8],bottom:[16,0,8,8]};
    const uvBody = {front:[20,20,8,12],back:[32,20,8,12],right:[16,20,4,12],left:[28,20,4,12],top:[20,16,8,4],bottom:[28,16,8,4]};
    const uvRightArm = {front:[44,20,4,12],back:[52,20,4,12],right:[40,20,4,12],left:[48,20,4,12],top:[44,16,4,4],bottom:[48,16,4,4]};
    const uvLeftArm = {front:[36,52,4,12],back:[44,52,4,12],right:[32,52,4,12],left:[40,52,4,12],top:[36,48,4,4],bottom:[40,48,4,4]};
    const uvRightLeg = {front:[4,20,4,12],back:[12,20,4,12],right:[0,20,4,12],left:[8,20,4,12],top:[4,16,4,4],bottom:[8,16,4,4]};
    const uvLeftLeg = {front:[20,52,4,12],back:[28,52,4,12],right:[16,52,4,12],left:[24,52,4,12],top:[20,48,4,4],bottom:[24,48,4,4]};
    // Overlay
    const uvHeadO = {front:[40,8,8,8],back:[56,8,8,8],right:[32,8,8,8],left:[48,8,8,8],top:[40,0,8,8],bottom:[48,0,8,8]};
    const uvBodyO = {front:[20,36,8,12],back:[32,36,8,12],right:[16,36,4,12],left:[28,36,4,12],top:[20,32,8,4],bottom:[28,32,8,4]};
    const uvRightArmO = {front:[44,36,4,12],back:[52,36,4,12],right:[40,36,4,12],left:[48,36,4,12],top:[44,32,4,4],bottom:[48,32,4,4]};
    const uvLeftArmO = {front:[52,52,4,12],back:[60,52,4,12],right:[48,52,4,12],left:[56,52,4,12],top:[52,48,4,4],bottom:[56,48,4,4]};
    const uvRightLegO = {front:[4,36,4,12],back:[12,36,4,12],right:[0,36,4,12],left:[8,36,4,12],top:[4,32,4,4],bottom:[8,32,4,4]};
    const uvLeftLegO = {front:[20,52,4,12],back:[28,52,4,12],right:[16,52,4,12],left:[24,52,4,12],top:[20,48,4,4],bottom:[24,48,4,4]};

    const group = new THREE.Group();
    group.name = 'playerModel';

    // Голова
    const head = createCenteredPart(8, 8, 8, uvHead, uvHeadO, material);
    head.position.set(0, 28, 0);
    head.name = 'head';
    group.add(head);

    // Тело
    const body = createCenteredPart(8, 12, 4, uvBody, uvBodyO, material);
    body.position.set(0, 18, 0);
    body.name = 'body';
    group.add(body);

    // Правая рука (плечо: -6, 24, 0.5)
    const rightArm = createPivotedPart(4, 12, 4, uvRightArm, uvRightArmO, material);
    rightArm.position.set(-6, 24, 0.5);
    rightArm.name = 'rightArm';
    group.add(rightArm);

    // Левая рука (плечо: 6, 24, 0.5)
    const leftArm = createPivotedPart(4, 12, 4, uvLeftArm, uvLeftArmO, material);
    leftArm.position.set(6, 24, 0.5);
    leftArm.name = 'leftArm';
    group.add(leftArm);

    // Правая нога (бедро: -2, 12, 0)
    const rightLeg = createPivotedPart(4, 12, 4, uvRightLeg, uvRightLegO, material);
    rightLeg.position.set(-2, 12, 0);
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

    // Левая нога (бедро: 2, 12, 0)
    const leftLeg = createPivotedPart(4, 12, 4, uvLeftLeg, uvLeftLegO, material);
    leftLeg.position.set(2, 12, 0);
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);

    // Уменьшаем модель до реалистичного размера (высота ≈ 1.8)
    const scale = 1.8 / 32; // 0.05625
    group.scale.set(scale, scale, scale);

    // Сохраняем ссылки для анимации
    group.userData.parts = {
        head, body, rightArm, leftArm, rightLeg, leftLeg
    };
    group.userData.material = material;
    group.userData.defaultTexture = defaultTexture;

    return group;
}

export function setSkin(model, imageSource) {
    const material = model.userData.material;
    if (!material) return;
    
    if (typeof imageSource === 'string') {
        // URL
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(imageSource, (texture) => {
            texture.flipY = false;
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
            if (material.map && material.map !== model.userData.defaultTexture) {
                material.map.dispose();
            }
            material.map = texture;
            material.needsUpdate = true;
        });
    } else if (imageSource instanceof HTMLImageElement) {
        const texture = new THREE.Texture(imageSource);
        texture.flipY = false;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        if (material.map && material.map !== model.userData.defaultTexture) {
            material.map.dispose();
        }
        material.map = texture;
        material.needsUpdate = true;
    } else if (imageSource instanceof HTMLCanvasElement) {
        const texture = new THREE.CanvasTexture(imageSource);
        texture.flipY = false;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        if (material.map && material.map !== model.userData.defaultTexture) {
            material.map.dispose();
        }
        material.map = texture;
        material.needsUpdate = true;
    }
}



// ---------- Анимация (соответствует player_walking.html) ----------
export function animatePlayerModel(model, speed, time) {
    const parts = model.userData.parts;
    if (!parts) return;

    const walkBlend = Math.min(speed * 1.5, 1.0); // плавный переход между idle и walk

    // Idle-анимация (дыхание)
    const breathe = Math.sin(time * 1.8) * 0.15;
    const idleBodyY = 18 + breathe;
    const idleHeadY = 28 + breathe;
    const idleHeadZ = Math.sin(time * 1.3) * 0.03;
    const idleHeadX = Math.sin(time * 1.5 + 0.5) * 0.04;
    const idleRightArmX = Math.sin(time * 1.6) * 0.06;
    const idleLeftArmX = Math.sin(time * 1.6 + Math.PI) * 0.06;
    const idleRightLegX = 0;
    const idleLeftLegX = 0;

    // Walk-анимация
    // Частота шагов зависит от реальной скорости (чем быстрее, тем чаще)
    // hSpeed ожидается в диапазоне 0 .. 12, подбираем коэффициент так,
    // чтобы при скорости ~5 м/с частота была около 4 Гц
    const hSpeed = speed * 12; // восстанавливаем абсолютную скорость из нормализованной
    const walkFreq = Math.min(hSpeed * 0.9, 7.5); // ограничиваем частоту сверху
    const cycle = time * walkFreq;
    const swing = Math.sin(cycle) * 0.5;          // амплитуда чуть уменьшена для рук
    const opposite = Math.sin(cycle + Math.PI) * 0.5;
    
    // Вертикальное покачивание: два подъёма за полный цикл (на каждый шаг)
    const bounce = Math.abs(Math.sin(cycle * 2)) * 0.8; // амплитуда увеличена

    const walkBodyY = 18 + bounce * 0.8; // сильнее выражен подъём тела
    const walkHeadY = 28 + bounce * 0.8;
    
    // Разноимённое движение: правая рука вперёд, когда левая нога вперёд
    const walkRightArmX = swing;   // вперёд вместе с левой ногой
    const walkLeftArmX = opposite; // назад
    const walkRightLegX = opposite;// назад
    const walkLeftLegX = swing;    // вперёд

    // Интерполяция idle → walk
    const bodyY = idleBodyY + (walkBodyY - idleBodyY) * walkBlend;
    const headY = idleHeadY + (walkHeadY - idleHeadY) * walkBlend;
    const headRotZ = idleHeadZ * (1 - walkBlend);
    const headRotX = idleHeadX * (1 - walkBlend);
    const rightArmX = idleRightArmX + (walkRightArmX - idleRightArmX) * walkBlend;
    const leftArmX = idleLeftArmX + (walkLeftArmX - idleLeftArmX) * walkBlend;
    const rightLegX = idleRightLegX + (walkRightLegX - idleRightLegX) * walkBlend;
    const leftLegX = idleLeftLegX + (walkLeftLegX - idleLeftLegX) * walkBlend;

    // Применяем
    if (parts.body) parts.body.position.y = bodyY;
    if (parts.head) {
        parts.head.position.y = headY;
        parts.head.rotation.z = headRotZ;
        parts.head.rotation.x = headRotX;
    }
    if (parts.rightArm) parts.rightArm.rotation.x = rightArmX;
    if (parts.leftArm) parts.leftArm.rotation.x = leftArmX;
    if (parts.rightLeg) parts.rightLeg.rotation.x = rightLegX;
    if (parts.leftLeg) parts.leftLeg.rotation.x = leftLegX;
}