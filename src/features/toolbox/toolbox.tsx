import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Copy, Check, Search, Terminal, Monitor, Server, GitBranch, Container,
    Network, HardDrive, Shield, Cpu, ChevronRight, MessageSquareText,
    Camera, Scissors, ImageIcon
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Page } from '@/components/page';
import { Typography } from '@/components/typography';
import inspiralysLogo from '@/assets/inspiralys-logo.png';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
    id: number;
    timestamp: number;
    text: string;
}

interface CommandSnippet {
    label: string;
    command: string;
    description: string;
}

interface CommandCategory {
    id: string;
    name: string;
    icon: React.ElementType;
    color: string;
    snippets: CommandSnippet[];
}

interface Screenshot {
    id: number;
    timestamp: number;
    dataUrl: string;
    width: number;
    height: number;
}

type Tab = 'transcriptions' | 'commands' | 'screenshots';

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-white/10 transition-colors shrink-0"
            title="Copier"
        >
            {copied ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-white" />
            )}
        </button>
    );
}

// ─── Time Formatting ──────────────────────────────────────────────────────────

function formatTime(timestamp: number) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'A l\'instant';
    if (diffMins < 60) return `il y a ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `il y a ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `il y a ${diffDays}j`;
}

// ─── Tab: Transcriptions ─────────────────────────────────────────────────────

