/**
 * Welcome Screen — Apple-style landing
 */

import { createElement } from '../utils/dom-helpers.js';

export function createWelcomeScreen(onStart) {
    const wrapper = createElement('div', { className: 'aw-wrapper' });

    // ── Nav ─────────────────────────────────────────────────
    const nav = createElement('nav', { className: 'aw-nav' });
    const navInner = createElement('div', { className: 'aw-nav-inner' });

    const logo = createElement('div', { className: 'aw-logo' });
    const logoIcon = createElement('div', { className: 'aw-logo-icon' });
    const faviconImg = createElement('img', {
        attributes: { src: '/assets/favicon.png', alt: 'VLM Runtime', width: '30', height: '30' }
    });
    faviconImg.style.cssText = 'border-radius:8px;display:block;';
    logoIcon.appendChild(faviconImg);
    const logoText = createElement('span', { className: 'aw-logo-text', text: 'VLM Runtime' });
    logo.appendChild(logoIcon);
    logo.appendChild(logoText);

    const navRight = createElement('div', { className: 'aw-nav-right' });
    [
        ['Features', '#features'],
        ['How it works', '#how'],
        ['GitHub', 'https://github.com/deepdevjose/Vision-Language-Runtime'],
    ].forEach(function (item) {
        var label = item[0]; var href = item[1];
        var a = createElement('a', {
            className: 'aw-nav-link',
            text: label,
            attributes: Object.assign({ href: href }, href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})
        });
        navRight.appendChild(a);
    });

    const navCta = createElement('button', { className: 'aw-nav-cta', text: 'Launch Runtime' });
    navCta.addEventListener('click', function () {
        navCta.disabled = true;
        navCta.textContent = 'Launching\u2026';
        onStart();
    });
    navRight.appendChild(navCta);

    navInner.appendChild(logo);
    navInner.appendChild(navRight);
    nav.appendChild(navInner);

    // ── Hero ─────────────────────────────────────────────────
    const hero = createElement('section', { className: 'aw-hero' });

    const eyebrow = createElement('p', { className: 'aw-eyebrow', text: 'Vision-Language Runtime' });

    const heroTitle = createElement('h1', { className: 'aw-hero-title' });
    heroTitle.innerHTML = 'See.<br>Understand.<br>Reason.';

    const heroSub = createElement('p', { className: 'aw-hero-sub' });
    heroSub.innerHTML = 'Multimodal AI running entirely in your browser.<br><br>No servers. No API keys.<br>Total privacy.';

    const heroActions = createElement('div', { className: 'aw-hero-actions' });
    const startBtn = createElement('button', { className: 'aw-btn-primary', text: 'Launch Runtime' });
    startBtn.addEventListener('click', function () {
        startBtn.disabled = true;
        startBtn.textContent = 'Launching\u2026';
        onStart();
    });
    const ghBtn = createElement('a', {
        className: 'aw-btn-secondary',
        text: 'View on GitHub',
        attributes: { href: 'https://github.com/deepdevjose/Vision-Language-Runtime', target: '_blank', rel: 'noopener noreferrer' }
    });
    heroActions.appendChild(startBtn);
    heroActions.appendChild(ghBtn);

    const heroText = createElement('div', { className: 'aw-hero-text' });
    heroText.appendChild(eyebrow);
    heroText.appendChild(heroTitle);
    heroText.appendChild(heroSub);
    heroText.appendChild(heroActions);

    // Live Runtime Preview Simulation (Apple focus object)
    const heroPreview = createElement('div', { className: 'aw-hero-preview' });
    heroPreview.innerHTML = '<div class="aw-sim-demo">' +
        '<div class="aw-sim-vision">' +
        '<img src="/assets/demo.webp" alt="VLM Runtime demo" style="width: 100%; height: 100%; object-fit: cover;" loading="eager">' +
        '<div class="aw-sim-live"><span class="rt-live-dot"></span>Live vision</div>' +
        '</div>' +
        '<div class="aw-sim-reasoning">' +
        '<div class="aw-sim-scene">' +
        '<span class="aw-sim-label">Scene</span>' +
        '<p>"A person with glasses is working on a laptop at a desk in a cozy home office. A cat is sleeping on the floor nearby."</p>' +
        '</div>' +
        '<div class="aw-sim-chat">' +
        '<div class="aw-sim-user">' +
        '<span class="aw-sim-qa-label">Question</span>' +
        '<p class="aw-qa-question">Where is the cat?</p>' +
        '</div>' +
        '<div class="aw-sim-ai">' +
        '<span class="aw-sim-qa-label ai">Answer</span>' +
        '<p class="aw-typing-text"></p>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';

    // Cycling Q&A pairs with typewriter effect
    var qaPairs = [
        { q: 'Where is the cat?', a: 'Sleeping on the floor near the desk.' },
        { q: 'What is the person doing?', a: 'Working or coding on a laptop.' },
        { q: 'Is it day or night?', a: 'Likely evening \u2014 city lights are visible outside.' },
        { q: 'What objects are on the desk?', a: 'A laptop, desk lamp, books, coffee mug, and smartphone.' },
        { q: 'Describe the room.', a: 'A cozy home office with a bookshelf, plants, and warm lighting.' },
    ];
    var qaIndex = 0;
    var typingTimer = null;

    function typeAnswer(el, text, onDone) {
        var i = 0;
        el.textContent = '';
        clearInterval(typingTimer);
        typingTimer = setInterval(function () {
            if (i < text.length) {
                el.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(typingTimer);
                if (onDone) onDone();
            }
        }, 30);
    }

    function cycleQA() {
        var questionEl = heroPreview.querySelector('.aw-qa-question');
        var answerEl = heroPreview.querySelector('.aw-typing-text');
        if (!questionEl || !answerEl) return;

        // Fade out question + answer
        questionEl.style.transition = 'opacity 0.3s';
        answerEl.style.transition = 'opacity 0.3s';
        questionEl.style.opacity = '0';
        answerEl.style.opacity = '0';

        setTimeout(function () {
            qaIndex = (qaIndex + 1) % qaPairs.length;
            questionEl.textContent = qaPairs[qaIndex].q;
            questionEl.style.opacity = '1';
            answerEl.style.opacity = '1';
            typeAnswer(answerEl, qaPairs[qaIndex].a, function () {
                setTimeout(cycleQA, 3000);
            });
        }, 400);
    }

    // Start: type the first answer, then begin cycling
    setTimeout(function () {
        var answerEl = heroPreview.querySelector('.aw-typing-text');
        if (answerEl) {
            typeAnswer(answerEl, qaPairs[0].a, function () {
                setTimeout(cycleQA, 3000);
            });
        }
    }, 800);

    const heroContent = createElement('div', { className: 'aw-hero-content' });
    heroContent.appendChild(heroText);
    heroContent.appendChild(heroPreview);

    hero.appendChild(heroContent);

    // ── What it does ─────────────────────────────────────────
    const whatSection = createElement('section', { className: 'aw-section', attributes: { id: 'features' } });
    const whatEyebrow = createElement('p', { className: 'aw-section-eyebrow', text: 'What it does' });
    const whatTitle = createElement('p', {
        className: 'aw-section-body',
        text: 'Vision-Language Runtime combines computer vision and language models to understand images directly in your browser, in real time.'
    });
    const whatCards = createElement('div', { className: 'aw-cards' });

    [
        {
            title: 'Scene Understanding',
            desc: 'Identify objects, text, and spatial relationships directly from the camera feed.',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>'
        },
        {
            title: 'Visual Q&A',
            desc: 'Ask natural language questions about anything you see on screen.',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
        },
        {
            title: 'Fully Private',
            desc: 'Runs locally in your browser. No cloud, no servers, total privacy.',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
        },
    ].forEach(function (item) {
        var card = createElement('div', { className: 'aw-card' });
        var cardIcon = createElement('div', { className: 'aw-card-icon' });
        cardIcon.innerHTML = item.icon;
        var cardTitle = createElement('h3', { className: 'aw-card-title', text: item.title });
        var cardDesc = createElement('p', { className: 'aw-card-desc', text: item.desc });
        card.appendChild(cardIcon);
        card.appendChild(cardTitle);
        card.appendChild(cardDesc);
        whatCards.appendChild(card);
    });

    whatSection.appendChild(whatEyebrow);
    whatSection.appendChild(whatTitle);
    whatSection.appendChild(whatCards);

    // ── Capabilities ─────────────────────────────────────────
    const capsSection = createElement('section', { className: 'aw-section aw-section-tinted', attributes: { id: 'capabilities' } });
    const capsEyebrow = createElement('p', { className: 'aw-section-eyebrow', text: 'Capabilities' });
    const capsCols = createElement('div', { className: 'aw-caps-grid' });

    [
        { title: 'Scene description', desc: 'Describe any scene in natural language', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' },
        { title: 'Object recognition', desc: 'Identify objects in images instantly', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>' },
        { title: 'OCR / Text reading', desc: 'Read text from documents or signs', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>' },
        { title: 'Code analysis', desc: 'Understand screenshots of code', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
        { title: 'Visual Q&A', desc: 'Answer questions about the feed', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
        { title: 'Accessibility', desc: 'Audio assistance for impaired users', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>' },
    ].forEach(function (cap) {
        var item = createElement('div', { className: 'aw-cap-card' });
        var iconWrap = createElement('div', { className: 'aw-cap-icon' });
        iconWrap.innerHTML = cap.icon;
        var textWrap = createElement('div', { className: 'aw-cap-text' });
        var title = createElement('div', { className: 'aw-cap-title', text: cap.title });
        var desc = createElement('div', { className: 'aw-cap-desc', text: cap.desc });
        textWrap.appendChild(title);
        textWrap.appendChild(desc);
        item.appendChild(iconWrap);
        item.appendChild(textWrap);
        capsCols.appendChild(item);
    });

    capsSection.appendChild(capsEyebrow);
    capsSection.appendChild(capsCols);

    // ── Architecture ─────────────────────────────────────────
    const archSection = createElement('section', { className: 'aw-section', attributes: { id: 'how' } });
    const archEyebrow = createElement('p', { className: 'aw-section-eyebrow', text: 'Architecture' });
    const archTitle = createElement('p', {
        className: 'aw-section-body',
        text: 'A complete vision-language pipeline running entirely in WebAssembly and WebGPU. No installation, no server, no API key.'
    });

    const pipeline = createElement('div', { className: 'aw-pipeline' });
    [
        { label: 'Camera / Image', sub: 'Input stream' },
        { label: 'Vision Encoder', sub: 'Extracts visual features' },
        { label: 'Multimodal Fusion', sub: 'Cross-attention reasoning' },
        { label: 'Language Model', sub: 'Generates answer' },
    ].forEach(function (step, i) {
        var node = createElement('div', { className: 'aw-pipeline-node' });
        var nodeLabel = createElement('div', { className: 'aw-pipeline-label', text: step.label });
        var nodeSub = createElement('div', { className: 'aw-pipeline-sub', text: step.sub });
        node.appendChild(nodeLabel);
        node.appendChild(nodeSub);
        pipeline.appendChild(node);
        if (i < 3) pipeline.appendChild(createElement('div', { className: 'aw-pipeline-arrow' }));
    });

    var techRow = createElement('div', { className: 'aw-tech-row' });
    ['WebGPU', 'Transformers.js', 'FastVLM-0.5B', 'ONNX Runtime Web'].forEach(function (t) {
        techRow.appendChild(createElement('span', { className: 'aw-tech-badge', text: t }));
    });

    archSection.appendChild(archEyebrow);
    archSection.appendChild(archTitle);
    archSection.appendChild(pipeline);
    archSection.appendChild(techRow);

    // ── CTA ───────────────────────────────────────────────────
    const ctaSection = createElement('section', { className: 'aw-cta' });
    const ctaTitle = createElement('h2', { className: 'aw-cta-title', text: 'Try it now.' });
    const ctaSub = createElement('p', { className: 'aw-cta-sub' });
    ctaSub.innerHTML = 'No installation.<br>No API key.<br>Runs entirely in your browser.';
    const ctaBtn = createElement('button', { className: 'aw-btn-primary aw-btn-large', text: 'Launch Runtime \u2192' });
    ctaBtn.addEventListener('click', function () {
        ctaBtn.disabled = true;
        ctaBtn.textContent = 'Launching\u2026';
        startBtn.disabled = true;
        onStart();
    });
    ctaSection.appendChild(ctaTitle);
    ctaSection.appendChild(ctaSub);
    ctaSection.appendChild(ctaBtn);

    // ── Footer ───────────────────────────────────────────────
    const footer = createElement('footer', { className: 'aw-footer' });
    footer.innerHTML = '<span class="aw-footer-credit">Built by <strong>José Manuel Cortés Cerón</strong></span>'
        + '<div class="aw-footer-socials">'
        + '<a href="https://github.com/deepdevjose" target="_blank" rel="noopener noreferrer" class="aw-social" title="GitHub"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg></a>'
        + '<a href="https://www.instagram.com/deepdevjose" target="_blank" rel="noopener noreferrer" class="aw-social" title="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324A6.162 6.162 0 0 0 12 5.838zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg></a>'
        + '<a href="https://www.facebook.com/deepdevjose/" target="_blank" rel="noopener noreferrer" class="aw-social" title="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg></a>'
        + '<a href="https://www.linkedin.com/in/deepdevjose" target="_blank" rel="noopener noreferrer" class="aw-social" title="LinkedIn"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>'
        + '</div>';

    // ── Assemble ──────────────────────────────────────────────
    wrapper.appendChild(nav);
    const main = createElement('main', { className: 'aw-main' });
    main.appendChild(hero);
    main.appendChild(whatSection);
    main.appendChild(capsSection);
    main.appendChild(archSection);
    main.appendChild(ctaSection);
    wrapper.appendChild(main);
    wrapper.appendChild(footer);

    return wrapper;
}