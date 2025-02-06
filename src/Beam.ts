// src/Beam.ts
import * as THREE from 'three';

export interface BeamDimensions {
    length: number;
    height: number;
    depth: number;
}

export class Beam extends THREE.Mesh {
    public dimensions: BeamDimensions;

    constructor(dimensions: BeamDimensions, material?: THREE.Material) {
        // Create box geometry so that the beam’s local origin is at its left edge.
        const geometry = new THREE.BoxGeometry(
            dimensions.length,
            dimensions.height,
            dimensions.depth
        );
        geometry.translate(dimensions.length / 2, 0, 0);

        if (!material) {
            material = new THREE.MeshLambertMaterial({ color: 0xedc487, polygonOffset: true, polygonOffsetFactor: 0.8 }); // 0x8B4513
        }
        super(geometry, material);

        this.dimensions = dimensions;
        // Also store the dimensions in userData (used later by some utilities)
        this.userData = { ...dimensions };

        // Add an outline mesh to show edges.
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3 });
        const outlineMesh = new THREE.LineSegments(edges, lineMaterial);
        // Disable raycasting on the outline mesh.
        outlineMesh.raycast = () => [];
        this.add(outlineMesh);
    }
}
