import { EVENT_BEAM_SELECTION_CHANGED } from "../../events/Constants";
import { eventBus } from "../../events/EventBus";
import { AppState } from "../AppState";
import { Beam } from "../Beam";
import { BeamManager } from "../BeamManager";
import { InputMode } from "./InputMode";
import * as THREE from "three";

export class SelectBeamInputMode extends InputMode {
    appState: AppState;
    mouse1Down = false;
    intersectionOnBeam: THREE.Vector3 | null = null;
    prevMouseIntersection: THREE.Vector3 | null = null;
    curMouseIntersection: THREE.Vector3 | null = null;
    orientation: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
    hoveredBeam: Beam | null = null;
    hoveredBeamFace: THREE.Face | null = null;
    snapInitialMousePos: THREE.Vector2 | null = null;

    constructor(private beamManager: BeamManager) {
        super();
        this.appState = AppState.getInstance();
        document.body.style.cursor = 'pointer';
    }

    onMouseDown(event: MouseEvent): void {
        if (event.button !== 0) return;
        this.mouse1Down = true;

        if (this.appState.keysDown.has('f')) {
            if (this.hoveredBeam && this.hoveredBeamFace) {
                const down = new THREE.Vector3(0, -1, 0);
                const faceNormalWorld = this.hoveredBeamFace.normal.clone().applyQuaternion(this.hoveredBeam.quaternion);
                const adjustmentQuat = new THREE.Quaternion().setFromUnitVectors(faceNormalWorld, down);
                this.hoveredBeam.quaternion.premultiply(adjustmentQuat);
                this.appState.selectedBeam = this.hoveredBeam;
            }
            return;
        }

        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
        const intersects = rayCaster.intersectObjects(this.beamManager.getBeams(), false);

        let intersection = new THREE.Vector3();
        if (intersects.length > 0) {
            const beam = intersects[0].object as Beam;
            intersection = intersects[0].point;

            this.appState.selectedBeam = beam;
            this.intersectionOnBeam = intersection.clone();
            this.curMouseIntersection = intersection;
            this.prevMouseIntersection = this.curMouseIntersection.clone();
        } else {
            this.appState.selectedBeam = null;
            this.prevMouseIntersection = null;
            this.intersectionOnBeam = null;
        }

        eventBus.emit(EVENT_BEAM_SELECTION_CHANGED);
    }

