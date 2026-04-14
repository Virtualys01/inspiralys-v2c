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
        id: 'copypaste',
        label: 'Copy/Paste',
        icon: '📋',
        color: '#fb923c',
        description: 'Historique copier-coller + transcriptions',
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
    const [historyEntries, setHistoryEntries] = useState<{ id: number; text: string; timestamp: number }[]>([]);

    // Screenshot editor state
    const [editorImage, setEditorImage] = useState<string | null>(null);
    const [editorMode, setEditorMode] = useState(false);
    type DrawTool = 'arrow' | 'rect' | 'circle' | 'text' | 'pen' | 'highlight';
    const [activeTool, setActiveTool] = useState<DrawTool>('arrow');
    const [toolColor, setToolColor] = useState('#ff3b3b');
    type DrawAction = { tool: DrawTool; color: string; points: number[]; text?: string };
    const [drawActions, setDrawActions] = useState<DrawAction[]>([]);
    const [currentDraw, setCurrentDraw] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
    const editorCanvasRef = useRef<HTMLCanvasElement>(null);
    const editorImgRef = useRef<HTMLImageElement | null>(null);

    // Screenshot selection state
    const [screenshotMode, setScreenshotMode] = useState(false);
    const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
    const [selEnd, setSelEnd] = useState<{ x: number; y: number } | null>(null);

    const hideMenu = useCallback(async () => {
        setVisible(false);
        setSubMenu(null);
        setScreenshotMode(false);
        setEditorMode(false);
        setEditorImage(null);
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
                    const { emit } = await import('@tauri-apps/api/event');
                    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
                    const mainWin = await WebviewWindow.getByLabel('main');
                    if (mainWin) {
                        await mainWin.show();
                        await mainWin.setFocus();
                    }
                    await emit('navigate-to', '/toolbox');
                } catch { /* ignore */ }
                break;
            case 'dictate':
                await hideMenu();
                break;
            case 'copypaste': {
                try {
                    // Get transcriptions
                    const entries = await invoke<{ id: number; text: string; timestamp: number }[]>('get_recent_transcriptions');
                    const transcriptions = entries.filter(e => e.text);

                    // Get current clipboard text
                    let clipboardItems: { id: number; text: string; timestamp: number }[] = [];
                    try {
                        const clipText = await navigator.clipboard.readText();
                        if (clipText && clipText.trim()) {
                            clipboardItems = [{ id: -1, text: clipText, timestamp: Math.floor(Date.now() / 1000) }];
                        }
                    } catch { /* clipboard access denied */ }

                    // Merge: clipboard first, then transcriptions (dedupe)
                    const merged = [...clipboardItems];
                    for (const t of transcriptions) {
                        if (!merged.some(m => m.text === t.text)) {
                            merged.push(t);
                        }
                    }

                    setHistoryEntries(merged);
                    if (merged.length > 0) {
                        setSubMenu('copypaste');
                        setSubSelectedIndex(0);
                    }
                } catch { /* ignore */ }
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
                // Convert absolute cursor coords to relative window coords
                // The radial window is positioned at the monitor's origin
                const winX = window.screenX || 0;
                const winY = window.screenY || 0;
                const scale = window.devicePixelRatio || 1;
                setCursorPos({
                    x: (pos[0] - winX) / scale,
                    y: (pos[1] - winY) / scale,
                });
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
                if (editorMode) {
                    setEditorMode(false);
                    setEditorImage(null);
                } else if (screenshotMode) {
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
                setSubSelectedIndex((prev) => ((prev + (e.deltaY > 0 ? 1 : -1)) % len + len) % len);
            } else if (subMenu === 'sites') {
                const len = radialConfig.sites.length;
                setSubSelectedIndex((prev) => ((prev + (e.deltaY > 0 ? 1 : -1)) % len + len) % len);
            } else if (subMenu === 'copypaste') {
                const len = historyEntries.length;
                if (len > 0) setSubSelectedIndex((prev) => ((prev + (e.deltaY > 0 ? 1 : -1)) % len + len) % len);
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

    const handleScreenshotMouseUp = useCallback(() => {
        if (!screenshotMode || !selStart || !selEnd || !bgImage) return;

        const x = Math.min(selStart.x, selEnd.x);
        const y = Math.min(selStart.y, selEnd.y);
        const w = Math.abs(selEnd.x - selStart.x);
        const h = Math.abs(selEnd.y - selStart.y);

        if (w > 10 && h > 10) {
            // Crop and open editor
            const img = new Image();
            img.onload = () => {
                const scaleX = img.width / window.innerWidth;
                const scaleY = img.height / window.innerHeight;
                const canvas = document.createElement('canvas');
                canvas.width = w * scaleX;
                canvas.height = h * scaleY;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(img, x * scaleX, y * scaleY, w * scaleX, h * scaleY, 0, 0, canvas.width, canvas.height);
                setEditorImage(canvas.toDataURL('image/png'));
                editorImgRef.current = null;
                setDrawActions([]);
                setCurrentDraw(null);
                setScreenshotMode(false);
                setEditorMode(true);
            };
            img.src = bgImage;
        } else {
            setSelStart(null);
            setSelEnd(null);
        }
    }, [screenshotMode, selStart, selEnd, bgImage]);

    if (!visible) return null;

    // ─── Screenshot Editor ─────────────────────────────────────────────────

    const renderEditorCanvas = useCallback(() => {
        const canvas = editorCanvasRef.current;
        if (!canvas || !editorImage) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = editorImgRef.current || new Image();
        if (!editorImgRef.current) {
            img.onload = () => {
                editorImgRef.current = img;
                renderEditorCanvas();
            };
            img.src = editorImage;
            return;
        }

        // Fit image in canvas area
        const maxW = window.innerWidth - 120;
        const maxH = window.innerHeight - 140;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Draw saved actions
        for (const action of drawActions) {
            drawActionOnCtx(ctx, action);
        }

        // Draw current action in progress
        if (currentDraw) {
            drawActionOnCtx(ctx, {
                tool: activeTool,
                color: toolColor,
                points: [currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY],
            });
        }
    }, [editorImage, drawActions, currentDraw, activeTool, toolColor]);

    useEffect(() => {
        if (editorMode) renderEditorCanvas();
    }, [editorMode, renderEditorCanvas]);

    const drawActionOnCtx = (ctx: CanvasRenderingContext2D, action: DrawAction) => {
        const [x1, y1, x2, y2] = action.points;
        ctx.strokeStyle = action.color;
        ctx.fillStyle = action.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        switch (action.tool) {
            case 'arrow': {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                // Arrowhead
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headLen = 15;
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
                ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'rect':
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                break;
            case 'circle': {
                const rx = Math.abs(x2 - x1) / 2;
                const ry = Math.abs(y2 - y1) / 2;
                const cx = Math.min(x1, x2) + rx;
                const cy = Math.min(y1, y2) + ry;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case 'highlight': {
                ctx.save();
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = action.color;
                ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
                ctx.restore();
                break;
            }
            case 'pen': {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                break;
            }
            case 'text': {
                ctx.font = 'bold 18px sans-serif';
                ctx.fillText(action.text || 'Texte', x1, y1);
                break;
            }
        }
    };

    const handleEditorMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeTool === 'text') {
            const text = prompt('Texte:');
            if (text) {
                setDrawActions((prev) => [...prev, { tool: 'text', color: toolColor, points: [x, y, x, y], text }]);
            }
            return;
        }
        setCurrentDraw({ startX: x, startY: y, endX: x, endY: y });
    }, [activeTool, toolColor]);

    const handleEditorMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!currentDraw) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeTool === 'pen') {
            setDrawActions((prev) => [...prev, {
                tool: 'pen', color: toolColor,
                points: [currentDraw.endX, currentDraw.endY, x, y],
            }]);
            setCurrentDraw((prev) => prev ? { ...prev, endX: x, endY: y } : null);
        } else {
            setCurrentDraw((prev) => prev ? { ...prev, endX: x, endY: y } : null);
        }
    }, [currentDraw, activeTool, toolColor]);

    const handleEditorMouseUp = useCallback(() => {
        if (!currentDraw) return;
        if (activeTool !== 'pen') {
            setDrawActions((prev) => [...prev, {
                tool: activeTool, color: toolColor,
                points: [currentDraw.startX, currentDraw.startY, currentDraw.endX, currentDraw.endY],
            }]);
        }
        setCurrentDraw(null);
    }, [currentDraw, activeTool, toolColor]);

    const copyEditorResult = useCallback(async () => {
        const canvas = editorCanvasRef.current;
        if (!canvas) return;
        canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                } catch { /* ignore */ }
            }
            await hideMenu();
        }, 'image/png');
    }, [hideMenu]);

    if (editorMode && editorImage) {
        const TOOLS: { id: DrawTool; icon: string; label: string }[] = [
            { id: 'arrow', icon: '➜', label: 'Fleche' },
            { id: 'rect', icon: '▭', label: 'Rectangle' },
            { id: 'circle', icon: '◯', label: 'Cercle' },
            { id: 'highlight', icon: '█', label: 'Surligneur' },
            { id: 'pen', icon: '✏', label: 'Crayon' },
            { id: 'text', icon: 'A', label: 'Texte' },
        ];
        const COLORS = ['#ff3b3b', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#ffffff'];

        return (
            <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[9999]">
                {/* Toolbar */}
                <div className="flex items-center gap-2 mb-3 bg-black/70 px-4 py-2 rounded-xl border border-white/10">
                    {/* Tools */}
                    {TOOLS.map((tool) => (
                        <button
                            key={tool.id}
                            onClick={() => setActiveTool(tool.id)}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                                activeTool === tool.id
                                    ? 'bg-sky-500/80 text-white scale-110'
                                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                            title={tool.label}
                        >
                            {tool.icon}
                        </button>
                    ))}

                    <div className="w-px h-6 bg-white/20 mx-1" />

                    {/* Colors */}
                    {COLORS.map((color) => (
                        <button
                            key={color}
                            onClick={() => setToolColor(color)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                                toolColor === color ? 'border-white scale-125' : 'border-transparent hover:scale-110'
                            }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}

                    <div className="w-px h-6 bg-white/20 mx-1" />

                    {/* Undo */}
                    <button
                        onClick={() => setDrawActions((prev) => prev.slice(0, -1))}
                        className="px-3 py-1 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 text-sm"
                        title="Annuler"
                    >
                        ↩ Undo
                    </button>

                    {/* Copy */}
                    <button
                        onClick={copyEditorResult}
                        className="px-4 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium"
                    >
                        Copier
                    </button>

                    {/* Close */}
                    <button
                        onClick={() => { setEditorMode(false); setEditorImage(null); }}
                        className="px-3 py-1 rounded-lg bg-white/10 text-white/60 hover:bg-red-500/30 hover:text-red-300 text-sm"
                    >
                        Fermer
                    </button>
                </div>

                {/* Canvas */}
                <canvas
                    ref={editorCanvasRef}
                    className="border border-white/20 rounded-lg cursor-crosshair max-w-[90vw] max-h-[80vh]"
                    onMouseDown={handleEditorMouseDown}
                    onMouseMove={handleEditorMouseMove}
                    onMouseUp={handleEditorMouseUp}
                />
            </div>
        );
    }

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
        // Clipboard sub-menu shows transcription history as a list
        if (subMenu === 'copypaste') {
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
                        className="absolute w-[420px]"
                        style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-3">
                            <button
                                className="w-10 h-10 rounded-full bg-black/80 border-2 border-sky-400 hover:bg-sky-800/60 flex items-center justify-center transition-all cursor-pointer animate-pulse"
                                style={{ boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)' }}
                                onClick={() => { setSubMenu(null); }}
                                title="Retour"
                            >
                                <span className="text-sky-300 text-lg font-bold">↩</span>
                            </button>
                            <span className="text-white font-medium text-sm">Copy / Paste — cliquer pour copier</span>
                        </div>

                        {/* Transcription entries */}
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {historyEntries.map((entry, i) => {
                                const isSelected = i === subSelectedIndex;
                                const timeAgo = (() => {
                                    const mins = Math.floor((Date.now() / 1000 - entry.timestamp) / 60);
                                    if (mins < 1) return 'maintenant';
                                    if (mins < 60) return `${mins}m`;
                                    return `${Math.floor(mins / 60)}h`;
                                })();
                                return (
                                    <button
                                        key={entry.id}
                                        className={`w-full text-left rounded-lg p-3 transition-all ${
                                            isSelected
                                                ? 'bg-sky-500/30 border border-sky-400 shadow-lg shadow-sky-500/20'
                                                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                        }`}
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(entry.text);
                                            setClipboardCopied(true);
                                            setTimeout(async () => {
                                                setClipboardCopied(false);
                                                await hideMenu();
                                            }, 500);
                                        }}
                                        onMouseEnter={() => setSubSelectedIndex(i)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                {entry.id === -1 && (
                                                    <span className="text-[10px] text-sky-400 font-bold uppercase">Clipboard actuel</span>
                                                )}
                                                {entry.id > 0 && (
                                                    <span className="text-[10px] text-orange-400/70 font-bold uppercase">Transcription</span>
                                                )}
                                                <p className="text-sm text-white line-clamp-2">{entry.text}</p>
                                            </div>
                                            <span className="text-xs text-white/40 shrink-0">{timeAgo}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {clipboardCopied && (
                            <div className="mt-3 text-center text-green-400 text-sm font-bold animate-pulse">
                                Copie!
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Apps / Sites sub-menu (circle layout)
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
                        const subRadius = 140;
                        const x = Math.cos(angle) * subRadius;
                        const y = Math.sin(angle) * subRadius;
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
