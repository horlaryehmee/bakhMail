import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

createInertiaApp({
    title: (title) => (title ? `${title} | Project Workspace` : 'Project Workspace'),
    resolve: async (name) => {
        const pages = {
            ...import.meta.glob('./Pages/**/*.jsx'),
            ...import.meta.glob('./Pages/**/*.tsx'),
        };
        const page = pages[`./Pages/${name}.jsx`] ?? pages[`./Pages/${name}.tsx`];

        if (!page) {
            throw new Error(`Unknown Inertia page: ${name}`);
        }

        return (await page()).default;
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        color: '#276ef1',
    },
});
