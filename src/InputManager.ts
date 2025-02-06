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

    // Ground Plane:
    private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Drag state
    private currentDraggedBeam: THREE.Mesh | null = null;
    private defaultDragPlane: THREE.Plane = new THREE.Plane();
    private dragInitialIntersection: THREE.Vector3 = new THREE.Vector3();
    private dragOffset: THREE.Vector3 = new THREE.Vector3();
    private prevPointerPosOnPlane: THREE.Vector3 | null = null;
    private activeSnapPlane: THREE.Plane | null = null;

    // Drawing state
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

        const pointer = this.getPointerVector(event);
        this.raycaster.setFromCamera(pointer, this.camera);

        // Check if a beam was clicked
        const intersects = this.raycaster.intersectObjects(this.beamManager.getBeamsGroup().children, true);
        if (intersects.length > 0) {
            this.startDraggingBeam(intersects[0].object as THREE.Mesh, event);
        } else {
            this.startDrawingBeam(event);
        }
    };

    private onPointerMove = (event: PointerEvent): void => {
        if (this.currentDraggedBeam) {
            this.updateDraggedBeamPosition(event);
        }

        if (this.isDrawing && this.previewLine) {
            this.updatePreviewLine(event);
        }
    };

    private onPointerUp = (event: PointerEvent): void => {
        if (this.currentDraggedBeam) {
            this.stopDraggingBeam();
        }
        if (this.isDrawing && this.previewLine) {
            this.finishDrawingBeam(event);
        }
    };

    private onKeyDown = (event: KeyboardEvent): void => {
        if (event.key.toLowerCase() === 'f' && this.currentDraggedBeam) {
            eventBus.emit('selectionChanged', [this.currentDraggedBeam]);
        }
    };

    /** Returns normalized pointer coordinates */
    private getPointerVector(event: PointerEvent): THREE.Vector2 {
        return new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
    }

    /** Initializes dragging when a beam is clicked */
    private startDraggingBeam(beam: THREE.Mesh, event: PointerEvent): void {
        this.currentDraggedBeam = beam;
        this.defaultDragPlane.set(new THREE.Vector3(0, 1, 0), -beam.position.y + beam.userData.height / 2);
        //this.defaultDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), beam.position.clone().add(new THREE.Vector3(0, beam.userData.height / 2, 0)));
        this.dragInitialIntersection = getPlaneIntersection(event.clientX, event.clientY, this.camera, this.raycaster, this.defaultDragPlane);
        this.dragOffset.copy(beam.position).sub(this.dragInitialIntersection);

        if (this.activeSnapPlane) {
            this.prevPointerPosOnPlane = getPlaneIntersection(event.clientX, event.clientY, this.camera, this.raycaster, this.activeSnapPlane);
        }

        eventBus.emit('selectionChanged', [beam]);
    }

    /** Updates dragged beam position based on the mouse movement */
    private updateDraggedBeamPosition(event: PointerEvent): void {
        if (!this.currentDraggedBeam) return;

        const pointer = this.getPointerVector(event);
        this.raycaster.setFromCamera(pointer, this.camera);

        const otherBeams = this.beamManager.getBeamsGroup().children.filter(child => child !== this.currentDraggedBeam);
        const intersections = this.raycaster.intersectObjects(otherBeams, true);

        let newPosition: THREE.Vector3;
        if (intersections.length > 0) {
            newPosition = this.handleSnapping(intersections[0].object as THREE.Mesh, event);
        } else {
            this.defaultDragPlane = this.groundPlane.clone();
            newPosition = this.getDefaultDragPosition(event);
        }

        this.currentDraggedBeam.position.copy(newPosition);
        this.currentDraggedBeam.updateMatrixWorld();
    }

    /** Handles snapping to another beam */
    private handleSnapping(hoveredBeam: THREE.Mesh, event: PointerEvent): THREE.Vector3 {
        if (!this.currentDraggedBeam) return hoveredBeam.position.clone();

        const hoveredFace = getFaceUnderCursor(hoveredBeam, event, this.camera, this.raycaster);
        if (!hoveredFace) return this.getDefaultDragPosition(event);

        let activeDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(hoveredFace.normal.clone(), hoveredFace.center.clone());
        let shouldUpdateSnapPos = true;

        if (this.activeSnapPlane && this.activeSnapPlane.normal.equals(hoveredFace.normal) && this.activeSnapPlane.distanceToPoint(hoveredFace.center) === 0 && this.prevPointerPosOnPlane) {
            activeDragPlane = this.activeSnapPlane;
            shouldUpdateSnapPos = false;
        }

        const pointerIntersection = getPlaneIntersection(event.clientX, event.clientY, this.camera, this.raycaster, activeDragPlane);
        const bestCandidateFace = this.getBestCandidateFace(this.currentDraggedBeam, hoveredFace.normal.clone().negate());

        if (bestCandidateFace) {
            const snapOffset = this.getSnapOffset(bestCandidateFace);
            let newPosition = pointerIntersection.clone().sub(snapOffset);

            if (!shouldUpdateSnapPos && this.prevPointerPosOnPlane) {
                const offset = this.prevPointerPosOnPlane.clone().sub(pointerIntersection);
                newPosition = this.currentDraggedBeam.position.clone().sub(offset);
            }

            this.prevPointerPosOnPlane = pointerIntersection.clone();
            this.activeSnapPlane = activeDragPlane;
            return newPosition;
        }

        this.activeSnapPlane = null;

        return pointerIntersection.clone();
    }

    /** Returns the default drag position when no snapping occurs */
    private getDefaultDragPosition(event: PointerEvent): THREE.Vector3 {
        const intersection = getPlaneIntersection(event.clientX, event.clientY, this.camera, this.raycaster, this.defaultDragPlane);
        return intersection.clone().add(this.dragOffset);
    }

    /** Determines the best face for snapping */
    private getBestCandidateFace(beam: THREE.Mesh, oppositeNormal: THREE.Vector3) {
        const faces = getBeamFaceCenters(beam);
        let bestCandidateFace = null;
        let bestDot = -Infinity;

        for (let face of faces) {
            const dot = face.normal.dot(oppositeNormal);
            if (dot > bestDot) {
                bestDot = dot;
                bestCandidateFace = face;
            }
        }

        return bestCandidateFace;
    }

    /** Computes the offset needed for snapping */
    private getSnapOffset(bestCandidateFace: any): THREE.Vector3 {
        const length = this.currentDraggedBeam!.userData.length as number;
        const height = this.currentDraggedBeam!.userData.height as number;
        const depth = this.currentDraggedBeam!.userData.depth as number;
        const localCandidateCenter = getLocalFaceCenter(bestCandidateFace.faceType, length, height, depth);
        return localCandidateCenter.clone().applyMatrix4(this.currentDraggedBeam!.matrixWorld).sub(this.currentDraggedBeam!.position);
    }

    /** Ends the dragging process */
    private stopDraggingBeam(): void {
        this.currentDraggedBeam = null;
        this.prevPointerPosOnPlane = null;
    }

    /** Starts drawing a new beam */
    private startDrawingBeam(event: PointerEvent): void {
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

    /** Updates the preview line during drawing */
    private updatePreviewLine(event: PointerEvent): void {
        if (!this.previewLine) return;

        const currentPoint = getGroundIntersection(
            event.clientX,
            event.clientY,
            this.camera,
            this.raycaster
        );
        this.previewLine.geometry.setFromPoints([this.drawStartPoint, currentPoint]);
        const distance = this.drawStartPoint.distanceTo(currentPoint);
        this.measurementDisplay.update(`Current beam length: ${distance.toFixed(2)} units`);
    }

    /** Finalizes beam creation */
    private finishDrawingBeam(event: PointerEvent): void {
        if (!this.previewLine) return;

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
            beam.position.copy(this.drawStartPoint).add(new THREE.Vector3(0, beamHeight / 2, 0));
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
}
