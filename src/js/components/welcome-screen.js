/**
 * Welcome Screen Component - Apple/WWDC Style
 */

import { createElement } from '../utils/dom-helpers.js';

export function createWelcomeScreen(onStart) {
    const wrapper = createElement('div', {
        className: 'welcome-wrapper'
    });

    // Navbar
    const navbar = createElement('div', {
        className: 'welcome-navbar'
    });

    const navContent = createElement('div', {
        className: 'welcome-nav-content'
    });

    const logoText = createElement('div', {
        className: 'welcome-logo',
        text: 'VLM Runtime'
    });

    navContent.appendChild(logoText);
    navbar.appendChild(navContent);

    // Main Content Container
    const mainContent = createElement('div', {
        className: 'welcome-main'
    });

    // Hero Card (Liquid Glass)
    const heroCard = createElement('div', {
        className: 'welcome-hero-card'
    });

    // Title
    const title = createElement('h1', {
        className: 'welcome-title',
        text: 'Vision-Language Runtime'
    });

    // Subtitle
    const subtitle = createElement('p', {
        className: 'welcome-subtitle',
        text: 'WebGPU-ACCELERATED MULTIMODAL INFERENCE'
    });

    // Description
    const description = createElement('p', {
        className: 'welcome-description',
        text: 'In-Browser • On-Device • Real-Time'
    });

    // Status Chips Container
    const statusChips = createElement('div', {
        className: 'welcome-status-chips'
    });

    const chipGPU = createElement('div', {
        className: 'status-chip status-chip-animate',
        text: 'GPU Available'
    });

    const chipDevice = createElement('div', {
        className: 'status-chip status-chip-animate',
        style: { animationDelay: '0.1s' },
        text: 'On-Device'
    });

    const chipWebGPU = createElement('div', {
        className: 'status-chip status-chip-animate',
        style: { animationDelay: '0.2s' },
        text: 'WebGPU Active'
    });

    statusChips.appendChild(chipGPU);
    statusChips.appendChild(chipDevice);
    statusChips.appendChild(chipWebGPU);

    // Start Button
    const startButton = createElement('button', {
        className: 'welcome-start-button',
        text: 'Initialize Runtime'
    });

    startButton.addEventListener('click', () => {
        startButton.disabled = true;
        startButton.textContent = 'Initializing...';
        onStart();
    });

    // Runtime Status Line (ultra-subtle)
    const statusLine = createElement('div', {
        className: 'welcome-status-line',
        text: 'Runtime Status: Idle'
    });

    // Assemble Hero Card
    heroCard.appendChild(title);
    heroCard.appendChild(subtitle);
    heroCard.appendChild(description);
    heroCard.appendChild(statusChips);
    heroCard.appendChild(startButton);
    heroCard.appendChild(statusLine);

    // Assemble Main Content
    mainContent.appendChild(heroCard);

    // Assemble Wrapper
    wrapper.appendChild(navbar);
    wrapper.appendChild(mainContent);

    return wrapper;
}
