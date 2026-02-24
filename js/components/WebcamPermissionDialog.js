/**
 * Webcam Permission Dialog Component - Apple/WWDC Premium Style
 */

import { createElement } from '../utils/dom-helpers.js';
import { requestWebcamPermission } from '../services/webcam-service.js';
import { GLASS_EFFECTS } from '../utils/constants.js';

export function createWebcamPermissionDialog(onPermissionGranted) {
    const wrapper = createElement('div', {
        className: 'webcam-permission-wrapper'
    });

    // Create loading state
    const content = createElement('div', {
        className: 'webcam-permission-content'
    });

    // Camera Icon (SVG minimal)
    const iconContainer = createElement('div', {
        className: 'webcam-permission-icon'
    });

    const cameraIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cameraIcon.setAttribute('width', '64');
    cameraIcon.setAttribute('height', '64');
    cameraIcon.setAttribute('viewBox', '0 0 24 24');
    cameraIcon.setAttribute('fill', 'none');
    cameraIcon.setAttribute('stroke', 'currentColor');
    cameraIcon.setAttribute('stroke-width', '1.5');
    cameraIcon.innerHTML = `
        <path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    `;
    iconContainer.appendChild(cameraIcon);

    // Title - Technical
    const title = createElement('h2', {
        className: 'webcam-permission-title',
        text: 'Requesting Camera Permission'
    });

    // Subtitle - Technical
    const subtitle = createElement('p', {
        className: 'webcam-permission-subtitle',
        text: 'CAMERA ACCESS REQUIRED'
    });

    // Description
    const description = createElement('p', {
        className: 'webcam-permission-description',
        text: 'Grant camera access to enable real-time visual inference'
    });

    // Micro log (simulates system status)
    const microLog = createElement('p', {
        className: 'webcam-permission-micro-log',
        text: 'Waiting for user authorization'
    });

    content.appendChild(iconContainer);
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(description);
    content.appendChild(microLog);

    wrapper.appendChild(content);

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        content.innerHTML = '';
        
        const errorIconContainer = createElement('div', {
            className: 'error-icon-container'
        });
        
        const errorIcon = createElement('svg', {
            className: 'error-icon',
            attributes: {
                fill: 'currentColor',
                viewBox: '0 0 20 20'
            }
        });
        
        errorIcon.innerHTML = `
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        `;
        
        errorIconContainer.appendChild(errorIcon);
        
        const errorTitle = createElement('h2', {
            className: 'webcam-permission-title',
            text: 'Camera Not Supported'
        });
        
        const errorSubtitle = createElement('p', {
            className: 'webcam-permission-subtitle',
            text: 'BROWSER NOT COMPATIBLE'
        });
        
        const errorMessage = createElement('p', {
            className: 'webcam-permission-error',
            text: 'Your browser does not support camera access. Please use a modern browser (Chrome 113+, Edge 113+, Firefox 141+).'
        });
        
        content.appendChild(errorIconContainer);
        content.appendChild(errorTitle);
        content.appendChild(errorSubtitle);
        content.appendChild(errorMessage);
        content.style.background = GLASS_EFFECTS.COLORS.ERROR_BG;
        
        return wrapper;
    }

    // Check for secure context (required for camera access on mobile)
    const isSecureContext = window.isSecureContext || 
                           location.protocol === 'https:' || 
                           location.hostname === 'localhost' || 
                           location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
        // Show HTTPS warning
        content.innerHTML = '';
        
        const warningIcon = createElement('div', {
            style: {
                fontSize: '48px',
                marginBottom: '16px'
            },
            text: '⚠️'
        });
        
        const warningTitle = createElement('h2', {
            className: 'webcam-permission-title',
            text: 'Insecure Connection'
        });
        
        const warningSubtitle = createElement('p', {
            className: 'webcam-permission-subtitle',
            text: 'HTTPS REQUIRED'
        });
        
        const warningMessage = createElement('p', {
            className: 'webcam-permission-error',
            text: 'Camera access requires a secure connection (HTTPS). Please use HTTPS or localhost to access the camera.'
        });
        
        const warningLog = createElement('p', {
            className: 'webcam-permission-micro-log',
            text: 'Current protocol: ' + location.protocol
        });
        
        const helpLink = createElement('p', {
            style: {
                marginTop: '16px',
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.5)'
            }
        });
        
        const link = createElement('a', {
            text: 'See MOBILE_TESTING.md for setup instructions',
            attributes: {
                href: 'MOBILE_TESTING.md',
                target: '_blank'
            },
            style: {
                color: 'rgba(255, 255, 255, 0.8)',
                textDecoration: 'underline'
            }
        });
        
        helpLink.appendChild(link);
        
        content.appendChild(warningIcon);
        content.appendChild(warningTitle);
        content.appendChild(warningSubtitle);
        content.appendChild(warningMessage);
        content.appendChild(warningLog);
        content.appendChild(helpLink);
        content.style.background = GLASS_EFFECTS.COLORS.ERROR_BG;
        
        return wrapper;
    }

    // Request permission on mount
    setTimeout(async () => {
        try {
            const stream = await requestWebcamPermission();

            // Success - update UI briefly before transition
            microLog.textContent = 'Camera access granted';
            title.textContent = 'Camera Ready';
            subtitle.textContent = 'PERMISSION GRANTED';
            
            // Smooth transition
            setTimeout(() => {
                content.style.opacity = '0';
                setTimeout(() => {
                    if (onPermissionGranted) {
                        onPermissionGranted(stream);
                    }
                }, 300);
            }, 400);
        } catch (error) {
            // Show error state
            content.innerHTML = '';

            const errorIconContainer = createElement('div', {
                className: 'error-icon-container'
            });

            const errorIcon = createElement('svg', {
                className: 'error-icon',
                attributes: {
                    fill: 'currentColor',
                    viewBox: '0 0 20 20'
                }
            });

            errorIcon.innerHTML = `
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            `;

            errorIconContainer.appendChild(errorIcon);

            const errorTitle = createElement('h2', {
                className: 'webcam-permission-title',
                text: 'Camera Access Denied'
            });

            const errorSubtitle = createElement('p', {
                className: 'webcam-permission-subtitle',
                text: 'PERMISSION REQUIRED'
            });

            const errorMessage = createElement('p', {
                className: 'webcam-permission-error',
                text: error.message || 'Camera permission denied by user'
            });

            const errorMicroLog = createElement('p', {
                className: 'webcam-permission-micro-log',
                text: 'Runtime requires camera access'
            });

            const retryButton = createElement('button', {
                className: 'webcam-permission-button',
                text: 'Reload Runtime'
            });

            retryButton.addEventListener('click', () => window.location.reload());

            content.appendChild(errorIconContainer);
            content.appendChild(errorTitle);
            content.appendChild(errorSubtitle);
            content.appendChild(errorMessage);
            content.appendChild(errorMicroLog);
            content.appendChild(retryButton);

            // Update container to error style
            content.style.background = GLASS_EFFECTS.COLORS.ERROR_BG;
        }
    }, 100);

    return wrapper;
}
