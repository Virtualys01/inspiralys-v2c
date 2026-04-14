import React from 'react';
import { createRoot } from 'react-dom/client';
import { RadialMenu } from './radial-menu.tsx';
import '../tailwind.css';

const root = document.getElementById('root')!;
createRoot(root).render(
    <React.StrictMode>
        <RadialMenu />
    </React.StrictMode>
);
