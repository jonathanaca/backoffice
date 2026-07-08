import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanDeactivateFn, Routes } from '@angular/router';
import { openConfirmModal } from '../overlays/confirm-modal.component';
import { SkillsStateService } from './skills-state.service';

/** Warn before navigating away from a workflow with unsaved changes */
const unsavedChangesGuard: CanDeactivateFn<unknown> = async () => {
    const state = inject(SkillsStateService);
    if (!state.dirty()) return true;
    const dialog = inject(MatDialog);
    const details = await openConfirmModal(
        {
            title: 'Unsaved changes',
            content:
                'This workflow has unsaved changes that will be lost if you leave. Leave anyway?',
            confirm_text: 'Leave',
            cancel_text: 'Stay',
            icon: { content: 'warning' },
        },
        dialog,
    );
    details.close();
    if (details.reason === 'done') {
        state.dirty.set(false);
        return true;
    }
    return false;
};

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
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
            import('./skill-about.component').then(
                (m) => m.SkillAboutComponent,
            ),
    },
];
