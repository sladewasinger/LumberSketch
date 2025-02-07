// src/index.ts
import { SceneManager } from './logic/SceneManager';
import { ControlsManager } from './logic/ControlsManager';
import { PostProcessingManager } from './logic/PostProcessingManager';
import { BeamManager } from './logic/BeamManager';
import { MeasurementDisplay } from './logic/MeasurementDisplay';
import { InputManager } from './logic/InputManager';
import { CursorProjection } from './logic/CursorProjection';

function init(): void {
    const container = document.getElementById('canvas-container');
    const measurementDiv = document.getElementById('measurement');
    if (!container || !measurementDiv) {
        console.error('Missing container or measurement element');
        return;
    }

    // Create the scene manager.
    const sceneManager = new SceneManager(container);
    // Create orbit controls.
    const controlsManager = new ControlsManager(sceneManager.camera, sceneManager.renderer.domElement);
    // Set up post-processing.
    const postProcessingManager = new PostProcessingManager(
        sceneManager.renderer,
        sceneManager.scene,
        sceneManager.camera
    );
    // Create beam manager.
    const beamManager = new BeamManager(sceneManager.scene);
    // Set up the measurement display.
    const measurementDisplay = new MeasurementDisplay(measurementDiv);
    // Set up input (drag & drawing) manager.
    new InputManager(
        sceneManager.scene,
        sceneManager.camera,
        beamManager,
        measurementDisplay
    );

    const cursorProjection = new CursorProjection(
        sceneManager.scene,
        sceneManager.camera,
        sceneManager.renderer,
        beamManager
    );

    // Animation loop
    function animate(): void {
        requestAnimationFrame(animate);
        controlsManager.update();
        postProcessingManager.render();
        cursorProjection.update();
    }
    animate();

    // Handle window resize.
    window.addEventListener('resize', () => {
        sceneManager.onWindowResize();
        postProcessingManager.onWindowResize();
    });
}

init();
