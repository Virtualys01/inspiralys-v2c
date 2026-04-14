import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import inspiralysLogo from '@/assets/inspiralys-logo.png';

// ─── Menu Items ──────────────────────────────────────────────────────────────

interface MenuItem {
    id: string;
    label: string;
    icon: string;
    color: string;
    description: string;
}

const MENU_ITEMS: MenuItem[] = [
    {
        id: 'screenshot',
        label: 'Screenshot',
        icon: '📸',
        color: '#38bdf8',
        description: 'Capturer une zone de l\'ecran',
    },
    {
        id: 'apps',
        label: 'Apps',
        icon: '🚀',
        color: '#a78bfa',
        description: 'Lancer une application rapide',
    },
    {
        id: 'sites',
        label: 'Sites',
        icon: '🌐',
        color: '#34d399',
        description: 'Ouvrir un site web',
    },
    {
        id: 'toolbox',
        label: 'Toolbox',
        icon: '⚡',
        color: '#fbbf24',
        description: 'Commandes IT et transcriptions',
    },
    {
        id: 'dictate',
        label: 'Dicter',
        icon: '🎤',
        color: '#f472b6',
        description: 'Demarrer la transcription vocale',
    },
    {
        id: 'clipboard',
        label: 'Historique',
        icon: '📋',
        color: '#fb923c',
        description: 'Dernier texte transcrit',
    },
];

// ─── Load Config from localStorage ──────────────────────────────────────────

interface RadialSiteItem { label: string; url: string; }
interface RadialAppItem { label: string; command: string; }
interface RadialConfig { sites: RadialSiteItem[]; apps: RadialAppItem[]; }

