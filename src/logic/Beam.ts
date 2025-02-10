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

        if (!material) {
            material = new THREE.MeshLambertMaterial({ color: 0xedc487, polygonOffset: true, polygonOffsetFactor: 0.8, transparent: true }); // 0x8B4513
        }

        super(geometry, material);
        this.dimensions = dimensions;
        this.userData = { ...dimensions };

        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2, transparent: true, opacity: 0.7 });
        const outlineMesh = new THREE.LineSegments(edges, lineMaterial);
        // Disable raycasting on the outline mesh to avoid click and drag:
        outlineMesh.raycast = () => [];
        this.add(outlineMesh);
    }

    public set isSelected(value: boolean) {
        if (value) {
            this.setOpacity(0.5);
        } else {
            this.setOpacity(1);
        }
    }

    public setOpacity(value: number) {
        if (this.material instanceof THREE.MeshLambertMaterial) {
            this.material.opacity = value;
            this.material.needsUpdate = true;
        }
    }

    public getLeftBottomCorner(): THREE.Vector3 {
        return new THREE.Vector3(-this.dimensions.length / 2, -this.dimensions.height / 2, -this.dimensions.depth / 2);
    }

    public clone(): this {
        const newBeam = new Beam(this.dimensions);
        newBeam.position.copy(this.position);
        newBeam.quaternion.copy(this.quaternion);
        newBeam.scale.copy(this.scale);
        newBeam.userData = { ...this.userData };

        return newBeam as this;
    }
}
