import * as THREE from 'three';
import { Beam } from './Beam/Beam';
import { getGroundIntersection, roundToNearest3D } from './Utils';
import { BeamManager } from './Beam/BeamManager';
import { AppState } from './AppState';

export class CursorProjection {
    private appState: AppState;

    public raycaster: THREE.Raycaster;
    public mouse: THREE.Vector2;
    public rectangle: THREE.Line;

    constructor(
        public renderer: THREE.WebGLRenderer,
        public beamManager: BeamManager
    ) {
        this.appState = AppState.getInstance();
        const scene = this.appState.scene;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        const rectWidth = 3.5;
        const rectHeight = 1.5

        // Define rectangle in local space, initially aligned to the XY plane
        const rectPoints = [
            new THREE.Vector3(-rectWidth / 2, -rectHeight / 2, 0),  // Bottom-left
            new THREE.Vector3(rectWidth / 2, -rectHeight / 2, 0),   // Bottom-right
            new THREE.Vector3(rectWidth / 2, rectHeight / 2, 0),    // Top-right
            new THREE.Vector3(-rectWidth / 2, rectHeight / 2, 0),   // Top-left
            new THREE.Vector3(-rectWidth / 2, -rectHeight / 2, 0)   // Closing the rectangle
        ];

        const rectGeometry = new THREE.BufferGeometry().setFromPoints(rectPoints);
        const rectMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 4 });
        this.rectangle = new THREE.Line(rectGeometry, rectMaterial);
        //this.rectangle.visible = false; // Initially hidden
        scene.add(this.rectangle);

        window.addEventListener('mousemove', this.onMouseMove.bind(this));
    }

    getMouseIntersectionAndPlaneNormal(): [THREE.Vector3, THREE.Vector3] {
        this.raycaster.setFromCamera(this.mouse, this.appState.camera);

        const intersects = this.raycaster.intersectObjects(this.beamManager.getBeams(), false);

        if (intersects.length > 0) {
            const beam = intersects[0].object as Beam;
            if (beam) {
                const localNormal = intersects[0].face!.normal.clone();
                const worldNormal = localNormal.transformDirection(beam.matrixWorld).normalize();
                return [intersects[0].point, worldNormal];
            }
        }

        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3(0, 0, 0);
        this.raycaster.ray.intersectPlane(groundPlane, intersection);
        return [intersection, groundPlane.normal];
    }

    draw() {
        const [point, normal] = this.getMouseIntersectionAndPlaneNormal();

        // Create quaternion rotation (compute first)
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

        // Get the first point in local space
        const positions = this.rectangle.geometry.attributes.position.array;
        const firstPoint = new THREE.Vector3(positions[0], positions[1], positions[2]);

        // Snap the first point (still in local space)
        const snappedFirstPoint = roundToNearest3D(firstPoint, 0.5);

        // Compute local offset
        const offset = snappedFirstPoint.sub(firstPoint);

        // **Rotate the offset to world space BEFORE applying it**
        offset.applyQuaternion(quaternion);

        // Snap the mouse position
        const snappedPoint = roundToNearest3D(point, 0.5);

        // Apply transformations in the correct order:
        this.rectangle.position.copy(snappedPoint);  // Move rectangle
        this.rectangle.position.add(offset);         // Adjust by rotated offset
        this.rectangle.setRotationFromQuaternion(quaternion);  // Finally, rotate

    }

    private onMouseMove(event: MouseEvent): void {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.draw();
    }

    snapToGrid(position: THREE.Vector3, gridSize: number, normal: THREE.Vector3): THREE.Vector3 {
        const snappedPosition = position.clone(); // Clone to avoid modifying original

        // Create basis vectors aligned with the face normal
        let right = new THREE.Vector3();
        let up = new THREE.Vector3();
        let forward = normal.clone(); // The normal is the "forward" direction

        // Choose an appropriate axis-aligned "right" and "up" based on the normal
        if (Math.abs(normal.y) === 1) {
            // If the normal is pointing up/down, align with X/Z grid
            right.set(1, 0, 0);
            up.set(0, 0, 1);
        } else {
            // Default to Y-up alignment for vertical surfaces
            right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
            up.crossVectors(forward, right).normalize();
        }

        // **Project the position onto the aligned axes and snap each axis independently**
        snappedPosition.x = Math.round(position.dot(right) / gridSize) * gridSize * right.x +
            Math.round(position.dot(up) / gridSize) * gridSize * up.x +
            Math.round(position.dot(forward) / gridSize) * gridSize * forward.x;

        snappedPosition.y = Math.round(position.dot(right) / gridSize) * gridSize * right.y +
            Math.round(position.dot(up) / gridSize) * gridSize * up.y +
            Math.round(position.dot(forward) / gridSize) * gridSize * forward.y;

        snappedPosition.z = Math.round(position.dot(right) / gridSize) * gridSize * right.z +
            Math.round(position.dot(up) / gridSize) * gridSize * up.z +
            Math.round(position.dot(forward) / gridSize) * gridSize * forward.z;

        return snappedPosition;
    }
}