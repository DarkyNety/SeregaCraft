// car-model.js
import * as THREE from 'three';

/**
 * Создаёт 3D-модель спортивного автомобиля.
 * @param {number} bodyLift - дополнительный подъём кузова над колёсами (по умолчанию 0.15).
 * @returns {THREE.Group}
 */
export function createCar(bodyLift = 0.15) {
    const car = new THREE.Group();

    // ---------- МАТЕРИАЛЫ ----------
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x1e5fbb, roughness: 0.25, metalness: 0.85,
    });
    const bodyDarkMaterial = new THREE.MeshStandardMaterial({
        color: 0x143d7a, roughness: 0.3, metalness: 0.8,
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e, roughness: 0.05, metalness: 0.1,
    });
    const headlightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffeedd, roughness: 0.1, metalness: 0.2,
        emissive: 0xffeedd, emissiveIntensity: 0.8,
    });
    const tailLightMaterial = new THREE.MeshStandardMaterial({
        color: 0xff1111, roughness: 0.1, metalness: 0.2,
        emissive: 0xff0000, emissiveIntensity: 0.9,
    });
    const chromeMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc, roughness: 0.15, metalness: 0.95,
    });
    const blackPlasticMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111, roughness: 0.5, metalness: 0.1,
    });
    const tireMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, roughness: 0.7, metalness: 0.05,
    });
    const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa, roughness: 0.2, metalness: 0.9,
    });
    const licensePlateMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.3, metalness: 0.1,
    });

    // ---------- КУЗОВ ----------
    const lowerBody = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.32, 4.8),
        bodyDarkMaterial
    );
    lowerBody.position.y = 0.16 + bodyLift;
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    car.add(lowerBody);

    const mainBody = new THREE.Mesh(
        new THREE.BoxGeometry(2.05, 0.38, 4.6),
        bodyMaterial
    );
    mainBody.position.y = 0.48 + bodyLift;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    car.add(mainBody);

    // Боковые юбки
    const sideSkirtLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.12, 4.5),
        chromeMaterial
    );
    sideSkirtLeft.position.set(-1.03, 0.22 + bodyLift, 0);
    sideSkirtLeft.castShadow = true;
    car.add(sideSkirtLeft);

    const sideSkirtRight = sideSkirtLeft.clone();
    sideSkirtRight.position.x = 1.03;
    car.add(sideSkirtRight);

    // Кабина
    const cabinBase = new THREE.Mesh(
        new THREE.BoxGeometry(1.85, 0.34, 2.0),
        bodyMaterial
    );
    cabinBase.position.set(0, 0.82 + bodyLift, -0.15);
    cabinBase.castShadow = true;
    cabinBase.receiveShadow = true;
    car.add(cabinBase);

    // Лобовое стекло
    const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.4, 0.06),
        glassMaterial
    );
    windshield.position.set(0.0, 0.88 + bodyLift, 0.92);
    windshield.rotation.x = -0.55;
    windshield.castShadow = true;
    car.add(windshield);

    // Заднее стекло
    const rearWindow = new THREE.Mesh(
        new THREE.BoxGeometry(1.76, 0.4, 0.275),
        glassMaterial
    );
    rearWindow.position.set(0, 0.85 + bodyLift, -1.08);
    rearWindow.rotation.x = 0.55;
    rearWindow.castShadow = true;
    car.add(rearWindow);

    // Боковые стёкла — передние
    const sideWindowFrontGeom = new THREE.BoxGeometry(0.04, 0.32, 0.75);
    const leftWindowFront = new THREE.Mesh(sideWindowFrontGeom, glassMaterial);
    leftWindowFront.position.set(-0.95, 0.86 + bodyLift, 0.35);
    leftWindowFront.castShadow = true;
    car.add(leftWindowFront);

    const rightWindowFront = leftWindowFront.clone();
    rightWindowFront.position.x = 0.93;
    car.add(rightWindowFront);

    // Боковые стёкла — задние
    const sideWindowRearGeom = new THREE.BoxGeometry(0.04, 0.28, 0.65);
    const leftWindowRear = new THREE.Mesh(sideWindowRearGeom, glassMaterial);
    leftWindowRear.position.set(-0.93, 0.86 + bodyLift, -0.5);
    leftWindowRear.castShadow = true;
    car.add(leftWindowRear);

    const rightWindowRear = leftWindowRear.clone();
    rightWindowRear.position.x = 0.93;
    car.add(rightWindowRear);

    // Крыша
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.08, 1.9),
        bodyMaterial
    );
    roof.position.set(0, 1.05 + bodyLift, -0.15);
    roof.castShadow = true;
    roof.receiveShadow = true;
    car.add(roof);

    // Капот
    const hood = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.1, 1.5),
        bodyMaterial
    );
    hood.position.set(0, 0.7 + bodyLift, 1.2);
    hood.castShadow = true;
    hood.receiveShadow = true;
    car.add(hood);

    // Линия капота (хром)
    const hoodLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.12, 1.45),
        chromeMaterial
    );
    hoodLine.position.set(0, 0.72 + bodyLift, 1.2);
    hoodLine.castShadow = true;
    car.add(hoodLine);

    // Багажник
    const trunk = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.13, 0.7),
        bodyMaterial
    );
    trunk.position.set(0, 0.68 + bodyLift, -1.55);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    car.add(trunk);

    // Спойлер
    const spoilerStandGeom = new THREE.BoxGeometry(0.08, 0.2, 0.08);
    const spoilerStandLeft = new THREE.Mesh(spoilerStandGeom, blackPlasticMaterial);
    spoilerStandLeft.position.set(-0.7, 0.78 + bodyLift, -1.85);
    spoilerStandLeft.castShadow = true;
    car.add(spoilerStandLeft);

    const spoilerStandRight = spoilerStandLeft.clone();
    spoilerStandRight.position.x = 0.7;
    car.add(spoilerStandRight);

    const spoilerWing = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.05, 0.15),
        blackPlasticMaterial
    );
    spoilerWing.position.set(0, 0.89 + bodyLift, -1.85);
    spoilerWing.castShadow = true;
    spoilerWing.receiveShadow = true;
    car.add(spoilerWing);

    // Фары
    const headlightGeom = new THREE.BoxGeometry(0.45, 0.16, 0.08);
    const headlightLeft = new THREE.Mesh(headlightGeom, headlightMaterial);
    headlightLeft.position.set(-0.55, 0.45 + bodyLift, 2.35);
    headlightLeft.castShadow = true;
    car.add(headlightLeft);

    const headlightRight = headlightLeft.clone();
    headlightRight.position.x = 0.55;
    car.add(headlightRight);

    // Решётка радиатора
    const grille = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.18, 0.04),
        chromeMaterial
    );
    grille.position.set(0, 0.42 + bodyLift, 2.38);
    grille.castShadow = true;
    car.add(grille);

    for (let i = -0.2; i <= 0.2; i += 0.1) {
        const grilleBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.15, 0.05),
            chromeMaterial
        );
        grilleBar.position.set(i, 0.42 + bodyLift, 2.39);
        grilleBar.castShadow = true;
        car.add(grilleBar);
    }

    // Задние фонари
    const tailLightGeom = new THREE.BoxGeometry(0.45, 0.16, 0.08);
    const tailLightLeft = new THREE.Mesh(tailLightGeom, tailLightMaterial);
    tailLightLeft.position.set(-0.55, 0.45 + bodyLift, -2.35);
    tailLightLeft.castShadow = true;
    car.add(tailLightLeft);

    const tailLightRight = tailLightLeft.clone();
    tailLightRight.position.x = 0.55;
    car.add(tailLightRight);

    // Номерной знак
    const licensePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.1, 0.02),
        licensePlateMaterial
    );
    licensePlate.position.set(0, 0.58 + bodyLift, -2.38);
    car.add(licensePlate);

    // ---------- КОЛЁСА ----------
    function createWheel(posX, posZ) {
        const wheel = new THREE.Group();

        const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.34, 0.34, 0.28, 32),
            tireMaterial
        );
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        tire.receiveShadow = true;
        wheel.add(tire);

        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.26, 16),
            rimMaterial
        );
        rim.rotation.z = Math.PI / 2;
        rim.castShadow = true;
        rim.receiveShadow = true;
        wheel.add(rim);

        // Спицы
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const spoke = new THREE.Mesh(
                new THREE.BoxGeometry(0.18, 0.04, 0.18),
                rimMaterial
            );
            spoke.position.set(0, Math.cos(angle) * 0.12, Math.sin(angle) * 0.12);
            spoke.castShadow = true;
            rim.add(spoke);
        }

        // Колпак центра
        const centerCap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.07, 0.27, 16),
            chromeMaterial
        );
        centerCap.rotation.z = Math.PI / 2;
        centerCap.castShadow = true;
        wheel.add(centerCap);

        wheel.position.set(posX, 0.32, posZ);
        return wheel;
    }

    // Передние колёса
    car.add(createWheel(-1.02, 1.5));
    car.add(createWheel(1.02, 1.5));
    // Задние колёса
    car.add(createWheel(-1.02, -1.5));
    car.add(createWheel(1.02, -1.5));

    // ---------- ЗЕРКАЛА ----------
    function createMirror(sideX) {
        const mirrorGroup = new THREE.Group();
        const baseZ = 0.75;
        const baseY = 0.88 + bodyLift;
        const baseX = sideX * 1.0;

        const mirrorBase = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.1, 0.06),
            bodyMaterial
        );
        mirrorBase.position.set(baseX, baseY, baseZ);
        mirrorBase.castShadow = true;
        mirrorGroup.add(mirrorBase);

        const armLength = 0.25;
        const mirrorArm = new THREE.Mesh(
            new THREE.BoxGeometry(armLength, 0.05, 0.05),
            chromeMaterial
        );
        mirrorArm.position.set(
            baseX + sideX * (armLength / 2 + 0.03),
            baseY + 0.03,
            baseZ
        );
        mirrorArm.castShadow = true;
        mirrorGroup.add(mirrorArm);

        const mirrorHousing = new THREE.Group();
        mirrorHousing.position.set(
            baseX + sideX * (armLength + 0.06),
            baseY + 0.03,
            baseZ
        );

        const housingBack = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.12, 0.16),
            blackPlasticMaterial
        );
        housingBack.castShadow = true;
        mirrorHousing.add(housingBack);

        const mirrorGlass = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.1, 0.14),
            glassMaterial
        );
        mirrorGlass.position.set(-0.03, 0, 0);
        mirrorGlass.castShadow = true;
        mirrorHousing.add(mirrorGlass);

        mirrorHousing.rotation.y = sideX * -1;
        mirrorGroup.add(mirrorHousing);

        return mirrorGroup;
    }

    car.add(createMirror(-1)); // левое
    car.add(createMirror(1));  // правое

    // ---------- ВЫХЛОПНЫЕ ТРУБЫ ----------
    function createExhaust(sideX) {
        const exhaust = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.07, 0.2, 16),
            chromeMaterial
        );
        exhaust.rotation.x = Math.PI / 2;
        exhaust.position.set(sideX * 0.5, 0.15 + bodyLift, -2.4);
        exhaust.castShadow = true;
        return exhaust;
    }

    car.add(createExhaust(-1));
    car.add(createExhaust(1));

    // ---------- РУЧКИ ДВЕРЕЙ ----------
    function createDoorHandle(sideX, posZ) {
        const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.025, 0.25),
            chromeMaterial
        );
        handle.position.set(sideX * 1.04, 0.55 + bodyLift, posZ);
        handle.castShadow = true;
        return handle;
    }

    car.add(createDoorHandle(-1, 0.35));
    car.add(createDoorHandle(1, 0.35));
    car.add(createDoorHandle(-1, -0.55));
    car.add(createDoorHandle(1, -0.55));

    return car;
}