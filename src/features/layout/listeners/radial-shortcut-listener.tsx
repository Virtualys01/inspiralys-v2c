import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

export const RadialShortcutListener = () => {
    useEffect(() => {
        const shortcut = 'Ctrl+Alt+S';

        const setup = async () => {
            try {
                await register(shortcut, async (event) => {
                    if (event.state === 'Pressed') {
                        await invoke('show_radial_menu');
                    }
                });
            } catch (e) {
                console.warn('Failed to register radial shortcut:', e);
            }
        };

        setup();

        return () => {
            unregister(shortcut).catch(() => {});
        };
    }, []);

    return null;
};
