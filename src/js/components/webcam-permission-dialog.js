/**
 * Webcam Permission Dialog Component - Apple/WWDC Premium Style
 */

import { createElement } from '../utils/dom-helpers.js';
import { requestWebcamPermission } from '../services/webcam-service.js';

export function createWebcamPermissionDialog(onPermissionGranted, onPermissionDenied) {
    const wrapper = createElement('div', {
        className: 'webcam-permission-wrapper'
    });

    const content = createElement('div', {
        className: 'webcam-permission-content'
    });

    // Camera Icon
    const iconContainer = createElement('div', {
        className: 'webcam-permission-icon'
    });

    const cameraIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cameraIcon.setAttribute('width', '28');
    cameraIcon.setAttribute('height', '28');
    cameraIcon.setAttribute('viewBox', '0 0 24 24');
    cameraIcon.setAttribute('fill', 'none');
    cameraIcon.setAttribute('stroke', 'currentColor');
    cameraIcon.setAttribute('stroke-width', '1.5');
    cameraIcon.innerHTML = `
        <path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    `;
    iconContainer.appendChild(cameraIcon);

    // Title
    const title = createElement('h2', {
        className: 'webcam-permission-title',
        text: 'Camera Access'
    });

    // Eyebrow
    const subtitle = createElement('p', {
        className: 'webcam-permission-subtitle',
        text: 'Vision Runtime'
    });

    // Description
    const description = createElement('p', {
        className: 'webcam-permission-description',
        text: 'Allow camera access to enable real-time visual understanding. Everything runs locally in your browser.'
    });

    // Status
    const microLog = createElement('p', {
        className: 'webcam-permission-micro-log',
        text: 'Waiting for authorization'
    });

    content.appendChild(iconContainer);
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(description);
    content.appendChild(microLog);

    wrapper.appendChild(content);

    // Not supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        content.innerHTML = '';

        const errIcon = createElement('div', { className: 'webcam-permission-icon' });
        const errSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        errSvg.setAttribute('width', '28');
        errSvg.setAttribute('height', '28');
        errSvg.setAttribute('viewBox', '0 0 24 24');
        errSvg.setAttribute('fill', 'none');
        errSvg.setAttribute('stroke', 'currentColor');
        errSvg.setAttribute('stroke-width', '1.5');
        errSvg.innerHTML = '<path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>';
        errIcon.appendChild(errSvg);
        errIcon.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        errIcon.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.03))';
        errIcon.style.color = '#ef4444';

        const errTitle = createElement('h2', { className: 'webcam-permission-title', text: 'Browser Not Supported' });
        const errSub = createElement('p', { className: 'webcam-permission-subtitle', text: 'Incompatible Browser' });
        errSub.style.color = '#ef4444';
        const errMsg = createElement('p', { className: 'webcam-permission-error', text: 'Camera API not available. Use Chrome 113+, Edge 113+, or Firefox 141+.' });

        content.appendChild(errIcon);
        content.appendChild(errTitle);
        content.appendChild(errSub);
        content.appendChild(errMsg);
        return wrapper;
    }

    // Insecure context
    const isSecureContext = window.isSecureContext ||
        location.protocol === 'https:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1';

    if (!isSecureContext) {
        content.innerHTML = '';

        const warnIcon = createElement('div', { className: 'webcam-permission-icon' });
        const warnSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        warnSvg.setAttribute('width', '28');
        warnSvg.setAttribute('height', '28');
        warnSvg.setAttribute('viewBox', '0 0 24 24');
        warnSvg.setAttribute('fill', 'none');
        warnSvg.setAttribute('stroke', 'currentColor');
        warnSvg.setAttribute('stroke-width', '1.5');
        warnSvg.innerHTML = '<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>';
        warnIcon.appendChild(warnSvg);
        warnIcon.style.borderColor = 'rgba(245, 158, 11, 0.2)';
        warnIcon.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.03))';
        warnIcon.style.color = '#f59e0b';

        const warnTitle = createElement('h2', { className: 'webcam-permission-title', text: 'Secure Connection Required' });
        const warnSub = createElement('p', { className: 'webcam-permission-subtitle', text: 'HTTPS Required' });
        warnSub.style.color = '#f59e0b';
        const warnMsg = createElement('p', { className: 'webcam-permission-error', text: 'Camera access requires HTTPS. Use localhost or a secure connection.' });
        warnMsg.style.color = 'rgba(245, 158, 11, 0.8)';
        const warnLog = createElement('p', { className: 'webcam-permission-micro-log', text: 'Protocol: ' + location.protocol });

        content.appendChild(warnIcon);
        content.appendChild(warnTitle);
        content.appendChild(warnSub);
        content.appendChild(warnMsg);
        content.appendChild(warnLog);
        return wrapper;
    }

    // Request permission
    setTimeout(async () => {
        try {
            const stream = await requestWebcamPermission();

            microLog.textContent = 'Access granted';
            title.textContent = 'Camera Ready';
            subtitle.textContent = 'Connected';

            setTimeout(() => {
                content.style.opacity = '0';
                setTimeout(() => {
                    if (onPermissionGranted) {
                        onPermissionGranted(stream);
                    }
                }, 300);
            }, 400);
        } catch (error) {
            // Brief visual feedback before delegating to state machine
            microLog.textContent = 'Access denied';
            title.textContent = 'Access Denied';
            subtitle.textContent = 'Permission Required';
            subtitle.style.color = '#ef4444';

            // Delegate to state machine via callback (replaces inline reload)
            if (onPermissionDenied) {
                setTimeout(() => {
                    onPermissionDenied(error);
                }, 600);
            }
        }
    }, 100);

    return wrapper;
}
