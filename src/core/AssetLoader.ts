import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Single shared GLTFLoader for the whole application.
 * Using one instance ensures the internal parse cache is shared, so the same
 * GLB is never decoded twice (critical when multiple entities load the same
 * model, e.g. 30 Visitors all loading kid1.glb).
 * DRACOLoader is attached so Draco-compressed GLBs are decoded automatically.
 *
 * gameLoadingManager tracks every GLTF load so the game can fire an
 * "assetsLoaded" event when the initial scene + building models are ready.
 */
export const gameLoadingManager = new THREE.LoadingManager();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
dracoLoader.preload();

export const sharedGLTFLoader = new GLTFLoader(gameLoadingManager);
sharedGLTFLoader.setDRACOLoader(dracoLoader);

export const sharedTextureLoader = new THREE.TextureLoader(gameLoadingManager);
export const sharedAudioLoader = new THREE.AudioLoader(gameLoadingManager);
