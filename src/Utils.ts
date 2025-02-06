// src/Utils.ts
import * as THREE from 'three';

export interface FaceData {
    faceType: string;
    center: THREE.Vector3;
    normal: THREE.Vector3;
}

export function getGroundIntersection(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    raycaster: THREE.Raycaster
): THREE.Vector3 {
    const pointer = new THREE.Vector2(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, intersection);
    return intersection;
}

export function getPlaneIntersection(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    raycaster: THREE.Raycaster,
    plane: THREE.Plane
): THREE.Vector3 {
    const pointer = new THREE.Vector2(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    return intersection;
}

export function getBeamFaceCenters(beam: THREE.Mesh): FaceData[] {
    const length = beam.userData.length as number;
    const height = beam.userData.height as number;
    const depth = beam.userData.depth as number;

    const localFaces: { faceType: string; pos: THREE.Vector3; normal: THREE.Vector3 }[] = [
        { faceType: 'left', pos: new THREE.Vector3(0, 0, 0), normal: new THREE.Vector3(-1, 0, 0) },
        { faceType: 'right', pos: new THREE.Vector3(length, 0, 0), normal: new THREE.Vector3(1, 0, 0) },
        { faceType: 'top', pos: new THREE.Vector3(length / 2, height / 2, 0), normal: new THREE.Vector3(0, 1, 0) },
        { faceType: 'bottom', pos: new THREE.Vector3(length / 2, -height / 2, 0), normal: new THREE.Vector3(0, -1, 0) },
        { faceType: 'front', pos: new THREE.Vector3(length / 2, 0, depth / 2), normal: new THREE.Vector3(0, 0, 1) },
        { faceType: 'back', pos: new THREE.Vector3(length / 2, 0, -depth / 2), normal: new THREE.Vector3(0, 0, -1) },
    ];

    const faces: FaceData[] = [];
    localFaces.forEach((face) => {
        const center = face.pos.clone();
        beam.localToWorld(center);
        const normal = face.normal.clone().applyQuaternion(beam.quaternion);
        faces.push({ faceType: face.faceType, center, normal });
    });
    return faces;
}

export function getFaceUnderCursor(
    beam: THREE.Mesh,
    event: MouseEvent,
    camera: THREE.Camera,
    raycaster: THREE.Raycaster
): FaceData | null {
    const pointer = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const ray = raycaster.ray;
    const faces = getBeamFaceCenters(beam);
    const { length, height, depth } = beam.userData;
    const validFaces: { face: FaceData; intersection: THREE.Vector3; distance: number }[] = [];

    faces.forEach((face) => {
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(face.normal.clone().normalize(), face.center);
        const intersection = new THREE.Vector3();
        if (ray.intersectPlane(plane, intersection)) {
            const localIntersection = intersection.clone();
            beam.worldToLocal(localIntersection);
            let inside = false;
            switch (face.faceType) {
                case 'left':
                    if (
                        Math.abs(localIntersection.x) < 0.01 &&
                        localIntersection.y >= -height / 2 &&
                        localIntersection.y <= height / 2 &&
                        localIntersection.z >= -depth / 2 &&
                        localIntersection.z <= depth / 2
                    )
                        inside = true;
                    break;
                case 'right':
                    if (
                        Math.abs(localIntersection.x - length) < 0.01 &&
                        localIntersection.y >= -height / 2 &&
                        localIntersection.y <= height / 2 &&
                        localIntersection.z >= -depth / 2 &&
                        localIntersection.z <= depth / 2
                    )
                        inside = true;
                    break;
                case 'top':
                    if (
                        Math.abs(localIntersection.y - height / 2) < 0.01 &&
                        localIntersection.x >= 0 &&
                        localIntersection.x <= length &&
                        localIntersection.z >= -depth / 2 &&
                        localIntersection.z <= depth / 2
                    )
                        inside = true;
                    break;
                case 'bottom':
                    if (
                        Math.abs(localIntersection.y + height / 2) < 0.01 &&
                        localIntersection.x >= 0 &&
                        localIntersection.x <= length &&
                        localIntersection.z >= -depth / 2 &&
                        localIntersection.z <= depth / 2
                    )
                        inside = true;
                    break;
                case 'front':
                    if (
                        Math.abs(localIntersection.z - depth / 2) < 0.01 &&
                        localIntersection.x >= 0 &&
                        localIntersection.x <= length &&
                        localIntersection.y >= -height / 2 &&
                        localIntersection.y <= height / 2
                    )
                        inside = true;
                    break;
                case 'back':
                    if (
                        Math.abs(localIntersection.z + depth / 2) < 0.01 &&
                        localIntersection.x >= 0 &&
                        localIntersection.x <= length &&
                        localIntersection.y >= -height / 2 &&
                        localIntersection.y <= height / 2
                    )
                        inside = true;
                    break;
            }
            if (inside) {
                const dist = intersection.distanceTo((camera as THREE.PerspectiveCamera).position);
                validFaces.push({ face, intersection, distance: dist });
            }
        }
    });

    if (validFaces.length > 0) {
        validFaces.sort((a, b) => a.distance - b.distance);
        return validFaces[0].face;
    }
    return null;
}

export function snapDirection(direction: THREE.Vector3): THREE.Vector3 {
    const axes = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1),
    ];
    let bestAxis = axes[0];
    let bestDot = -Infinity;
    axes.forEach((ax) => {
        const dot = direction.dot(ax);
        if (dot > bestDot) {
            bestDot = dot;
            bestAxis = ax;
        }
    });
    return bestAxis;
}
