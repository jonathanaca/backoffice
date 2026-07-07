import { Routes } from '@angular/router';

export const ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./skills-list.component').then(
                (m) => m.SkillsListComponent,
            ),
    },
    {
        path: ':id',
        loadComponent: () =>
            import('./skill-about.component').then(
                (m) => m.SkillAboutComponent,
            ),
    },
];
