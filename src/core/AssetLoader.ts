import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Single shared GLTFLoader for the whole application.
 * Using one instance ensures the internal parse cache is shared, so the same
 * GLB is never decoded twice (critical when multiple entities load the same
 * model, e.g. 30 Visitors all loading kid1.glb).
 * DRACOLoader is attached so Draco-compressed GLBs are decoded automatically.
 */
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
dracoLoader.preload();

export const sharedGLTFLoader = new GLTFLoader();
sharedGLTFLoader.setDRACOLoader(dracoLoader);
