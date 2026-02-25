/**
 * Image Upload Component
 * Fallback mode for devices without WebGPU support
 * Allows users to upload images for one-off captioning
 */

import { createElement } from '../utils/dom-helpers.js';
import { createGlassContainer } from './glass-container.js';
import { createGlassButton } from './glass-button.js';
import logger from '../utils/logger.js';

/**
 * Creates an image upload component for static image captioning
 * @param {Function} onImageSelected - Callback when image is selected (receives File)
 * @returns {HTMLElement}
 */
export function createImageUpload(onImageSelected) {
    logger.info('Creating image upload component (fallback mode)');

    const container = createGlassContainer({
        className: 'max-w-2xl mx-auto mt-20 p-8'
    });

    // Header
    const header = createElement('div', {
        className: 'text-center mb-8'
    });

    const title = createElement('h2', {
        className: 'text-2xl font-light mb-2',
        textContent: '📸 Upload Image'
    });

    const subtitle = createElement('p', {
        className: 'text-sm opacity-60',
        textContent: 'WebGPU not available - using image upload mode'
    });

    header.appendChild(title);
    header.appendChild(subtitle);

    // Upload zone
    const uploadZone = createElement('div', {
        className: 'relative border-2 border-dashed border-white/30 rounded-2xl p-12 text-center hover:border-white/50 transition-colors cursor-pointer bg-white/5'
    });

    const uploadIcon = createElement('div', {
        className: 'text-6xl mb-4',
        textContent: '🖼️'
    });

    const uploadText = createElement('p', {
        className: 'text-lg mb-2',
        textContent: 'Click to select an image'
    });

    const uploadHint = createElement('p', {
        className: 'text-sm opacity-60',
        textContent: 'or drag and drop'
    });

    const supportedFormats = createElement('p', {
        className: 'text-xs opacity-40 mt-4',
        textContent: 'Supported: JPG, PNG, WebP, GIF'
    });

    uploadZone.appendChild(uploadIcon);
    uploadZone.appendChild(uploadText);
    uploadZone.appendChild(uploadHint);
    uploadZone.appendChild(supportedFormats);

    // Hidden file input
    const fileInput = createElement('input', {
        type: 'file',
        accept: 'image/*',
        className: 'hidden'
    });

    // Preview area (hidden initially)
    const previewContainer = createElement('div', {
        className: 'mt-6 hidden'
    });

    const previewImage = createElement('img', {
        className: 'w-full rounded-xl max-h-96 object-contain bg-black/20'
    });

    const previewButtons = createElement('div', {
        className: 'flex gap-4 mt-4 justify-center'
    });

    const analyzeButton = createGlassButton({
        text: '🔍 Analyze Image',
        className: 'px-6 py-3'
    });

    const changeButton = createGlassButton({
        text: '↻ Change Image',
        className: 'px-6 py-3 opacity-60'
    });

    previewButtons.appendChild(analyzeButton);
    previewButtons.appendChild(changeButton);
    previewContainer.appendChild(previewImage);
    previewContainer.appendChild(previewButtons);

    // File handling
    let selectedFile = null;

    function handleFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) {
            logger.warn('Invalid file type selected', { type: file?.type });
            return;
        }

        selectedFile = file;
        logger.info('Image selected', { 
            name: file.name, 
            size: file.size, 
            type: file.type 
        });

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            uploadZone.classList.add('hidden');
            previewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    });

    // Click to upload
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('border-white/70', 'bg-white/10');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('border-white/70', 'bg-white/10');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-white/70', 'bg-white/10');
        
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    });

    // Analyze button
    analyzeButton.addEventListener('click', () => {
        if (selectedFile) {
            logger.info('Analyzing image', { file: selectedFile.name });
            onImageSelected?.(selectedFile);
        }
    });

    // Change button
    changeButton.addEventListener('click', () => {
        selectedFile = null;
        previewImage.src = '';
        uploadZone.classList.remove('hidden');
        previewContainer.classList.add('hidden');
        fileInput.value = '';
    });

    // Assembly
    container.appendChild(header);
    container.appendChild(uploadZone);
    container.appendChild(fileInput);
    container.appendChild(previewContainer);

    return container;
}

/**
 * Process uploaded image file to canvas for model inference
 * @param {File} file - Image file
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function fileToCanvas(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size (maintain aspect ratio, max 640px)
            const maxSize = 640;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = (height / width) * maxSize;
                    width = maxSize;
                } else {
                    width = (width / height) * maxSize;
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            
            logger.debug('Image converted to canvas', { 
                originalSize: `${img.width}x${img.height}`, 
                canvasSize: `${width}x${height}` 
            });
            
            resolve(canvas);
        };
        
        img.onerror = () => {
            logger.error('Failed to load image', { file: file.name });
            reject(new Error('Failed to load image'));
        };
        
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
    });
}
