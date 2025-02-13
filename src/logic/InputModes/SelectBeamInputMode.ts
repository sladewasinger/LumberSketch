import { EVENT_BEAM_SELECTION_CHANGED } from "../../events/Constants";
import { eventBus } from "../../events/EventBus";
import { AppState } from "../AppState";
import { Beam } from "../Beam";
import { BeamManager } from "../BeamManager";
import { InputMode } from "./InputMode";
import * as THREE from "three";

export class AlignToolState {
    beam1: Beam | null = null;
    beam2: Beam | null = null;
    beam1Face: THREE.Face | null = null;
    beam2Face: THREE.Face | null = null;
    highlightId1: string | null = null;
    highlightId2: string | null = null;
}

export class SelectBeamInputMode extends InputMode {
    appState: AppState;
    mouse1Down = false;
    intersectionOnBeam: THREE.Vector3 | null = null;
    mousePositionRelativeToBeam: THREE.Vector3 | null = null;
    prevMouseIntersection: THREE.Vector3 | null = null;
    curMouseIntersection: THREE.Vector3 | null = null;
    orientation: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
    hoveredBeam: Beam | null = null;
    hoveredBeamFace: THREE.Face | null = null;
    lastSnapPosition: THREE.Vector3 | null = null;
    alignToolState: AlignToolState = new AlignToolState();

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

        if (this.appState.keysDown.has('a')) {
            const rayCaster = new THREE.Raycaster();
            rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
            const intersects = rayCaster.intersectObjects(this.beamManager.getBeams(), false);

            if (intersects.length > 0) {
                const beam = intersects[0].object as Beam;
                const face = intersects[0].face;

                if (!face) return;

                if (!this.alignToolState.highlightId1) {
                    this.alignToolState.beam1 = beam;
                    this.alignToolState.beam1Face = face;
                    this.alignToolState.highlightId1 = this.handleFaceHighlight(new THREE.Color(0x0000ff), 'align-face-highlight-1');
                } else if (!this.alignToolState.highlightId2 && beam !== this.alignToolState.beam1) {
                    this.alignToolState.beam2 = beam;
                    this.alignToolState.beam2Face = face;
                    this.alignToolState.highlightId2 = this.handleFaceHighlight(new THREE.Color(0x0044ff), 'align-face-highlight-2');
                }

                if (this.alignToolState.beam1 && this.alignToolState.beam2) {
                    // Align the two faces.
                    const beam1 = this.alignToolState.beam1;
                    const beam2 = this.alignToolState.beam2;
                    const face1 = this.alignToolState.beam1Face;
                    const face2 = this.alignToolState.beam2Face;

                    if (!beam1 || !beam2 || !face1 || !face2) {
                        return;
                    }

                    function computeFaceCentroid(beam: any, face: any): THREE.Vector3 {
                        const centroid = new THREE.Vector3();
                        const geometry = beam.geometry;
                        if (geometry.isBufferGeometry) {
                            const posAttr = geometry.attributes.position;
                            const vA = new THREE.Vector3().fromBufferAttribute(posAttr, face.a);
                            const vB = new THREE.Vector3().fromBufferAttribute(posAttr, face.b);
                            const vC = new THREE.Vector3().fromBufferAttribute(posAttr, face.c);
                            centroid.add(vA).add(vB).add(vC).divideScalar(3);
                        } else {
                            centroid.add(geometry.vertices[face.a])
                                .add(geometry.vertices[face.b])
                                .add(geometry.vertices[face.c])
                                .divideScalar(3);
                        }
                        beam.localToWorld(centroid);
                        return centroid;
                    }

                    const centroid1 = computeFaceCentroid(beam1, face1);
                    const centroid2 = computeFaceCentroid(beam2, face2);

                    // Compute beam2's face world normal.
                    const face2Normal = face2.normal.clone().applyQuaternion(beam2.quaternion).normalize();

                    // Create a plane from beam2's face.
                    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(face2Normal, centroid2);

                    // Calculate how far beam1's face centroid is from the plane.
                    const distance = plane.distanceToPoint(centroid1);

                    // Project centroid1 onto the plane.
                    const projectedPoint = centroid1.clone().add(face2Normal.multiplyScalar(-distance));

                    // Offset beam1 so that its face centroid coincides with the projected point.
                    const offset = projectedPoint.sub(centroid1);
                    beam1.position.add(offset);

                    this.alignToolState.beam1.removeHighlights('align-face-highlight-1');
                    this.alignToolState.beam2.removeHighlights('align-face-highlight-2');
                    this.alignToolState = new AlignToolState();
                }
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
            this.mousePositionRelativeToBeam = intersection.clone().sub(beam.position);
            this.curMouseIntersection = intersection.clone();
            this.prevMouseIntersection = this.curMouseIntersection.clone();
        } else {
            this.appState.selectedBeam = null;
            this.prevMouseIntersection = null;
            this.mousePositionRelativeToBeam = null;
            this.intersectionOnBeam = null;
        }

        eventBus.emit(EVENT_BEAM_SELECTION_CHANGED);
    }

