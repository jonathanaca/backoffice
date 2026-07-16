import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('./reports.component').then(m => m.ReportsComponent),
        children: [
            {
                path: 'analytics',
                loadComponent: () => import('./reports-ai-analytics.component').then(m => m.ReportsAiAnalyticsComponent)
            },
            {
                path: 'benchmarking',
                loadComponent: () => import('./reports-benchmarking.component').then(m => m.ReportsBenchmarkingComponent)
            },
            {
                path: '',
                redirectTo: 'analytics',
                pathMatch: 'full'
            }
        ]
    }
];