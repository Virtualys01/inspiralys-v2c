import { useState, useEffect } from 'react';
import { Plus, Trash2, Globe, AppWindow, GripVertical } from 'lucide-react';
import { Page } from '@/components/page';
import { Typography } from '@/components/typography';
import { SettingsUI } from '@/components/settings-ui';
import inspiralysLogo from '@/assets/inspiralys-logo.png';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadialSiteItem {
    label: string;
    url: string;
}

export interface RadialAppItem {
    label: string;
    command: string;
}

export interface RadialConfig {
    sites: RadialSiteItem[];
    apps: RadialAppItem[];
}

const MAX_ITEMS = 8;

const STORAGE_KEY = 'inspiralys-radial-config';

// ─── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RadialConfig = {
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

// ─── Load/Save ────────────────────────────────────────────────────────────────

export function loadRadialConfig(): RadialConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as RadialConfig;
            return {
                sites: parsed.sites || DEFAULT_CONFIG.sites,
                apps: parsed.apps || DEFAULT_CONFIG.apps,
            };
        }
    } catch { /* ignore */ }
    return DEFAULT_CONFIG;
}

function saveRadialConfig(config: RadialConfig) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ─── Editable Item Row ────────────────────────────────────────────────────────

function SiteRow({ item, onChange, onDelete }: {
    item: RadialSiteItem;
    onChange: (item: RadialSiteItem) => void;
    onDelete: () => void;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 group">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            <input
                type="text"
                value={item.label}
                onChange={(e) => onChange({ ...item, label: e.target.value })}
                placeholder="Nom"
                className="w-28 bg-transparent border border-border rounded px-2 py-1 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-sky-500/50"
            />
            <input
                type="text"
                value={item.url}
                onChange={(e) => onChange({ ...item, url: e.target.value })}
                placeholder="https://..."
                className="flex-1 bg-transparent border border-border rounded px-2 py-1 text-sm text-white font-mono placeholder:text-muted-foreground focus:outline-none focus:border-sky-500/50"
            />
            <button
                onClick={onDelete}
                className="p-1 rounded hover:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100"
                title="Supprimer"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

function AppRow({ item, onChange, onDelete }: {
    item: RadialAppItem;
    onChange: (item: RadialAppItem) => void;
    onDelete: () => void;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 group">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            <input
                type="text"
                value={item.label}
                onChange={(e) => onChange({ ...item, label: e.target.value })}
                placeholder="Nom"
                className="w-28 bg-transparent border border-border rounded px-2 py-1 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-sky-500/50"
            />
            <input
                type="text"
                value={item.command}
                onChange={(e) => onChange({ ...item, command: e.target.value })}
                placeholder="app.exe ou chemin complet"
                className="flex-1 bg-transparent border border-border rounded px-2 py-1 text-sm text-white font-mono placeholder:text-muted-foreground focus:outline-none focus:border-sky-500/50"
            />
            <button
                onClick={onDelete}
                className="p-1 rounded hover:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100"
                title="Supprimer"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const RadialMenuConfig = () => {
    const [config, setConfig] = useState<RadialConfig>(DEFAULT_CONFIG);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setConfig(loadRadialConfig());
    }, []);

    const save = (newConfig: RadialConfig) => {
        setConfig(newConfig);
        saveRadialConfig(newConfig);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    // Sites
    const updateSite = (index: number, item: RadialSiteItem) => {
        const newSites = [...config.sites];
        newSites[index] = item;
        save({ ...config, sites: newSites });
    };

    const addSite = () => {
        if (config.sites.length >= MAX_ITEMS) return;
        save({ ...config, sites: [...config.sites, { label: '', url: '' }] });
    };

    const deleteSite = (index: number) => {
        save({ ...config, sites: config.sites.filter((_, i) => i !== index) });
    };

    // Apps
    const updateApp = (index: number, item: RadialAppItem) => {
        const newApps = [...config.apps];
        newApps[index] = item;
        save({ ...config, apps: newApps });
    };

    const addApp = () => {
        if (config.apps.length >= MAX_ITEMS) return;
        save({ ...config, apps: [...config.apps, { label: '', command: '' }] });
    };

    const deleteApp = (index: number) => {
        save({ ...config, apps: config.apps.filter((_, i) => i !== index) });
    };

    const resetAll = () => {
        save(DEFAULT_CONFIG);
    };

    return (
        <main className="space-y-4 relative">
            <Page.Header>
                <div className="flex items-center gap-3 pb-2">
                    <img src={inspiralysLogo} alt="Inspiralys" className="w-10 h-10 rounded-lg object-cover" />
                    <div>
                        <Typography.MainTitle data-testid="radial-config-title" className="mb-0">
                            Radial Menu
                        </Typography.MainTitle>
                        <p className="text-xs text-muted-foreground">
                            Configure les sites et applications du menu radial
                            {saved && <span className="text-green-400 ml-2">Sauvegarde!</span>}
                        </p>
                    </div>
                </div>
            </Page.Header>

            {/* Sites */}
            <SettingsUI.Section title="Sites rapides" icon={Globe}>
                <div className="divide-y divide-border">
                    {config.sites.map((site, i) => (
                        <SiteRow
                            key={i}
                            item={site}
                            onChange={(item) => updateSite(i, item)}
                            onDelete={() => deleteSite(i)}
                        />
                    ))}
                </div>
                {config.sites.length < MAX_ITEMS && (
                    <div className="px-3 py-2">
                        <button
                            onClick={addSite}
                            className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Ajouter un site ({config.sites.length}/{MAX_ITEMS})
                        </button>
                    </div>
                )}
            </SettingsUI.Section>

            {/* Apps */}
            <SettingsUI.Section title="Applications rapides" icon={AppWindow}>
                <div className="divide-y divide-border">
                    {config.apps.map((app, i) => (
                        <AppRow
                            key={i}
                            item={app}
                            onChange={(item) => updateApp(i, item)}
                            onDelete={() => deleteApp(i)}
                        />
                    ))}
                </div>
                {config.apps.length < MAX_ITEMS && (
                    <div className="px-3 py-2">
                        <button
                            onClick={addApp}
                            className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Ajouter une application ({config.apps.length}/{MAX_ITEMS})
                        </button>
                    </div>
                )}
            </SettingsUI.Section>

            {/* Reset */}
            <div className="flex justify-end">
                <button
                    onClick={resetAll}
                    className="text-xs text-muted-foreground hover:text-white transition-colors px-3 py-1.5 border border-border rounded hover:bg-muted/30"
                >
                    Reinitialiser par defaut
                </button>
            </div>

            {/* Tips */}
            <div className="border border-border rounded-md p-4 bg-muted/10">
                <p className="text-sm text-white font-medium mb-2">Astuces</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                    <li>Maximum {MAX_ITEMS} items par categorie (pour rester lisible)</li>
                    <li>Pour les apps: utilise le nom du .exe (ex: <code className="text-sky-300">notepad.exe</code>) ou le chemin complet</li>
                    <li>Pour les sites: commence par <code className="text-sky-300">https://</code></li>
                    <li>Raccourci radial menu configurable dans Settings → Shortcuts</li>
                    <li>Clic du centre = retour au menu principal</li>
                </ul>
            </div>
        </main>
    );
};
