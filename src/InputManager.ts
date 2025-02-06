// src/InputManager.ts
import * as THREE from 'three';
import { Beam } from './Beam';
import { BeamManager } from './BeamManager';
import { MeasurementDisplay } from './MeasurementDisplay';
import {
    getPlaneIntersection,
    getFaceUnderCursor,
    getGroundIntersection,
    getBeamFaceCenters,
    getLocalFaceCenter
} from './Utils';
import { eventBus } from './EventBus';
import { snapDirection } from './Utils';

export class InputManager {
    // Scene objects
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private beamManager: BeamManager;
    private measurementDisplay: MeasurementDisplay;
    private raycaster: THREE.Raycaster;

    // Drag state
    private currentDraggedBeam: THREE.Mesh | null = null;
    // The default (horizontal) drag plane set at pointer down
    private defaultDragPlane: THREE.Plane = new THREE.Plane();
    // The pointer intersection on the drag plane at the start of the drag
    private dragInitialIntersection: THREE.Vector3 = new THREE.Vector3();
    // The offset from the beam’s origin to the pointer’s intersection point
    private dragOffset: THREE.Vector3 = new THREE.Vector3();

    // Drawing state (for creating new beams when not dragging an existing beam)
    private isDrawing: boolean = false;
    private drawStartPoint: THREE.Vector3 = new THREE.Vector3();
    private previewLine: THREE.Line | null = null;

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
        if (event.button !== 0) return; // Only handle left-click
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
            // Begin dragging an existing beam.
            this.currentDraggedBeam = intersects[0].object as THREE.Mesh;

            const clickedPoint = intersects[0].point.clone();

            // Set up the default (horizontal) drag plane at the beam's current Y.
            this.defaultDragPlane.set(new THREE.Vector3(0, 1, 0), -this.currentDraggedBeam.position.y);
            // Get the pointer's intersection on this default plane.
            this.dragInitialIntersection = getPlaneIntersection(
                event.clientX,
                event.clientY,
                this.camera,
                this.raycaster,
                this.defaultDragPlane
            );

            if (this.activeSnapPlane) {
                this.prevPointerPosOnPlane = getPlaneIntersection(
                    event.clientX,
                    event.clientY,
                    this.camera,
                    this.raycaster,
                    this.activeSnapPlane
                );
            }
            // Save the offset between the beam's current position and the pointer intersection.
            this.dragOffset.copy(this.currentDraggedBeam.position).sub(this.dragInitialIntersection);

