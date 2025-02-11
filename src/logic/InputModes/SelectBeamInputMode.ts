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
        this.clearHighlights();

        if (this.appState.keysDown.has('f')) {
            this.handleFaceHighlight();
            return;
        }

        this.handleBeamMove();
    }

    private clearHighlights(): void {
        this.beamManager.getBeams().forEach(beam => beam.removeHighlights());
    }

    private handleFaceHighlight(): void {
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
    }

    /** Moves the selected beam using your original snapping logic */
    private handleBeamMove(): void {
        const beam = this.appState.selectedBeam;
        if (!beam || !this.mouse1Down || !this.prevMouseIntersection || !this.intersectionOnBeam) {
            return;
        }

        // Set up the raycaster to determine an intersection with other beams.
        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
        const otherBeams = this.beamManager.getBeams().filter(b => b !== beam);
        const intersects = rayCaster.intersectObjects(otherBeams, false);

        // Determine which face of the beam to use (to compute a Y offset).
        const candidateFace = this.getBottomFace(beam);

        // Compute a new intersection point (and Y position) using a horizontal plane.
        let intersection = new THREE.Vector3();
        let posY = beam.position.y;
        const intersectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.intersectionOnBeam.y);

        if (intersects.length > 0) {
            const y = intersects[0].point.y;
            rayCaster.ray.intersectPlane(intersectionPlane, intersection);
            intersection.setY(y);
            posY = y + candidateFace.offset;
        } else {
            rayCaster.ray.intersectPlane(intersectionPlane, intersection);
            posY = candidateFace.offset;
        }

        // Calculate the base movement delta.
        this.curMouseIntersection = intersection;
        let deltaX = this.curMouseIntersection.x - this.prevMouseIntersection.x;
        let deltaZ = this.curMouseIntersection.z - this.prevMouseIntersection.z;

        // Define snapping thresholds.
        const snapThreshold = 0.75;
        const edgeSnapThreshold = 0.75;

        if (this.intersectionOnBeam.distanceTo(this.curMouseIntersection.clone().setY(this.intersectionOnBeam.y)) < snapThreshold * 2) {
            const snap = this.performVertexSnapping(beam, snapThreshold) || this.performEdgeSnapping(beam, deltaX, deltaZ, edgeSnapThreshold);
            if (snap) {
                deltaX = snap.x;
                deltaZ = snap.z;
            }
        }

        // Apply key–modifier constraints.
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

    /**
     * Chooses the beam face (and its offset) most aligned with downward
     * so that we know how to position the beam vertically.
     */
    private getBottomFace(beam: Beam): { name: string; offset: number } {
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
        return bestFace;
    }

    /**
     * Iterates over all vertices of the beam and returns an offset vector (if any)
     * that aligns one of its vertices with a nearby vertex on another beam.
     */
    // Helper to get all world-space vertices from a mesh's geometry.
    private getWorldVertices(mesh: Beam): THREE.Vector3[] {
        mesh.updateMatrixWorld(true);
        let geo = mesh.geometry;
        // Ensure non-indexed geometry for simplicity.
        if (geo.index) {
            geo = geo.toNonIndexed();
        }
        const positions = geo.attributes.position;
        const vertices: THREE.Vector3[] = [];
        const vertex = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);
            vertex.applyMatrix4(mesh.matrixWorld);
            vertices.push(vertex.clone());
        }
        return vertices;
    }

    private performVertexSnapping(movingBeam: Beam, snapThreshold: number): THREE.Vector3 | null {
        const movingVertices = this.getWorldVertices(movingBeam);
        // Iterate over all other beams.
        for (const otherBeam of this.beamManager.getBeams()) {
            if (otherBeam === movingBeam) continue;
            const otherVertices = this.getWorldVertices(otherBeam);
            // Compare each vertex of the moving beam with each vertex from the other beam.
            for (const movingVertex of movingVertices) {
                for (const otherVertex of otherVertices) {
                    if (movingVertex.distanceTo(otherVertex) < snapThreshold) {
                        return otherVertex.clone().sub(movingVertex);
                    }
                }
            }
        }
        return null;
    }

    private performEdgeSnapping(beam: Beam, deltaX: number, deltaZ: number, edgeSnapThreshold: number): THREE.Vector3 | null {
        // Translate the beam's current bounds
        const translation = new THREE.Vector3(deltaX, 0, deltaZ);
        const currentBox = new THREE.Box3().setFromObject(beam);
        const predictedBox = currentBox.clone().translate(translation);

        // Define the axes we want to consider.
        const axes = ['x', 'z'] as const;
        const predictedEdges: Record<typeof axes[number], [number, number]> = {
            x: [predictedBox.min.x, predictedBox.max.x],
            z: [predictedBox.min.z, predictedBox.max.z],
        };

        // Store the best snapping difference for each axis (if any)
        const bestDiff: Record<typeof axes[number], number | null> = { x: null, z: null };

        // Iterate over each axis
        for (const axis of axes) {
            // Loop through all other beams
            for (const otherBeam of this.beamManager.getBeams()) {
                if (otherBeam === beam) continue;
                const otherBox = new THREE.Box3().setFromObject(otherBeam);
                const otherEdges: [number, number] = axis === 'x'
                    ? [otherBox.min.x, otherBox.max.x]
                    : [otherBox.min.z, otherBox.max.z];
                // Compare each predicted edge with the corresponding edges of the other beam
                for (const movingEdge of predictedEdges[axis]) {
                    for (const otherEdge of otherEdges) {
                        const diff = otherEdge - movingEdge;
                        if (Math.abs(diff) < edgeSnapThreshold) {
                            // Choose the smallest snap difference if several candidates exist.
                            if (bestDiff[axis] === null || Math.abs(diff) < Math.abs(bestDiff[axis]!)) {
                                bestDiff[axis] = diff;
                            }
                        }
                    }
                }
            }
        }

        // If a snap is found, adjust the movement on the snapping axis while leaving the other axis free.
        const snappedX = bestDiff.x !== null ? deltaX + bestDiff.x : deltaX;
        const snappedZ = bestDiff.z !== null ? deltaZ + bestDiff.z : deltaZ;

        // Only return a snap adjustment if any axis qualifies, otherwise let the beam move freely.
        if (bestDiff.x === null && bestDiff.z === null) {
            return null;
        }

        return new THREE.Vector3(snappedX, 0, snappedZ);
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