    onMouseMove(event: MouseEvent): void {
        this.beamManager.getBeams().forEach(x => x.removeHighlights());

        if (this.appState.keysDown.has('f')) {
            const rayCaster = new THREE.Raycaster();
            rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
            const intersects = rayCaster.intersectObjects(this.beamManager.getBeams(), false);

            if (intersects.length > 0 && intersects[0].face) {
                const beam = intersects[0].object as Beam;
                beam.highlightFace(intersects[0].face, new THREE.Color(0x00ff00));
                this.hoveredBeam = beam;
                this.hoveredBeamFace = intersects[0].face;
            } else {
                this.hoveredBeam = null;
                this.hoveredBeamFace = null;
            }

            return;
        }

        const beam = this.appState.selectedBeam;
        if (!beam || !this.mouse1Down || !this.prevMouseIntersection || !this.intersectionOnBeam) return;

        console.log('here');

        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
        const intersects = rayCaster.intersectObjects(this.beamManager.getBeams().filter(x => x != beam), false);

        let intersection = new THREE.Vector3();
        let posY = beam.position.y;
        const down = new THREE.Vector3(0, -1, 0);
        const candidateFaces = [
            { name: 'left', vec: new THREE.Vector3(-1, 0, 0), offset: beam.dimensions.length / 2 },
            { name: 'right', vec: new THREE.Vector3(1, 0, 0), offset: beam.dimensions.length / 2 },
            { name: 'front', vec: new THREE.Vector3(0, 0, 1), offset: beam.dimensions.depth / 2 },
            { name: 'back', vec: new THREE.Vector3(0, 0, -1), offset: beam.dimensions.depth / 2 },
            { name: 'bottom', vec: new THREE.Vector3(0, -1, 0), offset: beam.dimensions.height / 2 },
            { name: 'top', vec: new THREE.Vector3(0, 1, 0), offset: beam.dimensions.height / 2 }
        ];
        let bestFace = candidateFaces[0];
        let bestDot = -Infinity;
        for (const face of candidateFaces) {
            const worldNormal = face.vec.clone().applyQuaternion(beam.quaternion).normalize();
            const dot = worldNormal.dot(down);
            if (dot > bestDot) {
                bestDot = dot;
                bestFace = face;
            }
        }
        if (intersects.length > 0) {
            let y = intersects[0].point.y;
            const originalIntersectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.intersectionOnBeam.y);
            rayCaster.ray.intersectPlane(originalIntersectionPlane, intersection)!;
            intersection.setY(y);
            posY = y + bestFace.offset;
        } else {
            const originalIntersectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.intersectionOnBeam.y);
            rayCaster.ray.intersectPlane(originalIntersectionPlane, intersection)!;
            posY = bestFace.offset;
        }

        this.curMouseIntersection = intersection;
        let deltaX = this.curMouseIntersection.x - this.prevMouseIntersection.x;
        let deltaZ = this.curMouseIntersection.z - this.prevMouseIntersection.z;

        const snapThreshold = 0.4;
        let foundSnap = false;
        const movingBeam = beam;
        movingBeam.updateMatrixWorld();

        // Get moving beam vertices in world coordinates (assumes BufferGeometry)
        const movingGeometry = movingBeam.geometry as THREE.BufferGeometry;
        const mvAttr = movingGeometry.attributes.position;
        let snapAdjustment = new THREE.Vector3();

        if (this.intersectionOnBeam.distanceTo(this.curMouseIntersection.clone().setY(this.intersectionOnBeam.y)) > snapThreshold * 2) {
            foundSnap = true;
            snapAdjustment.set(deltaX, 0, deltaZ);
        }

        for (let i = 0; i < mvAttr.count && !foundSnap; i++) {
            const movingVertex = new THREE.Vector3().fromBufferAttribute(mvAttr, i);
            movingBeam.localToWorld(movingVertex);

            for (const otherBeam of this.beamManager.getBeams()) {
                if (otherBeam === movingBeam) continue;
                otherBeam.updateMatrixWorld();
                const otherGeometry = otherBeam.geometry as THREE.BufferGeometry;
                const ovAttr = otherGeometry.attributes.position;

                for (let j = 0; j < ovAttr.count; j++) {
                    const otherVertex = new THREE.Vector3().fromBufferAttribute(ovAttr, j);
                    otherBeam.localToWorld(otherVertex);
                    if (movingVertex.distanceTo(otherVertex) < snapThreshold) {
                        snapAdjustment.copy(otherVertex).sub(movingVertex);
                        foundSnap = true;
                        break;
                    }
                }
                if (foundSnap) break;
            }
        }
        if (foundSnap) {
            deltaX = snapAdjustment.x;
            deltaZ = snapAdjustment.z;
        }

        if (this.appState.keysDown.has('z')) {
            deltaX = 0;
            posY = beam.position.y;
        }
        if (this.appState.keysDown.has('x')) {
            deltaZ = 0;
            posY = beam.position.y;
        }

        if (Math.abs(beam.position.y - posY) > 0.01) {
            this.intersectionOnBeam.setY(posY + (this.intersectionOnBeam.y - beam.position.y));
        }
        beam.position.setY(posY);
        beam.position.add(new THREE.Vector3(deltaX, 0, deltaZ));
        this.prevMouseIntersection = this.curMouseIntersection.clone();
    }

    onMouseUp(event: MouseEvent): void {
        if (event.button !== 0) return;
        this.mouse1Down = false;
    }

    onKeyDown(event: KeyboardEvent): void {
        const key = event.key.toLowerCase();
        if (key === 'delete' || key === 'd') {
            if (this.appState.selectedBeam) {
                this.beamManager.deleteBeam(this.appState.selectedBeam);
            }
        }

        if (key === 'r') {
            const beam = this.appState.selectedBeam;
            if (beam) {
                if (this.orientation.x === 1) {
                    this.orientation = new THREE.Vector3(0, 0, 1);
                } else if (this.orientation.z === 1) {
                    this.orientation = new THREE.Vector3(1, 0, 0);
                }
                this.setBeamOrientation();
            }
        }
    }

    setBeamOrientation() {
        if (!this.appState.selectedBeam) return;

        const beam = this.appState.selectedBeam;
        const down = new THREE.Vector3(0, -1, 0);

        // Define candidate local face normals.
        const candidateFaces = [
            { name: 'left', vec: new THREE.Vector3(-1, 0, 0) },
            { name: 'right', vec: new THREE.Vector3(1, 0, 0) },
            { name: 'front', vec: new THREE.Vector3(0, 0, 1) },
            { name: 'back', vec: new THREE.Vector3(0, 0, -1) },
            { name: 'bottom', vec: new THREE.Vector3(0, -1, 0) },
            { name: 'top', vec: new THREE.Vector3(0, 1, 0) }
        ];

        // Find the face whose world normal is most aligned with 'down'
        let bestFace: { name: string; worldNormal: THREE.Vector3 } | null = null;
        let bestDot = -Infinity;
        for (const face of candidateFaces) {
            const worldNormal = face.vec.clone().applyQuaternion(beam.quaternion).normalize();
            const dot = worldNormal.dot(down);
            if (dot > bestDot) {
                bestDot = dot;
                bestFace = { name: face.name, worldNormal };
            }
        }

        // Rotate around an axis that keeps the downward face fixed.
        let axis: THREE.Vector3;
        const angle = Math.PI / 2;
        // If the selected face is nearly collinear with down (i.e. bottom or top), use the world up.
        if (Math.abs(bestFace!.worldNormal.dot(down)) > 0.95) {
            axis = new THREE.Vector3(0, 1, 0);
        } else {
            // Otherwise, compute an axis perpendicular to both the face normal and down.
            axis = bestFace!.worldNormal.clone().cross(down).normalize();
        }
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        beam.quaternion.copy(rotQuat.multiply(beam.quaternion.clone()));
    }

    destroy(): void {
        document.body.style.cursor = 'default';
    }
}