            // Publish a selection event.
            eventBus.emit('selectionChanged', [this.currentDraggedBeam]);
        } else {
            // If no beam is clicked, assume the user is starting a new beam.
            this.isDrawing = true;
            this.drawStartPoint = getGroundIntersection(
                event.clientX,
                event.clientY,
                this.camera,
                this.raycaster
            );
            // Create a preview line.
            const geometry = new THREE.BufferGeometry().setFromPoints([this.drawStartPoint, this.drawStartPoint.clone()]);
            const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
            this.previewLine = new THREE.Line(geometry, material);
            this.scene.add(this.previewLine);

            // Clear any selection.
            eventBus.emit('selectionChanged', []);
        }
    };

    private prevPointerPosOnPlane: THREE.Vector3 | null = null;
    private activeSnapPlane: THREE.Plane | null = null;

    private onPointerMove = (event: PointerEvent): void => {
        if (this.currentDraggedBeam) {
            const pointer = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            this.raycaster.setFromCamera(pointer, this.camera);

            // Try to see if the pointer is hovering over another beam (exclude the dragged beam).
            const otherBeams = this.beamManager.getBeamsGroup().children.filter(
                child => child !== this.currentDraggedBeam
            );
            const intersections = this.raycaster.intersectObjects(otherBeams, true);

            let newPosition: THREE.Vector3;
            if (intersections.length > 0) {
                const hoveredBeam = intersections[0].object as THREE.Mesh;
                const hoveredFace = getFaceUnderCursor(hoveredBeam, event, this.camera, this.raycaster);

                if (hoveredFace) {
                    let activeDragPlane
                    let shouldUpdateSnapPos = true;
                    if (
                        this.activeSnapPlane &&
                        this.activeSnapPlane.normal.equals(hoveredFace.normal) &&
                        this.prevPointerPosOnPlane
                    ) {
                        activeDragPlane = this.activeSnapPlane;
                        shouldUpdateSnapPos = false;
                    } else {
                        activeDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                            hoveredFace.normal.clone(),
                            hoveredFace.center.clone()
                        );
                    }

                    // Compute the pointer intersection on the hovered face's plane.
                    const pointerIntersection = getPlaneIntersection(
                        event.clientX,
                        event.clientY,
                        this.camera,
                        this.raycaster,
                        activeDragPlane
                    );

                    // Get the dragged beam's candidate face.
                    const draggedFaces = getBeamFaceCenters(this.currentDraggedBeam);
                    let bestCandidateFace = null;
                    let bestDot = -Infinity;
                    const oppositeNormal = hoveredFace.normal.clone().negate();
                    for (let face of draggedFaces) {
                        const dot = face.normal.dot(oppositeNormal);
                        if (dot > bestDot) {
                            bestDot = dot;
                            bestCandidateFace = face;
                        }
                    }

                    if (bestCandidateFace) {
                        // Convert candidate face's local center to world space.
                        const length = this.currentDraggedBeam.userData.length as number;
                        const height = this.currentDraggedBeam.userData.height as number;
                        const depth = this.currentDraggedBeam.userData.depth as number;
                        const localCandidateCenter = getLocalFaceCenter(bestCandidateFace.faceType, length, height, depth);
                        const worldCandidateCenter = localCandidateCenter.clone().applyMatrix4(this.currentDraggedBeam.matrixWorld);

                        // Compute the offset from the dragged beam's candidate face to the pointer.
                        const snapOffset = worldCandidateCenter.sub(this.currentDraggedBeam.position);

                        // New position: pointer intersection on hovered face's plane + snap offset
                        newPosition = pointerIntersection.clone().sub(snapOffset);
                        if (!shouldUpdateSnapPos && this.prevPointerPosOnPlane) {
                            const offset = this.prevPointerPosOnPlane.clone().sub(pointerIntersection);
                            newPosition = this.currentDraggedBeam.position.clone().sub(offset);
                            console.log('using offset');
                        }
                        this.prevPointerPosOnPlane = pointerIntersection.clone();
                    } else {
                        // Default fallback if no candidate face is found.
                        newPosition = pointerIntersection.clone();
                    }

                    this.activeSnapPlane = activeDragPlane;

                } else {
                    // No valid hovered face; fall back to default horizontal drag.
                    const currentIntersection = getPlaneIntersection(
                        event.clientX,
                        event.clientY,
                        this.camera,
                        this.raycaster,
                        this.defaultDragPlane
                    );
                    newPosition = currentIntersection.clone().add(this.dragOffset);
                    this.activeSnapPlane = null;
                }
            } else {
                // No beam is hovered; revert to default horizontal drag.
                const currentIntersection = getPlaneIntersection(
                    event.clientX,
                    event.clientY,
                    this.camera,
                    this.raycaster,
                    this.defaultDragPlane
                );
                newPosition = currentIntersection.clone().add(this.dragOffset);
                this.activeSnapPlane = null;
                this.prevPointerPosOnPlane = null;
                console.log('prev pointer pos on plane reset');
            }

            // Apply the computed new position.
            this.currentDraggedBeam.position.copy(newPosition);
            this.currentDraggedBeam.updateMatrixWorld();
        }

        // If drawing a new beam...
        if (this.isDrawing && this.previewLine) {
            const currentPoint = getGroundIntersection(
                event.clientX,
                event.clientY,
                this.camera,
                this.raycaster
            );
            (this.previewLine.geometry as THREE.BufferGeometry).setFromPoints([this.drawStartPoint, currentPoint]);
            // Optionally update measurement display here.
            const distance = this.drawStartPoint.distanceTo(currentPoint);
            this.measurementDisplay.update(`Current beam length: ${distance.toFixed(2)} units`);
        }
    };

    private onPointerUp = (event: PointerEvent): void => {
        if (this.currentDraggedBeam) {
            // End dragging.
            this.currentDraggedBeam = null;
            // Clear drag state.
            this.dragOffset.set(0, 0, 0);
            this.dragInitialIntersection.set(0, 0, 0);
            // Optionally clear selection.
            eventBus.emit('selectionChanged', []);
        }
        if (this.isDrawing && this.previewLine) {
            // Finish drawing the new beam.
            const endPoint = getGroundIntersection(
                event.clientX,
                event.clientY,
                this.camera,
                this.raycaster
            );
            const distance = this.drawStartPoint.distanceTo(endPoint);
            if (distance > 0.1) {
                // Create a new beam (example uses fixed height/depth values).
                const beamHeight = 1.5;
                const beamDepth = 3.5;
                const beam = new Beam({ length: distance, height: beamHeight, depth: beamDepth });
                beam.position.copy(this.drawStartPoint);
                // Optionally snap the beam’s direction to a cardinal axis.
                const direction = new THREE.Vector3().subVectors(endPoint, this.drawStartPoint).normalize();
                const snappedDir = snapDirection(direction);
                const quaternion = new THREE.Quaternion();
                quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), snappedDir);
                beam.quaternion.copy(quaternion);
                this.beamManager.addBeam(beam);
            }
            // Clean up preview.
            this.scene.remove(this.previewLine);
            (this.previewLine.geometry as THREE.BufferGeometry).dispose();
            (this.previewLine.material as THREE.Material).dispose();
            this.previewLine = null;
            this.isDrawing = false;
            this.measurementDisplay.clear();
        }
    };

    private onKeyDown = (event: KeyboardEvent): void => {
        // Example: cycle selection with 'f'
        if (event.key.toLowerCase() === 'f' && this.currentDraggedBeam) {
            // You can update selection logic here.
            eventBus.emit('selectionChanged', [this.currentDraggedBeam]);
        }
    };
}
