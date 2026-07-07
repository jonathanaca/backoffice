import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AsyncHandler } from '../common/async-handler.class';
import { IconComponent } from '../ui/icon.component';
import { SidebarMenuComponent } from '../ui/sidebar-menu.component';
import { TranslatePipe } from '../ui/translate.pipe';
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
                            <div class="flex items-center space-x-2 bg-base-200 px-3 py-1 rounded-lg">
                                <span class="text-sm text-base-content/60">System:</span>
                                <span class="text-sm font-medium text-blue-600">{{ current_system_id() }}</span>
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
                </div>

                <div class="flex items-center space-x-2">
                    <!-- Execution Mode Toggle -->
                    <div class="flex items-center space-x-2 bg-base-200 rounded-lg p-1">
                        <button
                            [class]="execution_mode() === 'simulate' ? 'bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium' : 'text-base-content/60 px-3 py-1 rounded text-sm font-medium hover:text-base-content'"
                            (click)="setExecutionMode('simulate')"
                        >
                            {{ 'SKILLS.SIMULATE' | translate }}
                        </button>
                        <button
                            [class]="execution_mode() === 'production' ? 'bg-green-600 text-white px-3 py-1 rounded text-sm font-medium' : 'text-base-content/60 px-3 py-1 rounded text-sm font-medium hover:text-base-content'"
                            (click)="setExecutionMode('production')"
                        >
                            {{ 'SKILLS.PRODUCTION' | translate }}
                        </button>
                    </div>

                    <!-- Run Button -->
                    <button
                        matRipple
                        (click)="runWorkflow()"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                        <icon>play_arrow</icon>
                        <span>{{ 'SKILLS.RUN' | translate }}</span>
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
                        (click)="saveWorkflow()"
                        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                        <icon>save</icon>
                        <span>{{ 'SKILLS.SAVE' | translate }}</span>
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

    public readonly blocks = this._state.blocks;
    public readonly connections = this._state.connections;
    public readonly execution_mode = this._state.execution_mode;
    public readonly current_system_id = this._state.current_system_id;

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
                    this._state.loadSkillById(id);
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
    }

    public setExecutionMode(mode: 'simulate' | 'production'): void {
        this._state.setExecutionMode(mode);
    }

    public runWorkflow(): void {
        this._state.simulateWorkflow();
    }

    public clearWorkflow(): void {
        if (confirm('Are you sure you want to clear the entire workflow? This cannot be undone.')) {
            this._state.clearWorkflow();
        }
    }

    public saveWorkflow(): void {
        const current = this._state.current_skill();
        const name = prompt(
            'Enter a name for this workflow:',
            current?.name || '',
        );
        if (!name) return;

        const description =
            prompt(
                'Enter a description (optional):',
                current?.description || '',
            ) || '';

        const saved = this._state.saveSkill(name, description);
        if (this._route.snapshot.paramMap.get('id') === 'new') {
            this._router.navigate(['/skills', saved.createdAt], {
                replaceUrl: true,
            });
        }
    }
}
