// src/InputManager.ts
import * as THREE from 'three';
import { Beam } from './Beam';
import { BeamManager } from './BeamManager';
import { MeasurementDisplay } from './MeasurementDisplay';
import { FaceData, getBeamFaceCenters, getFaceUnderCursor, snapDirection, getGroundIntersection, getPlaneIntersection } from './Utils';
import { eventBus } from './EventBus';

export class InputManager {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private beamManager: BeamManager;
    private measurementDisplay: MeasurementDisplay;
    private raycaster: THREE.Raycaster;

    // Drag state
    private currentDraggedBeam: THREE.Mesh | null = null;
    private dragInitialBeamPos: THREE.Vector3 = new THREE.Vector3();
    private dragInitialFaceCenters: FaceData[] = [];
    private dragInitialPointer: THREE.Vector3 = new THREE.Vector3();
    private dragPlane: THREE.Plane = new THREE.Plane();

    // Drawing state
    private isDrawing: boolean = false;
    private startPoint: THREE.Vector3 = new THREE.Vector3();
    private previewLine: THREE.Line | null = null;

    // Optional: active snap face index (if you wish to cycle through snap faces)
    private activeSnapFaceIndex: number = 0;

    constructor(
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera,
        beamManager: BeamManager,
        measurementDisplay: MeasurementDisplay
    ) {
        this.scene = scene;
        this.camera = camera;
        this.beamManager = beamManager;
        this.measurementDisplay = measurementDisplay;
        this.raycaster = new THREE.Raycaster();

        window.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('keydown', this.onKeyDown);
    }

    private onPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0) return;
        const pointer = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(pointer, this.camera);

        // Check if a beam was clicked.
        const intersects = this.raycaster.intersectObjects(
            this.beamManager.getBeamsGroup().children,
            true
        );
        if (intersects.length > 0) {
            this.currentDraggedBeam = intersects[0].object as THREE.Mesh;
            this.dragInitialBeamPos.copy(this.currentDraggedBeam.position);
            // Set a drag plane parallel to the ground (y up) through the beam’s current position.
            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -this.currentDraggedBeam.position.y);
            this.dragInitialPointer.copy(getPlaneIntersection(event.clientX, event.clientY, this.camera, this.raycaster, this.dragPlane));

            // Save the initial face centers (in world space) for snapping.
            this.dragInitialFaceCenters = getBeamFaceCenters(this.currentDraggedBeam).map((face) => ({
                faceType: face.faceType,
                center: face.center.clone(),
                normal: face.normal.clone(),
            }));

            eventBus.emit('selectionChanged', [this.currentDraggedBeam]);
        } else {
            // Otherwise, start drawing a new beam.
            this.isDrawing = true;
            this.startPoint.copy(getGroundIntersection(event.clientX, event.clientY, this.camera, this.raycaster));
            const geometry = new THREE.BufferGeometry().setFromPoints([this.startPoint, this.startPoint.clone()]);
            const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
            this.previewLine = new THREE.Line(geometry, material);
            this.scene.add(this.previewLine);

            eventBus.emit('selectionChanged', []);
        }
    };

    private onPointerMove = (event: PointerEvent): void => {
        if (this.currentDraggedBeam) {
            const currentPointer = getPlaneIntersection(event.clientX, event.clientY, this.camera, this.raycaster, this.dragPlane);
            const delta = new THREE.Vector3().subVectors(currentPointer, this.dragInitialPointer);
            const freeCandidate = new THREE.Vector3().addVectors(this.dragInitialBeamPos, delta);

            // Try to find a nearby beam to snap to.
            this.beamManager.getBeamsGroup().remove(this.currentDraggedBeam);
            const pointer = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObjects(this.beamManager.getBeamsGroup().children, true);
            let targetBeam: THREE.Mesh | null = null;
            let targetIntersection: THREE.Vector3 | null = null;
            if (intersections.length > 0) {
                targetBeam = intersections[0].object as THREE.Mesh;
                targetIntersection = intersections[0].point;
            }
            this.beamManager.getBeamsGroup().add(this.currentDraggedBeam);

            let finalPos = freeCandidate.clone();
            if (targetBeam && targetIntersection) {
                const targetFace = getFaceUnderCursor(targetBeam, event, this.camera, this.raycaster);
                if (targetFace && targetFace.center) {
                    let bestCandidateFace: FaceData | null = null;
                    let bestDot = -Infinity;
                    const oppositeNormal = targetFace.normal.clone().negate();
                    for (const face of this.dragInitialFaceCenters) {
                        const dot = face.normal.dot(oppositeNormal);
                        if (dot > bestDot) {
                            bestDot = dot;
                            bestCandidateFace = face;
                        }
                    }
                    if (bestCandidateFace) {
                        const candidateDraggedFace = bestCandidateFace.center.clone().add(
                            freeCandidate.clone().sub(this.dragInitialBeamPos)
                        );
                        const d = new THREE.Vector3().subVectors(targetFace.center, candidateDraggedFace);
                        const adjustment = targetFace.normal.clone().multiplyScalar(d.dot(targetFace.normal));
                        finalPos.add(adjustment);
                    }
                }
            }
            this.currentDraggedBeam.position.copy(finalPos);
            this.currentDraggedBeam.updateMatrixWorld();
        }

        if (this.isDrawing && this.previewLine) {
            const currentPoint = getGroundIntersection(event.clientX, event.clientY, this.camera, this.raycaster);
            (this.previewLine.geometry as THREE.BufferGeometry).setFromPoints([this.startPoint, currentPoint]);
            const distance = this.startPoint.distanceTo(currentPoint);
            this.measurementDisplay.update('Current beam length: ' + distance.toFixed(2) + ' units');
        }
    };

    private onPointerUp = (event: PointerEvent): void => {
        if (this.currentDraggedBeam) {
            this.currentDraggedBeam = null;
            this.dragInitialBeamPos.set(0, 0, 0);
            this.dragInitialFaceCenters = [];
            this.dragInitialPointer.set(0, 0, 0);
            eventBus.emit('selectionChanged', []);
        }
        if (this.isDrawing && this.previewLine) {
            const endPoint = getGroundIntersection(event.clientX, event.clientY, this.camera, this.raycaster);
            const distance = this.startPoint.distanceTo(endPoint);
            if (distance > 0.1) {
                // Create a new beam with fixed height/depth and the drawn length.
                const beamHeight = 1.5;
                const beamDepth = 3.5;
                const beam = new Beam({ length: distance, height: beamHeight, depth: beamDepth });
                beam.position.copy(this.startPoint);
                const direction = new THREE.Vector3().subVectors(endPoint, this.startPoint).normalize();
                const snappedDir = snapDirection(direction);
                const quaternion = new THREE.Quaternion();
                quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), snappedDir);
                beam.quaternion.copy(quaternion);
                this.beamManager.addBeam(beam);
            }
            if (this.previewLine) {
                this.scene.remove(this.previewLine);
                (this.previewLine.geometry as THREE.BufferGeometry).dispose();
                (this.previewLine.material as THREE.Material).dispose();
                this.previewLine = null;
            }
            this.isDrawing = false;
            this.measurementDisplay.clear();
        }
    };

    private onKeyDown = (event: KeyboardEvent): void => {
        if (event.key.toLowerCase() === 'f' && this.currentDraggedBeam) {
            this.activeSnapFaceIndex = (this.activeSnapFaceIndex + 1) % 6;
            console.log('Active snap face index:', this.activeSnapFaceIndex);
        }
    };
}
