// src/index.ts
import { DependencyContainer } from './nasty/DependencyContainer';

function init(): void {
    const container = document.getElementById('canvas-container');
    const measurementDiv = document.getElementById('measurement');
    if (!container || !measurementDiv) {
        console.error('Missing container or measurement element');
        return;
    }

    const dependencies = DependencyContainer.getInstance(container, measurementDiv);

    // Animation loop
    function animate(): void {
        requestAnimationFrame(animate);
        dependencies.controlsManager.update();
        dependencies.postProcessingManager.render();
    }
    animate();

    // Handle window resize.
    window.addEventListener('resize', () => {
        dependencies.sceneManager.onWindowResize();
        dependencies.postProcessingManager.onWindowResize();
    });
}

init();