function TranscriptionsTab() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const entries = await invoke<HistoryEntry[]>('get_recent_transcriptions');
                setHistory(entries);
            } catch (e) {
                console.error('Failed to load history:', e);
            }
        };
        loadHistory();
        const unlistenPromise = listen('history-updated', () => { loadHistory(); });
        return () => { unlistenPromise.then((unlisten) => unlisten()); };
    }, []);

    return (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">
                Dernieres transcriptions — cliquer pour copier
            </p>
            {history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-md">
                    <MessageSquareText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Aucune transcription encore.
                    <br />
                    <span className="text-xs">Utilise ton raccourci pour dicter du texte.</span>
                </div>
            ) : (
                <div className="space-y-2">
                    {history.map((entry) => (
                        <div
                            key={entry.id}
                            className="rounded-md border border-border p-3 hover:bg-accent/50 transition-colors group"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white break-words">
                                        {entry.text === '' ? (
                                            <span className="italic text-muted-foreground text-xs">(Transcription vide)</span>
                                        ) : (
                                            entry.text
                                        )}
                                    </p>
                                    <span className="text-xs text-muted-foreground mt-1 block">
                                        {formatTime(entry.timestamp)}
                                    </span>
                                </div>
                                {entry.text && <CopyButton text={entry.text} />}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Tab: Commands ────────────────────────────────────────────────────────────

const COMMAND_CATEGORIES: CommandCategory[] = [
    {
        id: 'windows',
        name: 'Windows / PowerShell',
        icon: Monitor,
        color: 'text-blue-400',
        snippets: [
            { label: 'System Info', command: 'systeminfo', description: 'Infos completes du systeme' },
            { label: 'IP Config', command: 'ipconfig /all', description: 'Configuration reseau detaillee' },
            { label: 'Flush DNS', command: 'ipconfig /flushdns', description: 'Vider le cache DNS' },
            { label: 'SFC Scan', command: 'sfc /scannow', description: 'Verifier les fichiers systeme' },
            { label: 'DISM Repair', command: 'DISM /Online /Cleanup-Image /RestoreHealth', description: 'Reparer l\'image Windows' },
            { label: 'Check Disk', command: 'chkdsk C: /f /r', description: 'Verifier et reparer le disque' },
            { label: 'Disk Cleanup', command: 'cleanmgr /d C:', description: 'Nettoyage de disque' },
            { label: 'List Services', command: 'Get-Service | Where-Object {$_.Status -eq "Running"} | Sort-Object DisplayName', description: 'Services actifs' },
            { label: 'Startup Apps', command: 'Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location', description: 'Applications au demarrage' },
            { label: 'Installed Apps', command: 'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select DisplayName, DisplayVersion | Sort DisplayName', description: 'Liste des programmes installes' },
            { label: 'WiFi Passwords', command: 'netsh wlan show profiles | ForEach-Object { if ($_ -match "All User Profile\\s*:\\s*(.+)$") { $name=$Matches[1].Trim(); netsh wlan show profile name="$name" key=clear } }', description: 'Voir tous les mots de passe WiFi' },
            { label: 'Disk Usage', command: 'Get-PSDrive -PSProvider FileSystem | Select Name, @{N="Used(GB)";E={[math]::Round($_.Used/1GB,2)}}, @{N="Free(GB)";E={[math]::Round($_.Free/1GB,2)}}', description: 'Espace disque par lecteur' },
            { label: 'Kill Process', command: 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name, Id, CPU, @{N="RAM(MB)";E={[math]::Round($_.WorkingSet64/1MB)}}', description: 'Top 20 processus (CPU)' },
            { label: 'Network Test', command: 'Test-NetConnection -ComputerName 8.8.8.8 -Port 443 -InformationLevel Detailed', description: 'Test connectivite reseau' },
            { label: 'Temp Files', command: 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path "C:\\Windows\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue', description: 'Supprimer fichiers temporaires' },
            { label: 'Battery Report', command: 'powercfg /batteryreport /output "$env:USERPROFILE\\Desktop\\battery-report.html"', description: 'Rapport batterie (laptops)' },
            { label: 'Export Drivers', command: 'Export-WindowsDriver -Online -Destination "$env:USERPROFILE\\Desktop\\Drivers"', description: 'Exporter tous les drivers' },
        ],
    },
    {
        id: 'bash',
        name: 'Linux / Bash',
        icon: Terminal,
        color: 'text-green-400',
        snippets: [
            { label: 'System Info', command: 'uname -a && cat /etc/os-release', description: 'Info systeme et OS' },
            { label: 'Disk Usage', command: 'df -h', description: 'Espace disque' },
            { label: 'Memory', command: 'free -h', description: 'Utilisation memoire' },
            { label: 'Top Processes', command: 'ps aux --sort=-%mem | head -20', description: 'Top 20 processus (RAM)' },
            { label: 'Ports ouverts', command: 'ss -tulnp', description: 'Ports en ecoute' },
            { label: 'Find Large Files', command: 'find / -type f -size +500M -exec ls -lh {} \\; 2>/dev/null | sort -k5 -rh | head -20', description: 'Fichiers > 500 Mo' },
            { label: 'Network Info', command: 'ip addr show && ip route show', description: 'Config reseau' },
            { label: 'Service Status', command: 'systemctl list-units --type=service --state=running', description: 'Services actifs' },
            { label: 'System Logs', command: 'journalctl -p err --since "1 hour ago" --no-pager', description: 'Erreurs recentes' },
            { label: 'Update System', command: 'sudo apt update && sudo apt upgrade -y', description: 'Mettre a jour (Debian/Ubuntu)' },
            { label: 'User Logins', command: 'last -n 20', description: 'Derniers 20 logins' },
            { label: 'Crontab List', command: 'crontab -l 2>/dev/null; for user in $(cut -f1 -d: /etc/passwd); do echo "--- $user ---"; sudo crontab -u $user -l 2>/dev/null; done', description: 'Toutes les taches cron' },
        ],
    },
    {
        id: 'proxmox',
        name: 'Proxmox',
        icon: Server,
        color: 'text-orange-400',
        snippets: [
            { label: 'List VMs', command: 'qm list', description: 'Lister toutes les VMs' },
            { label: 'List LXC', command: 'pct list', description: 'Lister tous les conteneurs' },
            { label: 'VM Status', command: 'qm status <VMID>', description: 'Status d\'une VM' },
            { label: 'Start VM', command: 'qm start <VMID>', description: 'Demarrer une VM' },
            { label: 'Stop VM', command: 'qm stop <VMID>', description: 'Arreter une VM' },
            { label: 'Cluster Status', command: 'pvecm status', description: 'Status du cluster' },
            { label: 'Storage', command: 'pvesm status', description: 'Status stockage' },
            { label: 'Backup VM', command: 'vzdump <VMID> --storage <STORAGE> --mode snapshot --compress zstd', description: 'Backup snapshot' },
            { label: 'Restore VM', command: 'qmrestore /path/to/backup.vma <VMID>', description: 'Restaurer une VM' },
            { label: 'Node Resources', command: 'pvesh get /nodes/$(hostname)/status', description: 'Ressources du noeud' },
            { label: 'Task Log', command: 'pvesh get /nodes/$(hostname)/tasks --limit 10', description: 'Dernieres taches' },
        ],
    },
    {
        id: 'docker',
        name: 'Docker',
        icon: Container,
        color: 'text-cyan-400',
        snippets: [
            { label: 'Running', command: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', description: 'Conteneurs actifs' },
            { label: 'All Containers', command: 'docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}"', description: 'Tous les conteneurs' },
            { label: 'Images', command: 'docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"', description: 'Images locales' },
            { label: 'Logs', command: 'docker logs --tail 50 -f <CONTAINER>', description: 'Logs d\'un conteneur' },
            { label: 'Exec Shell', command: 'docker exec -it <CONTAINER> /bin/bash', description: 'Shell dans un conteneur' },
            { label: 'Compose Up', command: 'docker compose up -d', description: 'Demarrer la stack' },
            { label: 'Compose Down', command: 'docker compose down', description: 'Arreter la stack' },
            { label: 'Prune All', command: 'docker system prune -a --volumes', description: 'Nettoyer tout (attention!)' },
            { label: 'Stats', command: 'docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"', description: 'Ressources en temps reel' },
            { label: 'Inspect', command: 'docker inspect <CONTAINER> | jq ".[0].NetworkSettings.Networks"', description: 'Inspecter reseau conteneur' },
        ],
    },
    {
        id: 'git',
        name: 'Git',
        icon: GitBranch,
        color: 'text-purple-400',
        snippets: [
            { label: 'Status', command: 'git status', description: 'Status du repo' },
            { label: 'Log Pretty', command: 'git log --oneline --graph --all -20', description: 'Historique visuel' },
            { label: 'Diff', command: 'git diff --stat', description: 'Resume des changements' },
            { label: 'Stash', command: 'git stash push -m "WIP"', description: 'Mettre de cote' },
            { label: 'Stash Pop', command: 'git stash pop', description: 'Recuperer le stash' },
            { label: 'Undo Commit', command: 'git reset --soft HEAD~1', description: 'Annuler dernier commit' },
            { label: 'New Branch', command: 'git checkout -b feature/<NAME>', description: 'Creer une branche' },
            { label: 'Merge', command: 'git merge --no-ff <BRANCH>', description: 'Merger une branche' },
            { label: 'Clone Fast', command: 'git clone --depth 1 <URL>', description: 'Clone superficiel' },
            { label: 'Clean Branches', command: 'git fetch --prune && git branch -vv | grep "gone]" | awk "{print \\$1}" | xargs -r git branch -d', description: 'Supprimer branches mortes' },
        ],
    },
    {
        id: 'network',
        name: 'Reseau',
        icon: Network,
        color: 'text-yellow-400',
        snippets: [
            { label: 'Ping', command: 'ping -c 4 8.8.8.8', description: 'Test connectivite' },
            { label: 'Traceroute', command: 'tracert 8.8.8.8', description: 'Tracer la route (Windows)' },
            { label: 'DNS Lookup', command: 'nslookup <DOMAIN>', description: 'Resolution DNS' },
            { label: 'Port Scan', command: 'Test-NetConnection -ComputerName <IP> -Port <PORT>', description: 'Tester un port (PS)' },
            { label: 'ARP Table', command: 'arp -a', description: 'Table ARP locale' },
            { label: 'Netstat', command: 'netstat -ano | findstr LISTENING', description: 'Ports en ecoute (Windows)' },
            { label: 'Public IP', command: 'curl -s ifconfig.me', description: 'Mon IP publique' },
            { label: 'SSH Tunnel', command: 'ssh -L <LOCAL_PORT>:localhost:<REMOTE_PORT> user@<HOST>', description: 'Tunnel SSH local' },
        ],
    },
    {
        id: 'disk',
        name: 'Disques & Partitions',
        icon: HardDrive,
        color: 'text-rose-400',
        snippets: [
            { label: 'DiskPart', command: 'diskpart\nlist disk\nselect disk <N>\nclean\ncreate partition primary\nformat fs=ntfs quick\nassign', description: 'Formater un disque' },
            { label: 'Disk Info', command: 'Get-Disk | Format-Table Number, FriendlyName, Size, PartitionStyle', description: 'Info disques (PowerShell)' },
            { label: 'Partitions', command: 'Get-Partition | Format-Table DiskNumber, PartitionNumber, DriveLetter, Size, Type', description: 'Lister partitions' },
            { label: 'SMART Status', command: 'Get-PhysicalDisk | Select FriendlyName, MediaType, HealthStatus, OperationalStatus', description: 'Sante des disques' },
            { label: 'USB Devices', command: 'Get-PnpDevice -Class USB | Where-Object Status -eq "OK" | Select FriendlyName, InstanceId', description: 'Peripheriques USB' },
            { label: 'Fdisk (Linux)', command: 'sudo fdisk -l', description: 'Lister disques (Linux)' },
            { label: 'Bootable USB', command: 'dd if=<ISO> of=/dev/sdX bs=4M status=progress', description: 'Cle USB bootable (Linux)' },
        ],
    },
    {
        id: 'security',
        name: 'Securite',
        icon: Shield,
        color: 'text-red-400',
        snippets: [
            { label: 'Firewall Rules', command: 'Get-NetFirewallRule | Where-Object Enabled -eq True | Select DisplayName, Direction, Action | Sort DisplayName', description: 'Regles firewall actives' },
            { label: 'Open Ports', command: 'Get-NetTCPConnection -State Listen | Select LocalPort, OwningProcess, @{N="Process";E={(Get-Process -Id $_.OwningProcess).Name}} | Sort LocalPort', description: 'Ports ouverts' },
            { label: 'User List', command: 'Get-LocalUser | Select Name, Enabled, LastLogon', description: 'Utilisateurs locaux' },
            { label: 'Admin Group', command: 'Get-LocalGroupMember -Group "Administrators"', description: 'Membres Admin' },
            { label: 'Failed Logins', command: 'Get-WinEvent -FilterHashtable @{LogName="Security";Id=4625} -MaxEvents 20 | Select TimeCreated, Message', description: 'Connexions echouees' },
            { label: 'SSL Check', command: 'openssl s_client -connect <HOST>:443 -servername <HOST> 2>/dev/null | openssl x509 -noout -dates -subject', description: 'Verifier certificat SSL' },
        ],
    },
    {
        id: 'hardware',
        name: 'Hardware / BIOS',
        icon: Cpu,
        color: 'text-amber-400',
        snippets: [
            { label: 'CPU Info', command: 'Get-CimInstance Win32_Processor | Select Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed', description: 'Info processeur' },
            { label: 'RAM Info', command: 'Get-CimInstance Win32_PhysicalMemory | Select BankLabel, Capacity, Speed, Manufacturer | Format-Table', description: 'Barrettes RAM' },
            { label: 'GPU Info', command: 'Get-CimInstance Win32_VideoController | Select Name, DriverVersion, AdapterRAM', description: 'Carte graphique' },
            { label: 'Motherboard', command: 'Get-CimInstance Win32_BaseBoard | Select Manufacturer, Product, SerialNumber', description: 'Carte mere' },
            { label: 'BIOS', command: 'Get-CimInstance Win32_BIOS | Select Manufacturer, SMBIOSBIOSVersion, ReleaseDate', description: 'Version BIOS' },
            { label: 'Serial Number', command: 'Get-CimInstance Win32_BIOS | Select SerialNumber', description: 'Numero de serie PC' },
            { label: 'Product Key', command: '(Get-WmiObject -query "select * from SoftwareLicensingService").OA3xOriginalProductKey', description: 'Cle Windows OEM' },
        ],
    },
];

function CommandsTab() {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCategories = COMMAND_CATEGORIES.map((cat) => ({
        ...cat,
        snippets: cat.snippets.filter(
            (s) =>
                searchQuery === '' ||
                s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    })).filter((cat) => cat.snippets.length > 0);

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher une commande..."
                    className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-border rounded-md text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50"
                />
            </div>
            <div className="space-y-2">
                {filteredCategories.map((category) => (
                    <CategorySection key={category.id} category={category} />
                ))}
                {filteredCategories.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        Aucune commande trouvee pour "{searchQuery}"
                    </div>
                )}
            </div>
        </div>
    );
}

function CategorySection({ category }: { category: CommandCategory }) {
    const [expanded, setExpanded] = useState(false);
    const Icon = category.icon;

    return (
        <div className="border border-border rounded-md overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 px-4 py-3 w-full hover:bg-muted/30 transition-colors border-b border-border bg-muted/10"
            >
                <Icon className={`w-4 h-4 ${category.color}`} />
                <span className="font-medium text-sm text-white">{category.name}</span>
                <span className="text-xs text-muted-foreground ml-1">({category.snippets.length})</span>
                <ChevronRight
                    className={`ml-auto w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
                />
            </button>
            {expanded && (
                <div className="divide-y divide-border">
                    {category.snippets.map((snippet) => (
                        <div
                            key={snippet.label}
                            className="px-4 py-2.5 flex items-start gap-3 hover:bg-muted/20 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-white">{snippet.label}</span>
                                    <span className="text-xs text-muted-foreground">{snippet.description}</span>
                                </div>
                                <code className="text-xs text-sky-300/80 font-mono mt-1 block whitespace-pre-wrap break-all">
                                    {snippet.command}
                                </code>
                            </div>
                            <CopyButton text={snippet.command} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Tab: Screenshots ─────────────────────────────────────────────────────────

function ScreenshotsTab() {
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);
    const [selection, setSelection] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const nextIdRef = useRef(1);

    const startCapture = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: 'monitor' } as MediaTrackConstraints,
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            // Wait for video to have dimensions
            await new Promise((resolve) => setTimeout(resolve, 100));

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(video, 0, 0);

            // Stop the stream immediately
            stream.getTracks().forEach((track) => track.stop());
            video.srcObject = null;

            const dataUrl = canvas.toDataURL('image/png');
            setFullScreenImage(dataUrl);
            setIsCapturing(true);
        } catch {
            // User cancelled the screen picker
        }
    }, []);

    const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setSelection({ startX: x, startY: y, endX: x, endY: y });
    }, []);

    const handleOverlayMouseMove = useCallback((e: React.MouseEvent) => {
        if (!selection) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setSelection((prev) => prev ? { ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top } : null);
    }, [selection]);

    const handleOverlayMouseUp = useCallback(() => {
        if (!selection || !fullScreenImage) return;

        const x = Math.min(selection.startX, selection.endX);
        const y = Math.min(selection.startY, selection.endY);
        const w = Math.abs(selection.endX - selection.startX);
        const h = Math.abs(selection.endY - selection.startY);

        if (w < 10 || h < 10) {
            // Too small, capture full screenshot
            const newScreenshot: Screenshot = {
                id: nextIdRef.current++,
                timestamp: Math.floor(Date.now() / 1000),
                dataUrl: fullScreenImage,
                width: 1920,
                height: 1080,
            };
            setScreenshots((prev) => [newScreenshot, ...prev].slice(0, 20));
        } else {
            // Crop the selection
            const img = new Image();
            img.onload = () => {
                const scaleX = img.width / (overlayRef.current?.offsetWidth || img.width);
                const scaleY = img.height / (overlayRef.current?.offsetHeight || img.height);

                const canvas = document.createElement('canvas');
                canvas.width = w * scaleX;
                canvas.height = h * scaleY;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(img, x * scaleX, y * scaleY, w * scaleX, h * scaleY, 0, 0, canvas.width, canvas.height);

                const newScreenshot: Screenshot = {
                    id: nextIdRef.current++,
                    timestamp: Math.floor(Date.now() / 1000),
                    dataUrl: canvas.toDataURL('image/png'),
                    width: Math.round(canvas.width),
                    height: Math.round(canvas.height),
                };
                setScreenshots((prev) => [newScreenshot, ...prev].slice(0, 20));
            };
            img.src = fullScreenImage;
        }

        setSelection(null);
        setIsCapturing(false);
        setFullScreenImage(null);
    }, [selection, fullScreenImage]);

    const cancelCapture = useCallback(() => {
        setIsCapturing(false);
        setFullScreenImage(null);
        setSelection(null);
    }, []);

    const deleteScreenshot = useCallback((id: number) => {
        setScreenshots((prev) => prev.filter((s) => s.id !== id));
    }, []);

    // Capture overlay (fullscreen)
    if (isCapturing && fullScreenImage) {
        return (
            <div
                ref={overlayRef}
                className="fixed inset-0 z-[9999] cursor-crosshair"
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
                onKeyDown={(e) => { if (e.key === 'Escape') cancelCapture(); }}
                tabIndex={0}
                style={{ backgroundImage: `url(${fullScreenImage})`, backgroundSize: 'cover' }}
            >
                <div className="absolute inset-0 bg-black/30" />
                {selection && (
                    <div
                        className="absolute border-2 border-sky-400 bg-sky-400/10"
                        style={{
                            left: Math.min(selection.startX, selection.endX),
                            top: Math.min(selection.startY, selection.endY),
                            width: Math.abs(selection.endX - selection.startX),
                            height: Math.abs(selection.endY - selection.startY),
                        }}
                    />
                )}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-lg backdrop-blur-sm">
                    <Scissors className="w-4 h-4 inline-block mr-2" />
                    Selectionner une zone — Echap pour annuler
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <button
                onClick={startCapture}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-sky-800 via-sky-700 to-sky-800 hover:from-sky-600 hover:via-sky-500 hover:to-sky-600 text-white rounded-md transition-colors font-medium text-sm"
            >
                <Camera className="w-4 h-4" />
                Capture d'ecran
            </button>
            <p className="text-xs text-muted-foreground px-1">
                Captures sauvegardees en session — copier l'image avec le bouton
            </p>
            {screenshots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-md">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Aucune capture encore.
                    <br />
                    <span className="text-xs">Clique sur le bouton pour capturer ton ecran.</span>
                </div>
            ) : (
                <div className="space-y-3">
                    {screenshots.map((ss) => (
                        <div key={ss.id} className="border border-border rounded-md overflow-hidden">
                            <img
                                src={ss.dataUrl}
                                alt={`Capture ${ss.id}`}
                                className="w-full object-contain max-h-48 bg-black/20"
                            />
                            <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
                                <span className="text-xs text-muted-foreground">
                                    {ss.width}x{ss.height} — {formatTime(ss.timestamp)}
                                </span>
                                <div className="flex items-center gap-1">
                                    <CopyImageButton dataUrl={ss.dataUrl} />
                                    <button
                                        onClick={() => deleteScreenshot(ss.id)}
                                        className="p-1.5 rounded hover:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-400"
                                        title="Supprimer"
                                    >
                                        <span className="text-xs">x</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}

function CopyImageButton({ dataUrl }: { dataUrl: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Fallback: copy data URL as text
            await navigator.clipboard.writeText(dataUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Copier l'image"
        >
            {copied ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-white" />
            )}
        </button>
    );
}

// ─── Main Toolbox Component ───────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType; count?: string }[] = [
    { id: 'transcriptions', label: 'Transcriptions', icon: MessageSquareText },
    { id: 'commands', label: 'Commandes', icon: Terminal, count: String(COMMAND_CATEGORIES.reduce((a, c) => a + c.snippets.length, 0)) },
    { id: 'screenshots', label: 'Captures', icon: Camera },
];

export const Toolbox = () => {
    const [activeTab, setActiveTab] = useState<Tab>('transcriptions');

    return (
        <main className="space-y-4 relative">
            <Page.Header>
                <div className="flex items-center gap-3 pb-2">
                    <img
                        src={inspiralysLogo}
                        alt="Inspiralys"
                        className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div>
                        <Typography.MainTitle data-testid="toolbox-title" className="mb-0">
                            Toolbox
                        </Typography.MainTitle>
                        <p className="text-xs text-muted-foreground">
                            Centre de commandes Inspiralys V2C
                        </p>
                    </div>
                </div>
            </Page.Header>

            {/* Tab Bar */}
            <div className="flex gap-1 p-1 bg-muted/30 rounded-lg border border-border">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                                isActive
                                    ? 'bg-sky-700/60 text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-white hover:bg-muted/40'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                            {tab.count && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-muted/50'}`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'transcriptions' && <TranscriptionsTab />}
            {activeTab === 'commands' && <CommandsTab />}
            {activeTab === 'screenshots' && <ScreenshotsTab />}
        </main>
    );
};
