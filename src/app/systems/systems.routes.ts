import { Routes } from '@angular/router';

export const ROUTES: Routes = [
    {
        path: ':id',
        loadComponent: () =>
            import('./systems.component').then((m) => m.SystemsComponent),
        children: [
            {
                path: 'about',
                loadComponent: () =>
                    import('./system-about.component').then(
                        (m) => m.SystemAboutComponent,
                    ),
            },
            {
                path: 'modules',
                loadComponent: () =>
                    import('./system-modules.component').then(
                        (m) => m.SystemModulesComponent,
                    ),
            },
            {
                path: 'ai-configure',
                loadComponent: () =>
                    import('./system-ai-configure.component').then(
                        (m) => m.SystemAIConfigureComponent,
                    ),
            },
            {
                path: 'skills',
                loadComponent: () =>
                    import('./system-skills.component').then(
                        (m) => m.SystemSkillsComponent,
                    ),
            },
            {
                path: 'triggers',
                loadComponent: () =>
                    import('./system-triggers.component').then(
                        (m) => m.SystemTriggersComponent,
                    ),
            },
            {
                path: 'zones',
                loadComponent: () =>
                    import('./system-zones.component').then(
                        (m) => m.SystemZonesComponent,
                    ),
            },
            {
                path: 'metadata',
                loadComponent: () =>
                    import('./system-metadata.component').then(
                        (m) => m.SystemMetadataComponent,
                    ),
            },
            {
                path: 'extend/:id',
                loadComponent: () =>
                    import('../ui/extension-outlet.component').then(
                        (m) => m.ExtensionOutletComponent,
                    ),
            },
            {
                path: 'history',
                loadComponent: () =>
                    import('../ui/settings-history-view.component').then(
                        (m) => m.SettingsHistoryViewComponent,
                    ),
            },
            {
                path: 'reports',
                loadComponent: () =>
                    import('./system-reports.component').then(
                        (m) => m.SystemReportsComponent,
                    ),
            },
            { path: '**', redirectTo: 'about' },
        ],
    },
    { path: '**', redirectTo: '-' },
];
