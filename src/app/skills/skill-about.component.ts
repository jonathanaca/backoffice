import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { AsyncHandler } from '../common/async-handler.class';
import { HotkeysService } from '../common/hotkeys.service';
import { notifyError, notifySuccess } from '../common/notifications';
import { openConfirmModal } from '../overlays/confirm-modal.component';
import { IconComponent } from '../ui/icon.component';
import { SidebarMenuComponent } from '../ui/sidebar-menu.component';
import { TranslatePipe } from '../ui/translate.pipe';
import {
    SkillFormModalComponent,
    SkillFormModalData,
} from './skill-form-modal.component';
import { SkillsCanvasComponent } from './skills-canvas.component';
import { SkillsSidebarComponent } from './skills-sidebar.component';
import { SkillsSettingsPanelComponent } from './skills-settings-panel.component';
import { SkillsStateService } from './skills-state.service';

@Component({
    selector: 'skill-about',
    template: `
        <div class="bg-base-100 absolute inset-0 flex">
            <sidebar-menu class="sm:h-full"></sidebar-menu>
            <div class="h-full w-full flex flex-col flex-1">
                <!-- Toolbar -->
                <div class="bg-base-100 border-b border-base-200 px-4 py-3 flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <button
                            matRipple
                            (click)="goBack()"
                            class="text-base-content/60 hover:text-base-content transition-colors"
                        >
                            <icon>arrow_back</icon>
                        </button>
                        <h2 class="text-lg font-semibold text-base-content">Workflow Builder</h2>
                        @if (current_system_id()) {
                            <div
                                class="flex items-center space-x-2 bg-base-200 px-3 py-1 rounded-lg"
                                [matTooltip]="current_system_id()"
                            >
                                <icon class="text-base-content/40">meeting_room</icon>
                                <span class="text-sm font-medium text-base-content">{{ current_system_name() || current_system_id() }}</span>
                            </div>
                        }
                    <div class="flex items-center space-x-2">
                        <span class="text-sm text-base-content/60">{{ 'SKILLS.BLOCKS' | translate }}:</span>
                        <span class="text-sm font-medium text-base-content">{{ blocks().length }}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-sm text-base-content/60">{{ 'SKILLS.CONNECTIONS' | translate }}:</span>
                        <span class="text-sm font-medium text-base-content">{{ connections().length }}</span>
                    </div>

                    <!-- Validation Issues -->
                    @if (validation_issues().length) {
                        <button
                            class="flex items-center space-x-1 rounded-lg px-2 py-1 text-sm font-medium transition-colors"
                            [class]="has_errors() ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'"
                            [matTooltip]="issueSummary()"
                            matTooltipClass="whitespace-pre-line"
                            (click)="showIssues()"
                        >
                            <icon class="text-lg">{{ has_errors() ? 'error' : 'warning' }}</icon>
                            <span>{{ validation_issues().length }}</span>
                        </button>
                    }
                </div>

                <div class="flex items-center space-x-2">
                    <!-- Undo / Redo -->
                    <button
                        matRipple
                        [matTooltip]="'SKILLS.UNDO' | translate"
                        [disabled]="!can_undo()"
                        (click)="undo()"
                        class="text-base-content hover:bg-base-200 rounded-lg p-2 transition-colors disabled:opacity-30"
                    >
                        <icon>undo</icon>
                    </button>
                    <button
                        matRipple
                        [matTooltip]="'SKILLS.REDO' | translate"
                        [disabled]="!can_redo()"
                        (click)="redo()"
                        class="text-base-content hover:bg-base-200 rounded-lg p-2 transition-colors disabled:opacity-30"
                    >
                        <icon>redo</icon>
                    </button>

                    <div class="bg-base-200 h-6 w-px"></div>

                    <!-- Enabled Toggle -->
                    <button
                        matRipple
                        [matTooltip]="(skill_enabled() ? 'SKILLS.DISABLE' : 'SKILLS.ENABLE') | translate"
                        (click)="toggleEnabled()"
                        class="flex items-center space-x-1 rounded-lg px-2 py-1 transition-colors"
                        [class]="skill_enabled() ? 'text-success hover:bg-green-500/10' : 'text-base-content/40 hover:bg-base-200'"
                    >
                        <icon class="text-3xl">{{ skill_enabled() ? 'toggle_on' : 'toggle_off' }}</icon>
                        <span class="text-sm font-medium">{{ (skill_enabled() ? 'SKILLS.ENABLED' : 'SKILLS.DISABLED') | translate }}</span>
                    </button>

                    <div class="bg-base-200 h-6 w-px"></div>
                    <!-- Execution Mode Toggle -->
                    <div class="flex items-center space-x-2 bg-base-200 rounded-lg p-1">
                        <button
                            [class]="execution_mode() === 'simulate' ? 'bg-secondary text-secondary-content px-3 py-1 rounded text-sm font-medium' : 'text-base-content/60 px-3 py-1 rounded text-sm font-medium hover:text-base-content'"
                            (click)="setExecutionMode('simulate')"
                        >
                            {{ 'SKILLS.SIMULATE' | translate }}
                        </button>
                        <button
                            [class]="execution_mode() === 'production' ? 'bg-success text-success-content px-3 py-1 rounded text-sm font-medium' : 'text-base-content/60 px-3 py-1 rounded text-sm font-medium hover:text-base-content'"
                            (click)="setExecutionMode('production')"
                        >
                            {{ 'SKILLS.PRODUCTION' | translate }}
                        </button>
                    </div>

                    <!-- Run / Deploy Button -->
                    <button
                        matRipple
                        (click)="runWorkflow()"
                        class="bg-secondary text-secondary-content hover:opacity-90 px-4 py-2 rounded-lg text-sm font-medium transition-opacity flex items-center space-x-2"
                    >
                        <icon>{{ execution_mode() === 'production' ? 'rocket_launch' : 'play_arrow' }}</icon>
                        <span>{{ (execution_mode() === 'production' ? 'SKILLS.DEPLOY' : 'SKILLS.RUN') | translate }}</span>
                    </button>

                    <!-- Clear Button -->
                    <button
                        matRipple
                        [matTooltip]="'SKILLS.CLEAR_WORKFLOW' | translate"
                        (click)="clearWorkflow()"
                        class="bg-base-200 hover:bg-base-300 text-base-content px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        <icon>delete_sweep</icon>
                    </button>

                    <!-- Save Button -->
                    <button
                        matRipple
                        [matTooltip]="'SKILLS.SAVE_WORKFLOW' | translate"
                        [disabled]="saving()"
                        (click)="saveWorkflow()"
                        class="bg-success text-success-content hover:opacity-90 px-4 py-2 rounded-lg text-sm font-medium transition-opacity flex items-center space-x-2 disabled:opacity-50 relative"
                    >
                        <icon>save</icon>
                        <span>{{ 'SKILLS.SAVE' | translate }}</span>
                        @if (dirty()) {
                            <span class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-base-100"></span>
                        }
                    </button>
                </div>
            </div>

            <!-- Workflow Editor -->
            <div class="flex-1 flex overflow-hidden">
                <!-- Sidebar with blocks -->
                <skills-sidebar></skills-sidebar>

                <!-- Canvas -->
                <skills-canvas></skills-canvas>

                <!-- Settings Panel -->
                <skills-settings-panel></skills-settings-panel>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
            height: 100%;
            width: 100%;
        }
    `],
    imports: [
        CommonModule,
        SidebarMenuComponent,
        MatRippleModule,
        MatTooltipModule,
        IconComponent,
        TranslatePipe,
        SkillsCanvasComponent,
        SkillsSidebarComponent,
        SkillsSettingsPanelComponent,
    ],
})
export class SkillAboutComponent extends AsyncHandler implements OnInit {
    private _state = inject(SkillsStateService);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);
    private _hotkey = inject(HotkeysService);
    private _dialog = inject(MatDialog);

    public readonly blocks = this._state.blocks;
    public readonly connections = this._state.connections;
    public readonly execution_mode = this._state.execution_mode;
    public readonly current_system_id = this._state.current_system_id;
    public readonly current_system_name = this._state.current_system_name;
    public readonly validation_issues = this._state.validation_issues;
    public readonly skill_enabled = this._state.skill_enabled;
    public readonly can_undo = this._state.can_undo;
    public readonly can_redo = this._state.can_redo;
    public readonly dirty = this._state.dirty;
    public readonly saving = this._state.saving;

    public readonly has_errors = computed(() =>
        this.validation_issues().some((issue) => issue.level === 'error'),
    );

    public issueSummary(): string {
        return this.validation_issues()
            .map((issue) => `• ${issue.message}`)
            .join('\n');
    }

    public async showIssues(): Promise<void> {
        const details = await openConfirmModal(
            {
                title: 'Workflow issues',
                content: this.issueSummary(),
                confirm_text: 'OK',
                icon: { content: this.has_errors() ? 'error' : 'warning' },
            },
            this._dialog,
        );
        details.close();
    }

    public undo(): void {
        this._state.undo();
    }

    public redo(): void {
        this._state.redo();
    }

    public toggleEnabled(): void {
        this._state.setSkillEnabled(!this.skill_enabled());
    }

    public goBack(): void {
        this._router.navigate(['/skills']);
    }

    public ngOnInit(): void {
        // Restore the skill from storage on refresh/deep-link
        this.subscription(
            'route_id',
            this._route.paramMap.subscribe((params) => {
                const id = params.get('id');
                if (
                    id &&
                    id !== 'new' &&
                    this._state.current_skill()?.createdAt !== id
                ) {
                    const system_id =
                        this._route.snapshot.queryParams['system_id'];
                    this._state.loadSkillById(id, system_id);
                }
            }),
        );
        // Check for system_id in query params (when opening from system view)
        this.subscription(
            'route',
            this._route.queryParams.subscribe((params) => {
                const system_id = params['system_id'];
                if (system_id) {
                    this._state.setSystemId(system_id);
                    this._state.loadSystemModules(system_id);
                }
            }),
        );
        this.subscription(
            'undo',
            this._hotkey.listen(['Control', 'KeyZ'], () => this.undo()),
        );
        this.subscription(
            'redo',
            this._hotkey.listen(['Control', 'KeyY'], () => this.redo()),
        );
    }

    public setExecutionMode(mode: 'simulate' | 'production'): void {
        this._state.setExecutionMode(mode);
    }

    public async runWorkflow(): Promise<void> {
        if (this.execution_mode() === 'production') {
            return this.deployWorkflow();
        }
        const result = this._state.simulateWorkflow();
        const details = await openConfirmModal(
            {
                title: result.ok ? 'Simulation result' : 'Cannot run workflow',
                content: result.ok
                    ? result.summary
                    : result.errors.map((e) => `• ${e}`).join('\n'),
                confirm_text: 'OK',
                icon: {
                    content: result.ok ? 'play_arrow' : 'error',
                },
            },
            this._dialog,
        );
        details.close();
    }

    /** Compile the skill to a PlaceTrigger and attach it to the system */
    public async deployWorkflow(): Promise<void> {
        if (this.dirty() || !this._state.current_skill()) {
            notifyError('Save the skill before deploying it');
            return;
        }
        const { issues } = this._state.compileToTrigger();
        const skill = this._state.current_skill();
        const details = await openConfirmModal(
            {
                title: 'Deploy skill to system',
                content:
                    `This will ${skill?.trigger_id ? 'update the existing' : 'create a'} trigger on ` +
                    `"${this.current_system_name() || this.current_system_id()}" and enable it in production.` +
                    (issues.length
                        ? '\n\nNotes:\n' +
                          issues.map((i) => `• ${i}`).join('\n')
                        : ''),
                confirm_text: 'Deploy',
                icon: { content: 'rocket_launch' },
            },
            this._dialog,
        );
        if (details.reason !== 'done') return details.close();
        details.loading('Deploying skill...');
        try {
            const updated = await this._state.deploySkill();
            details.close();
            notifySuccess(
                `Skill deployed as trigger for "${updated.system_name || updated.system_id}"`,
            );
        } catch (e: any) {
            details.close();
            notifyError(e?.message || 'Failed to deploy skill');
        }
    }

    public clearWorkflow(): void {
        // Undoable, so no confirmation needed
        this._state.clearCanvas();
    }

    public async saveWorkflow(): Promise<void> {
        const current = this._state.current_skill();
        const ref = this._dialog.open<
            SkillFormModalComponent,
            SkillFormModalData,
            SkillFormModalData
        >(SkillFormModalComponent, {
            data: {
                name: current?.name || '',
                description: current?.description || '',
            },
        });
        const result = await firstValueFrom(ref.afterClosed());
        if (!result?.name) return;

        try {
            const saved = await this._state.saveSkill(
                result.name,
                result.description,
            );
            notifySuccess(`Saved "${saved.name}"`);
            if (this._route.snapshot.paramMap.get('id') === 'new') {
                this._router.navigate(['/skills', saved.createdAt], {
                    replaceUrl: true,
                });
            }
        } catch (e: any) {
            notifyError(e?.message || 'Failed to save skill');
        }
    }
}
