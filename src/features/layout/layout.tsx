import { Outlet, useNavigate } from '@tanstack/react-router';
import { SidebarProvider, SidebarInset } from '../../components/sidebar';
import { AppSidebar } from './app-sidebar/app-sidebar';
import clsx from 'clsx';
import { useEffect } from 'react';
import { Bounce, ToastContainer } from 'react-toastify';
import { AccessibilityListener } from './listeners/accessibility-listener';
import { RecordingErrorListener } from './listeners/recording-error-listener';
import { LlmErrorListener } from './listeners/llm-error-listener';
import { ConfigImportedListener } from './listeners/config-imported-listener';
import { listen } from '@tauri-apps/api/event';

const NavigationListener = () => {
    const navigate = useNavigate();
    useEffect(() => {
        const unlisten = listen<string>('navigate-to', (event) => {
            navigate({ to: event.payload });
        });
        return () => { unlisten.then(u => u()); };
    }, [navigate]);
    return null;
};

export const Layout = () => {
    return (
        <SidebarProvider open={true} onOpenChange={() => {}} className="bg-background dark">
            <AccessibilityListener />
            <RecordingErrorListener />
            <LlmErrorListener />
            <ConfigImportedListener />
            <NavigationListener />
            <AppSidebar />
            <SidebarInset
                className={clsx('bg-background', 'text-white', 'pr-8', 'pt-8', 'flex', 'items-center', 'pl-[16rem]')}
            >
                <div className="max-w-[800px] w-full pb-12" data-testid="murmure-content">
                    <Outlet />
                </div>
            </SidebarInset>
            <ToastContainer
                position="bottom-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
                transition={Bounce}
            />
        </SidebarProvider>
    );
};
