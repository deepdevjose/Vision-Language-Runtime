// Glass effect constants
export const GLASS_EFFECTS = {
    BASE_FREQUENCY: 0.008,
    NUM_OCTAVES: 2,
    SCALE: 77,
    COLORS: {
        DEFAULT_BG: 'rgba(0, 0, 0, 0.25)',
        SUCCESS_BG: 'rgba(0, 50, 0, 0.25)',
        ERROR_BG: 'rgba(50, 0, 0, 0.25)',
        BUTTON_BG: 'rgba(59, 130, 246, 0.25)',
        HIGHLIGHT: 'rgba(255, 255, 255, 0.15)',
        TEXT: '#ffffff',
    },
};

// Layout dimensions and margins
export const LAYOUT = {
    MARGINS: {
        DEFAULT: 20,
        BOTTOM: 20,
    },
    DIMENSIONS: {
        PROMPT_WIDTH: 420,
        CAPTION_WIDTH: 150,
        CAPTION_HEIGHT: 45,
    },
    TRANSITIONS: {
        SCALE_DURATION: 200,
        OPACITY_DURATION: 200,
        TRANSFORM_DURATION: 400,
    },
};

// Timing constants
export const TIMING = {
    FRAME_CAPTURE_DELAY: 3000, // Default fallback
    VIDEO_RECOVERY_INTERVAL: 1000,
    RESIZE_DEBOUNCE: 50,
    SUGGESTION_DELAY: 50,
};

// Quality of Service (QoS) Profiles - Hardware Target Boundaries
export const QOS_PROFILES = {
    low: {
        MAX_INFERENCE_SIZE: 320,
        MAX_NEW_TOKENS: 32,
        TIMING_DELAY_MS: 5000,
        SYSTEM_PROMPT:
            'You are a visual AI. Answer in ONE short sentence (8-14 words). No lists, no explanations, no step-by-step. Just the answer.',
    },
    medium: {
        MAX_INFERENCE_SIZE: 480,
        MAX_NEW_TOKENS: 64,
        TIMING_DELAY_MS: 3500,
        SYSTEM_PROMPT: 'You are a visual AI. Answer concisely (maximum 2 sentences).',
    },
    high: {
        MAX_INFERENCE_SIZE: 640,
        MAX_NEW_TOKENS: 128,
        TIMING_DELAY_MS: 2000,
        SYSTEM_PROMPT:
            "You are a helpful visual AI assistant. Respond concisely and accurately to the user's query in one sentence.",
    },
};

// Prompts
const DEFAULT_PROMPT = 'Describe what you see in one sentence.';
export const PROMPTS = {
    default: DEFAULT_PROMPT,
    placeholder: DEFAULT_PROMPT,
    suggestions: [
        DEFAULT_PROMPT,
        'What is the color of my shirt?',
        'Identify any text or written content visible.',
        'What emotions or actions are being portrayed?',
        'Name the object I am holding in my hand.',
    ],
    // Extended prompt presets for better UX
    presets: {
        'Describe scene': 'Describe everything you see in detail.',
        'Read text': 'Read and transcribe all visible text in the image.',
        'Count objects': 'Count and list all distinct objects you can see.',
        'Explain UI': 'Describe the user interface elements and layout you see.',
        Spanish: 'Describe lo que ves en español (responde en español).',
        Chinese: '用中文描述你看到的内容。',
        French: 'Décris ce que tu vois en français.',
        'Identify colors': 'List all the main colors you can identify.',
        'Detect emotions': 'Describe the emotions or mood conveyed in the scene.',
        'Find text': 'Is there any text visible? If so, what does it say?',
    },
    fallbackCaption: 'Waiting for first caption...',
    processingMessage: 'Starting analysis...',
};

// Language detection keywords (for auto-language feature)
export const LANGUAGE_KEYWORDS = {
    spanish: ['español', 'qué', 'cómo', 'dónde', 'cuándo', 'por qué', 'describir', 'explicar'],
    chinese: ['什么', '怎么', '哪里', '为什么', '描述', '解释'],
    french: ['français', 'quoi', 'comment', 'où', 'quand', 'pourquoi', 'décrire'],
};

export const MODEL_CONFIG = {
    MODEL_ID: 'onnx-community/FastVLM-0.5B-ONNX',
    MAX_NEW_TOKENS: 128, // Used as absolute cap
    MAX_INFERENCE_SIZE: 640, // Used as absolute cap
    DEBUG:
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.startsWith('192.168.')), // Auto-disable logging in production
};
