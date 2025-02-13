// src/Beam.ts
import * as THREE from 'three';

export interface BeamDimensions {
    length: number;
    height: number;
    depth: number;
}

export class Beam extends THREE.Mesh {
    public dimensions: BeamDimensions;

    private highlights: THREE.Mesh[] = [];

    constructor(dimensions: BeamDimensions, material?: THREE.Material) {
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

    public removeHighlights(type?: string) {
        for (const highlight of this.highlights) {
            if (type == null || highlight.userData.type === type)
                this.remove(highlight);
        }
    }

    public highlightFace(face: THREE.Face, color: THREE.Color, highlightType: string): string {
        // Remove any existing highlight mesh.
        const existing = this.getObjectByName('highlight' + face.a + '-' + face.b + '-' + face.c);
        if (existing) {
            this.remove(existing);
        }

        // Retrieve the vertex positions from the beam’s geometry.
        const positionAttribute = this.geometry.getAttribute('position');
        const vA = new THREE.Vector3().fromBufferAttribute(positionAttribute, face.a);
        const vB = new THREE.Vector3().fromBufferAttribute(positionAttribute, face.b);
        const vC = new THREE.Vector3().fromBufferAttribute(positionAttribute, face.c);

        // Offset the vertices slightly along the face normal to avoid z-fighting.
        const normalOffset = face.normal.clone().multiplyScalar(0.01);
        vA.add(normalOffset);
        vB.add(normalOffset);
        vC.add(normalOffset);

        // Create a geometry for the highlighted face that accurately covers the entire rectangular face.
        const dimensions = this.dimensions;
        const normal = face.normal;
        let v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3, v4: THREE.Vector3;
        if (Math.abs(normal.x) >= Math.abs(normal.y) && Math.abs(normal.x) >= Math.abs(normal.z)) {
            const sign = Math.sign(normal.x);
            v1 = new THREE.Vector3(sign * dimensions.length / 2, -dimensions.height / 2, -dimensions.depth / 2);
            v2 = new THREE.Vector3(sign * dimensions.length / 2, dimensions.height / 2, -dimensions.depth / 2);
            v3 = new THREE.Vector3(sign * dimensions.length / 2, dimensions.height / 2, dimensions.depth / 2);
            v4 = new THREE.Vector3(sign * dimensions.length / 2, -dimensions.height / 2, dimensions.depth / 2);
        } else if (Math.abs(normal.y) >= Math.abs(normal.x) && Math.abs(normal.y) >= Math.abs(normal.z)) {
            const sign = Math.sign(normal.y);
            v1 = new THREE.Vector3(-dimensions.length / 2, sign * dimensions.height / 2, -dimensions.depth / 2);
            v2 = new THREE.Vector3(dimensions.length / 2, sign * dimensions.height / 2, -dimensions.depth / 2);
            v3 = new THREE.Vector3(dimensions.length / 2, sign * dimensions.height / 2, dimensions.depth / 2);
            v4 = new THREE.Vector3(-dimensions.length / 2, sign * dimensions.height / 2, dimensions.depth / 2);
        } else {
            const sign = Math.sign(normal.z);
            v1 = new THREE.Vector3(-dimensions.length / 2, -dimensions.height / 2, sign * dimensions.depth / 2);
            v2 = new THREE.Vector3(dimensions.length / 2, -dimensions.height / 2, sign * dimensions.depth / 2);
            v3 = new THREE.Vector3(dimensions.length / 2, dimensions.height / 2, sign * dimensions.depth / 2);
            v4 = new THREE.Vector3(-dimensions.length / 2, dimensions.height / 2, sign * dimensions.depth / 2);
        }
        const highlightGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            v1.x, v1.y, v1.z,
            v2.x, v2.y, v2.z,
            v3.x, v3.y, v3.z,
            v1.x, v1.y, v1.z,
            v3.x, v3.y, v3.z,
            v4.x, v4.y, v4.z,
        ]);
        highlightGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        highlightGeometry.setIndex([0, 1, 2, 3, 4, 5]);

        // Create a basic material with the given color.
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });

        const uniqueId = crypto.randomUUID();

        // Create the highlight mesh and add it to the beam.
        const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
        highlightMesh.name = 'highlight-' + face.a + '-' + face.b + '-' + face.c;
        highlightMesh.userData = { type: highlightType, id: uniqueId };
        this.highlights.push(highlightMesh);
        this.add(highlightMesh);

        return uniqueId;
    }
}