function loadRadialConfig(): RadialConfig {
    try {
        const raw = localStorage.getItem('inspiralys-radial-config');
        if (raw) {
            const parsed = JSON.parse(raw) as RadialConfig;
            return {
                sites: (parsed.sites || []).filter(s => s.label && s.url),
                apps: (parsed.apps || []).filter(a => a.label && a.command),
            };
        }
    } catch { /* ignore */ }
    return {
        sites: [
            { label: 'Proxmox', url: 'https://192.168.0.230:8006' },
            { label: 'N8N', url: 'https://n8n.inspiralys.ca' },
            { label: 'Nextcloud', url: 'https://nextcloud.inspiralys.ca' },
            { label: 'Jellyfin', url: 'https://jellyfin.inspiralys.ca' },
            { label: 'GitHub', url: 'https://github.com' },
            { label: 'Claude', url: 'https://claude.ai' },
            { label: 'ChatGPT', url: 'https://chat.openai.com' },
            { label: 'YouTube', url: 'https://youtube.com' },
        ],
        apps: [
            { label: 'Terminal', command: 'wt.exe' },
            { label: 'PowerShell', command: 'powershell.exe' },
            { label: 'Explorer', command: 'explorer.exe' },
            { label: 'Task Manager', command: 'taskmgr.exe' },
            { label: 'Notepad', command: 'notepad.exe' },
            { label: 'VS Code', command: 'code' },
            { label: 'Control Panel', command: 'control.exe' },
            { label: 'Device Manager', command: 'devmgmt.msc' },
        ],
    };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const RadialMenu = () => {
    const [visible, setVisible] = useState(false);
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [cursorPos, setCursorPos] = useState({ x: 960, y: 540 });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [subMenu, setSubMenu] = useState<string | null>(null);
    const [subSelectedIndex, setSubSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [radialConfig, setRadialConfig] = useState<RadialConfig>(loadRadialConfig());
    const [clipboardCopied, setClipboardCopied] = useState(false);

    // Screenshot selection state
    const [screenshotMode, setScreenshotMode] = useState(false);
    const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
    const [selEnd, setSelEnd] = useState<{ x: number; y: number } | null>(null);

    const hideMenu = useCallback(async () => {
        setVisible(false);
        setSubMenu(null);
        setScreenshotMode(false);
        setSelStart(null);
        setSelEnd(null);
        await invoke('hide_radial_menu');
    }, []);

    const activateItem = useCallback(async (item: MenuItem) => {
        switch (item.id) {
            case 'screenshot':
                setSubMenu(null);
                setScreenshotMode(true);
                break;
            case 'apps':
                setSubMenu('apps');
                setSubSelectedIndex(0);
                break;
            case 'sites':
                setSubMenu('sites');
                setSubSelectedIndex(0);
                break;
            case 'toolbox':
                await hideMenu();
                try {
                    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
                    const mainWin = await WebviewWindow.getByLabel('main');
                    if (mainWin) {
                        await mainWin.show();
                        await mainWin.setFocus();
                        // Navigate to toolbox via event
                        await mainWin.emit('navigate-to', '/toolbox');
                    }
                } catch { /* ignore */ }
                break;
            case 'dictate':
                await hideMenu();
                break;
            case 'clipboard': {
                try {
                    const history = await invoke<{ text: string }[]>('get_recent_transcriptions');
                    if (history.length > 0 && history[0].text) {
                        await navigator.clipboard.writeText(history[0].text);
                        // Brief visual feedback before hiding
                        setClipboardCopied(true);
                        await new Promise(r => setTimeout(r, 600));
                        setClipboardCopied(false);
                    }
                } catch { /* ignore */ }
                await hideMenu();
                break;
            }
        }
    }, [hideMenu]);

    const launchApp = useCallback(async (command: string) => {
        try {
            const { Command } = await import('@tauri-apps/plugin-shell');
            await Command.create('cmd', ['/c', 'start', '', command]).execute();
        } catch {
            try {
                const { openPath } = await import('@tauri-apps/plugin-opener');
                await openPath(command);
            } catch { /* ignore */ }
        }
        await hideMenu();
    }, [hideMenu]);

    const openSite = useCallback(async (url: string) => {
        try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(url);
        } catch {
            window.open(url, '_blank');
        }
        await hideMenu();
    }, [hideMenu]);

    // Listen for show event
    useEffect(() => {
        const unlistenShow = listen('radial-show', async () => {
            try {
                setRadialConfig(loadRadialConfig());
                const [screenshot, pos] = await Promise.all([
                    invoke<string>('capture_screen'),
                    invoke<[number, number]>('get_cursor_position'),
                ]);
                setBgImage(screenshot);
                setCursorPos({ x: pos[0], y: pos[1] });
                setSelectedIndex(0);
                setSubMenu(null);
                setScreenshotMode(false);
                setVisible(true);
                containerRef.current?.focus();
            } catch (e) {
                console.error('Failed to show radial menu:', e);
            }
        });

        const unlistenHide = listen('radial-hide', () => {
            setVisible(false);
        });

        return () => {
            unlistenShow.then((u) => u());
            unlistenHide.then((u) => u());
        };
    }, []);

    // Keyboard handler
    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (screenshotMode) {
                    setScreenshotMode(false);
                    setSelStart(null);
                    setSelEnd(null);
                } else if (subMenu) {
                    setSubMenu(null);
                } else {
                    hideMenu();
                }
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, subMenu, screenshotMode, hideMenu]);

    // Mouse wheel for rotation
    useEffect(() => {
        if (!visible) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (subMenu === 'apps') {
                const len = radialConfig.apps.length;
                setSubSelectedIndex((prev) => {
                    const next = prev + (e.deltaY > 0 ? 1 : -1);
                    return ((next % len) + len) % len;
                });
            } else if (subMenu === 'sites') {
                const len = radialConfig.sites.length;
                setSubSelectedIndex((prev) => {
                    const next = prev + (e.deltaY > 0 ? 1 : -1);
                    return ((next % len) + len) % len;
                });
            } else if (!screenshotMode) {
                setSelectedIndex((prev) => {
                    const next = prev + (e.deltaY > 0 ? 1 : -1);
                    return ((next % MENU_ITEMS.length) + MENU_ITEMS.length) % MENU_ITEMS.length;
                });
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [visible, subMenu, screenshotMode]);

    // Screenshot selection handlers
    const handleScreenshotMouseDown = useCallback((e: React.MouseEvent) => {
        if (!screenshotMode) return;
        setSelStart({ x: e.clientX, y: e.clientY });
        setSelEnd({ x: e.clientX, y: e.clientY });
    }, [screenshotMode]);

    const handleScreenshotMouseMove = useCallback((e: React.MouseEvent) => {
        if (!screenshotMode || !selStart) return;
        setSelEnd({ x: e.clientX, y: e.clientY });
    }, [screenshotMode, selStart]);

    const handleScreenshotMouseUp = useCallback(async () => {
        if (!screenshotMode || !selStart || !selEnd || !bgImage) return;

        const x = Math.min(selStart.x, selEnd.x);
        const y = Math.min(selStart.y, selEnd.y);
        const w = Math.abs(selEnd.x - selStart.x);
        const h = Math.abs(selEnd.y - selStart.y);

        if (w > 10 && h > 10) {
            // Crop from bgImage
            const img = new Image();
            img.onload = async () => {
                const scaleX = img.width / window.innerWidth;
                const scaleY = img.height / window.innerHeight;
                const canvas = document.createElement('canvas');
                canvas.width = w * scaleX;
                canvas.height = h * scaleY;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(img, x * scaleX, y * scaleY, w * scaleX, h * scaleY, 0, 0, canvas.width, canvas.height);

                // Copy to clipboard
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        try {
                            await navigator.clipboard.write([
                                new ClipboardItem({ 'image/png': blob }),
                            ]);
                        } catch { /* ignore */ }
                    }
                    await hideMenu();
                }, 'image/png');
            };
            img.src = bgImage;
        } else {
            setSelStart(null);
            setSelEnd(null);
        }
    }, [screenshotMode, selStart, selEnd, bgImage, hideMenu]);

    if (!visible) return null;

    // ─── Screenshot Mode ─────────────────────────────────────────────────────

    if (screenshotMode) {
        return (
            <div
                className="fixed inset-0 cursor-crosshair"
                style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover' }}
                onMouseDown={handleScreenshotMouseDown}
                onMouseMove={handleScreenshotMouseMove}
                onMouseUp={handleScreenshotMouseUp}
            >
                <div className="absolute inset-0 bg-black/20" />
                {selStart && selEnd && (
                    <div
                        className="absolute border-2 border-sky-400 bg-sky-400/15 shadow-lg shadow-sky-400/20"
                        style={{
                            left: Math.min(selStart.x, selEnd.x),
                            top: Math.min(selStart.y, selEnd.y),
                            width: Math.abs(selEnd.x - selStart.x),
                            height: Math.abs(selEnd.y - selStart.y),
                        }}
                    >
                        <div className="absolute -top-7 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded">
                            {Math.abs(selEnd.x - selStart.x)} x {Math.abs(selEnd.y - selStart.y)}
                        </div>
                    </div>
                )}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-5 py-2.5 rounded-xl backdrop-blur-md flex items-center gap-2 shadow-xl">
                    <span className="text-sky-400">✂</span>
                    Selectionner une zone — Echap pour annuler
                </div>
            </div>
        );
    }

    // ─── Sub Menu (Apps or Sites) ────────────────────────────────────────────

    if (subMenu) {
        const items = subMenu === 'apps' ? radialConfig.apps : radialConfig.sites;

        return (
            <div
                ref={containerRef}
                tabIndex={0}
                className="fixed inset-0"
                style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover' }}
                onClick={hideMenu}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div
                    className="absolute"
                    style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Center = BACK button with glow pulse */}
                    <button
                        className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 z-20 rounded-full bg-black/80 border-2 border-sky-400 hover:border-white hover:bg-sky-800/60 flex items-center justify-center transition-all cursor-pointer animate-pulse"
                        style={{ boxShadow: '0 0 20px rgba(56, 189, 248, 0.5), 0 0 40px rgba(56, 189, 248, 0.2)' }}
                        onClick={() => { setSubMenu(null); setSubSelectedIndex(0); }}
                        title="Retour"
                    >
                        <span className="text-sky-300 text-xl font-bold">↩</span>
                    </button>

                    {/* Sub items in circle */}
                    {items.map((item, i) => {
                        const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
                        const radius = 140;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        const isSelected = i === subSelectedIndex;

                        return (
                            <button
                                key={i}
                                className={`absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center transition-all duration-200 ${
                                    isSelected
                                        ? 'bg-sky-500/90 scale-125 shadow-xl shadow-sky-500/40 border-2 border-white'
                                        : 'bg-white/10 hover:bg-white/20 border border-white/20'
                                }`}
                                style={{ left: x, top: y }}
                                onClick={async () => {
                                    if (subMenu === 'apps') {
                                        await launchApp((item as RadialAppItem).command);
                                    } else {
                                        await openSite((item as RadialSiteItem).url);
                                    }
                                }}
                                onMouseEnter={() => setSubSelectedIndex(i)}
                            >
                                <span className="text-white text-xs font-medium text-center leading-tight px-1">
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ─── Main Radial Menu ────────────────────────────────────────────────────

    const itemCount = MENU_ITEMS.length;
    const radius = 160;

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            className="fixed inset-0"
            style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover' }}
            onClick={hideMenu}
        >
            {/* Darkened frozen background */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Radial menu centered on cursor */}
            <div
                className="absolute"
                style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Center logo — click to close */}
                <button
                    className="absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2 z-20 rounded-full bg-black/90 border-2 border-sky-500/50 hover:border-sky-400 hover:scale-110 flex items-center justify-center shadow-2xl shadow-sky-500/20 transition-all cursor-pointer"
                    onClick={hideMenu}
                    title="Fermer"
                >
                    <img src={inspiralysLogo} alt="" className="w-12 h-12 rounded-full" />
                </button>

                {/* Connecting lines */}
                <svg className="absolute -translate-x-1/2 -translate-y-1/2 z-0" width={radius * 2 + 120} height={radius * 2 + 120} style={{ left: 0, top: 0, marginLeft: -(radius + 60), marginTop: -(radius + 60) }}>
                    {MENU_ITEMS.map((_, i) => {
                        const angle = (i / itemCount) * Math.PI * 2 - Math.PI / 2;
                        const cx = radius + 60;
                        const cy = radius + 60;
                        const x2 = cx + Math.cos(angle) * radius;
                        const y2 = cy + Math.sin(angle) * radius;
                        const isSelected = i === selectedIndex;
                        return (
                            <line
                                key={i}
                                x1={cx} y1={cy} x2={x2} y2={y2}
                                stroke={isSelected ? MENU_ITEMS[i].color : 'rgba(255,255,255,0.1)'}
                                strokeWidth={isSelected ? 2 : 1}
                                strokeDasharray={isSelected ? 'none' : '4,4'}
                            />
                        );
                    })}
                </svg>

                {/* Menu items in circle */}
                {MENU_ITEMS.map((item, i) => {
                    const angle = (i / itemCount) * Math.PI * 2 - Math.PI / 2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const isSelected = i === selectedIndex;

                    return (
                        <button
                            key={item.id}
                            className={`absolute w-[72px] h-[72px] -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center transition-all duration-300 z-10 ${
                                isSelected
                                    ? 'scale-125 shadow-2xl border-2'
                                    : 'scale-100 bg-white/5 hover:bg-white/10 border border-white/15 hover:scale-110'
                            }`}
                            style={{
                                left: x,
                                top: y,
                                ...(isSelected ? {
                                    backgroundColor: `${item.color}22`,
                                    borderColor: item.color,
                                    boxShadow: `0 0 30px ${item.color}40`,
                                } : {}),
                            }}
                            onClick={() => activateItem(item)}
                            onMouseEnter={() => setSelectedIndex(i)}
                        >
                            <span className="text-2xl">{item.icon}</span>
                            <span className={`text-[10px] font-semibold mt-0.5 ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Selected item description — compact, near the wheel */}
            <div
                className="absolute text-center pointer-events-none"
                style={{ left: cursorPos.x, top: cursorPos.y + radius + 60, transform: 'translateX(-50%)' }}
            >
                {clipboardCopied ? (
                    <div className="text-green-400 text-sm font-bold animate-pulse">
                        Copie dans le presse-papiers!
                    </div>
                ) : (
                    <>
                        <div
                            className="text-sm font-bold transition-all duration-300"
                            style={{ color: MENU_ITEMS[selectedIndex].color }}
                        >
                            {MENU_ITEMS[selectedIndex].icon} {MENU_ITEMS[selectedIndex].label}
                        </div>
                        <div className="text-white/50 text-xs">
                            {MENU_ITEMS[selectedIndex].description}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