    onMouseMove(event: MouseEvent): void {
        this.clearHighlights('temp-highlight');

        if (this.appState.keysDown.has('f')) {
            this.handleFaceHighlight(new THREE.Color(0x00ff00), 'temp-highlight');
            return;
        }

        if (this.appState.keysDown.has('a')) {
            this.handleFaceHighlight(new THREE.Color(0x0000ff), 'temp-highlight');
            return;
        }

        this.handleBeamMove();
    }

    private clearHighlights(type?: string): void {
        this.beamManager.getBeams().forEach(beam => beam.removeHighlights(type));
    }

    private handleFaceHighlight(color: THREE.Color, highlightType: string): string | null {
        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
        const intersects = rayCaster.intersectObjects(this.beamManager.getBeams(), false);

        if (intersects.length > 0 && intersects[0].face) {
            const beam = intersects[0].object as Beam;
            const id = beam.highlightFace(intersects[0].face, color, highlightType);
            this.hoveredBeam = beam;
            this.hoveredBeamFace = intersects[0].face;
            return id;
        }

        this.hoveredBeam = null;
        this.hoveredBeamFace = null;
        return null;
    }

    /** Moves the selected beam using your original snapping logic */
    private handleBeamMove(): void {
        const beam = this.appState.selectedBeam;
        if (!beam || !this.mouse1Down || !this.prevMouseIntersection || !this.intersectionOnBeam || !this.mousePositionRelativeToBeam) {
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
        let intersectionPos = new THREE.Vector3();
        let posY = beam.position.y;
        const intersectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.intersectionOnBeam.y);
        let hoveredBeam: Beam | null = null;
        if (intersects.length > 0) {
            hoveredBeam = intersects[0].object as Beam;
            const y = intersects[0].point.y;
            rayCaster.ray.intersectPlane(intersectionPlane, intersectionPos);
            intersectionPos.setY(y);
            posY = y + candidateFace.offset;
        } else {
            rayCaster.ray.intersectPlane(intersectionPlane, intersectionPos);
            posY = candidateFace.offset;
        }

        // Calculate the base movement delta.
        this.curMouseIntersection = intersectionPos;
        // let deltaX = this.curMouseIntersection.x - this.prevMouseIntersection.x;
        // let deltaZ = this.curMouseIntersection.z - this.prevMouseIntersection.z;
        let posX = this.curMouseIntersection.x - this.mousePositionRelativeToBeam.x;
        let posZ = this.curMouseIntersection.z - this.mousePositionRelativeToBeam.z;

        // Define snapping thresholds.
        const snapThreshold = 0.75;
        const edgeSnapThreshold = 0.75;

        const mouseBeamPos = this.mousePositionRelativeToBeam.clone().add(beam.position);

        if (hoveredBeam && !this.lastSnapPosition) {
            const snapVertexPos = this.snapToHoveredBeamVertices(beam, hoveredBeam, mouseBeamPos, snapThreshold);
            if (snapVertexPos) {
                posX = snapVertexPos.x;
                posZ = snapVertexPos.z;
                posY = snapVertexPos.y;
                if (snapVertexPos.distanceTo(beam.position) < 0.01) {
                    // must be snapped by now:
                    this.lastSnapPosition = snapVertexPos;
                    //this.mousePositionRelativeToBeam.add(snapVertexPos.clone().sub(beam.position));
                    console.log('setting LAST SNAP POS')
                    if (Math.abs(beam.position.y - posY) > 0.01) {
                        this.intersectionOnBeam.setY(posY + (this.intersectionOnBeam.y - beam.position.y));
                    }
                }
                console.log('SNAPPING', posX, posY, posZ);
            }
        }

        // Apply key–modifier constraints.
        if (this.appState.keysDown.has('z')) {
            posX = 0;
            posY = beam.position.y;
        }
        if (this.appState.keysDown.has('x')) {
            posZ = 0;
            posY = beam.position.y;
        }


        // ****************
        // TODO: Combine these two if statements - refactor:
        if (!this.lastSnapPosition) {
            if (Math.abs(beam.position.y - posY) > 0.01) {
                this.intersectionOnBeam.setY(posY + (this.intersectionOnBeam.y - beam.position.y));
            }

            beam.position.setY(posY);
            beam.position.setX(posX);
            beam.position.setZ(posZ);
        }

        if (this.lastSnapPosition && beam.position.distanceTo(new THREE.Vector3(posX, posY, posZ)) > snapThreshold * 2) {
            if (Math.abs(beam.position.y - posY) > 0.01) {
                this.intersectionOnBeam.setY(posY + (this.intersectionOnBeam.y - beam.position.y));
            }
            this.lastSnapPosition = null;
            beam.position.setY(posY);
            beam.position.setX(posX);
            beam.position.setZ(posZ);
            console.log('REMOVE SNAP', posX, posY, posZ);
        }
        // ****************

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

    private snapToHoveredBeamVertices(beam: Beam, hoveredBeam: Beam, mousePosOnBeam: THREE.Vector3, snapThreshold: number = 0.75, distanceFromMouseSnapThreshold: number = 5): THREE.Vector3 | null {
        const beamVertices = this.getWorldVertices(beam).filter(v => v.distanceTo(mousePosOnBeam) < distanceFromMouseSnapThreshold);
        const hoveredVertices = this.getWorldVertices(hoveredBeam).filter(v => v.distanceTo(mousePosOnBeam) < distanceFromMouseSnapThreshold);

        if (beamVertices.length === 0 || hoveredVertices.length === 0) return null;

        const closestMovingVertex = beamVertices
            .reduce((prev, curr) => prev.distanceTo(mousePosOnBeam) < curr.distanceTo(mousePosOnBeam) ? prev : curr);

        const closestSnappedVertex = hoveredVertices
            .reduce((prev, curr) => prev.distanceTo(closestMovingVertex) < curr.distanceTo(closestMovingVertex) ? prev : curr);

        if (closestMovingVertex.distanceTo(closestSnappedVertex) < snapThreshold) {
            let delta = closestSnappedVertex.clone().sub(closestMovingVertex);
            let beamVertexOffset = closestMovingVertex.clone().sub(beam.position);
            return beam.position.clone().add(delta);
        }

        return null;
    }

    // private performVertexSnapping(movingBeam: Beam, snapThreshold: number): THREE.Vector3 | null {
    //     const movingVertices = this.getWorldVertices(movingBeam);
    //     // Iterate over all other beams.
    //     for (const otherBeam of this.beamManager.getBeams()) {
    //         if (otherBeam === movingBeam) continue;
    //         const otherVertices = this.getWorldVertices(otherBeam);
    //         // Compare each vertex of the moving beam with each vertex from the other beam.
    //         for (const movingVertex of movingVertices) {
    //             for (const otherVertex of otherVertices) {
    //                 if (movingVertex.distanceTo(otherVertex) < snapThreshold) {
    //                     return otherVertex.clone().sub(movingVertex);
    //                 }
    //             }
    //         }
    //     }
    //     return null;
    // }

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