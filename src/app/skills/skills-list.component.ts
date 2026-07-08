import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { querySystems, PlaceSystem } from '@placeos/ts-client';
import { MatDialog } from '@angular/material/dialog';
import { AsyncHandler } from '../common/async-handler.class';
import { notifyError, notifySuccess } from '../common/notifications';
import { openConfirmModal } from '../overlays/confirm-modal.component';
import { IconComponent } from '../ui/icon.component';
import { SidebarMenuComponent } from '../ui/sidebar-menu.component';
import { SkillData } from './skills.types';
import { SkillsPersistenceService } from './skills-persistence.service';
import { SkillsStateService } from './skills-state.service';

@Component({
    selector: 'skills-list',
    template: `
        <!-- eslint-disable @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div class="bg-base-100 absolute inset-0 flex">
            <sidebar-menu class="sm:h-full"></sidebar-menu>
            <div class="flex h-full flex-1 flex-col overflow-hidden">
                <div class="border-base-200 flex items-center justify-between border-b px-6 py-4">
                    <h1 class="text-2xl font-semibold">Skills</h1>
                    <button
                        class="bg-secondary text-secondary-content flex items-center space-x-2 rounded-lg px-4 py-2"
                        matRipple
                        (click)="createNewSkill()"
                    >
                        <icon>add</icon>
                        <span>New Skill</span>
                    </button>
                </div>

                <div class="flex-1 overflow-auto p-6">
                    @if (skills().length === 0) {
                        <div
                            class="border-base-200 bg-base-100 flex flex-col items-center justify-center rounded-lg border p-12 text-center"
                        >
                            <icon class="text-base-content mb-4 text-6xl opacity-30"
                                >auto_awesome</icon
                            >
                            <h3 class="text-base-content mb-2 text-lg font-medium">
                                No Skills Yet
                            </h3>
                            <p class="text-base-content mb-4 max-w-md opacity-60">
                                Create your first automation skill. Skills let you build
                                visual workflows that connect inputs to outputs.
                            </p>
                            <button
                                class="bg-secondary text-secondary-content flex items-center space-x-2 rounded-lg px-6 py-3"
                                matRipple
                                (click)="createNewSkill()"
                            >
                                <icon>add</icon>
                                <span>Create First Skill</span>
                            </button>
                        </div>
                    } @else {
                        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            @for (skill of skills(); track skill.createdAt) {
                                <div
                                    class="border-base-200 bg-base-100 group relative cursor-pointer rounded-lg border p-4 transition-all hover:shadow-lg"
                                    matRipple
                                    (click)="openSkill(skill)"
                                >
                                    <div class="mb-2 flex items-start justify-between">
                                        <h3
                                            class="text-base-content flex-1 truncate font-medium"
                                            [class.opacity-50]="skill.enabled === false"
                                        >
                                            {{ skill.name }}
                                        </h3>
                                        @if (skill.enabled === false) {
                                            <span
                                                class="bg-base-200 text-base-content/60 mr-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                            >
                                                Disabled
                                            </span>
                                        }
                                        <button
                                            [matTooltip]="skill.enabled === false ? 'Enable skill' : 'Disable skill'"
                                            (click)="toggleSkillEnabled($event, skill)"
                                            [class]="skill.enabled === false ? 'text-base-content/30 hover:text-base-content/60' : 'text-green-600 hover:text-green-700'"
                                            class="transition-colors"
                                        >
                                            <icon class="text-2xl">{{ skill.enabled === false ? 'toggle_off' : 'toggle_on' }}</icon>
                                        </button>
                                    </div>
                                    <p
                                        class="text-base-content mb-3 line-clamp-2 text-sm opacity-60"
                                    >
                                        {{ skill.description }}
                                    </p>
                                    <div
                                        class="text-base-content flex items-center space-x-4 text-xs opacity-40"
                                    >
                                        <span>{{ skill.blocks?.length || 0 }} blocks</span>
                                        <span
                                            >{{ skill.connections?.length || 0 }}
                                            connections</span
                                        >
                                        @if (skill.trigger_id) {
                                            <span class="text-green-600 flex items-center gap-0.5 !opacity-100">
                                                <icon class="!text-sm">rocket_launch</icon>
                                                Deployed
                                            </span>
                                        }
                                    </div>
                                    <div class="mt-2 flex items-end justify-between">
                                        <div class="text-base-content text-xs opacity-30">
                                            @if (skill.system_name) {
                                                {{ skill.system_name }} ·
                                            }
                                            {{ formatDate(skill.createdAt) }}
                                        </div>
                                        <div class="flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <button
                                                matTooltip="Duplicate skill"
                                                (click)="duplicateSkill($event, skill)"
                                                class="text-base-content/50 hover:text-base-content p-1 transition-colors"
                                            >
                                                <icon>content_copy</icon>
                                            </button>
                                            <button
                                                matTooltip="Delete skill"
                                                (click)="deleteSkill($event, skill)"
                                                class="text-base-content/50 hover:text-red-600 p-1 transition-colors"
                                            >
                                                <icon>delete</icon>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            }
                        </div>
                    }
                </div>
            </div>

            <!-- System Selector Modal -->
            @if (show_system_selector()) {
                <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div class="bg-base-100 border border-base-200 rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                        <!-- Modal Header -->
                        <div class="p-6 border-b border-base-200">
                            <h2 class="text-xl font-semibold text-base-content">Select a System</h2>
                            <p class="text-sm text-base-content/60 mt-1">Choose which system this skill will be created for</p>
                        </div>

                        <!-- Search Input -->
                        <div class="p-4 border-b border-base-200">
                            <div class="relative">
                                <icon class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">search</icon>
                                <input
                                    type="text"
                                    [(ngModel)]="search_query"
                                    placeholder="Search systems..."
                                    class="w-full bg-base-200 border border-base-300 rounded-lg pl-10 pr-4 py-2 text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <!-- Modal Content -->
                        <div class="flex-1 overflow-y-auto p-6">
                            @if (loading_systems()) {
                                <div class="flex items-center justify-center py-12">
                                    <div class="text-base-content/60">Loading systems...</div>
                                </div>
                            } @else if (filtered_systems().length === 0) {
                                <div class="flex items-center justify-center py-12">
                                    <div class="text-center">
                                        <icon class="text-base-content/30 text-5xl mb-2">meeting_room</icon>
                                        <p class="text-base-content/60">No systems found</p>
                                    </div>
                                </div>
                            } @else {
                                <div class="space-y-2">
                                    @for (system of filtered_systems(); track system.id) {
                                        <div
                                            class="border rounded-lg p-3 cursor-pointer transition-all"
                                            [class.border-blue-500]="selected_system_id() === system.id"
                                            [class.bg-blue-500/10]="selected_system_id() === system.id"
                                            [class.border-base-300]="selected_system_id() !== system.id"
                                            [class.hover:bg-base-200]="selected_system_id() !== system.id"
                                            (click)="selected_system_id.set(system.id)"
                                        >
                                            <div class="flex items-center space-x-3">
                                                <div
                                                    class="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                                                    [class.border-blue-500]="selected_system_id() === system.id"
                                                    [class.border-base-300]="selected_system_id() !== system.id"
                                                >
                                                    @if (selected_system_id() === system.id) {
                                                        <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                                                    }
                                                </div>
                                                <div class="flex-1">
                                                    <div class="text-base-content font-medium">{{ system.name }}</div>
                                                    @if (system.description) {
                                                        <div class="text-xs text-base-content/60">{{ system.description }}</div>
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    }
                                </div>
                            }
                        </div>

                        <!-- Modal Footer -->
                        <div class="p-6 border-t border-base-200 flex items-center justify-end space-x-3">
                            <button
                                matRipple
                                (click)="cancelSystemSelection()"
                                class="px-4 py-2 text-base-content/60 hover:text-base-content transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                matRipple
                                (click)="confirmSystemSelection()"
                                [disabled]="!selected_system_id()"
                                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            }
        </div>
    `,
    styles: [
        `
            .line-clamp-2 {
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
        `,
    ],
    imports: [IconComponent, MatRippleModule, MatTooltipModule, SidebarMenuComponent, CommonModule, FormsModule],
})
export class SkillsListComponent extends AsyncHandler implements OnInit {
    public readonly skills = signal<SkillData[]>([]);
    public readonly show_system_selector = signal(false);
    public readonly systems = signal<PlaceSystem[]>([]);
    public readonly selected_system_id = signal<string>('');
    public readonly loading_systems = signal(false);
    public readonly search_query = signal<string>('');

    public readonly filtered_systems = computed(() => {
        const query = this.search_query().toLowerCase();
        if (!query) return this.systems();
        return this.systems().filter(system =>
            system.name.toLowerCase().includes(query) ||
            system.description?.toLowerCase().includes(query)
        );
    });

    private _router = inject(Router);
    private _skills_state = inject(SkillsStateService);
    private _persistence = inject(SkillsPersistenceService);
    private _dialog = inject(MatDialog);

    public readonly loading = signal(false);

    public ngOnInit(): void {
        this.loadSkills();
        this.loadSystems();
    }

    private async loadSkills(): Promise<void> {
        this.loading.set(true);
        try {
            this.skills.set(await this._persistence.loadAllSkills());
        } catch (e) {
            console.error('Failed to load skills', e);
            this.skills.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    private async loadSystems(): Promise<void> {
        this.loading_systems.set(true);
        try {
            const response = await firstValueFrom(querySystems({ limit: 500 }));
            this.systems.set(response.data);
        } catch (e) {
            console.error('Failed to load systems', e);
        } finally {
            this.loading_systems.set(false);
        }
    }

    public createNewSkill(): void {
        this.show_system_selector.set(true);
    }

    public cancelSystemSelection(): void {
        this.show_system_selector.set(false);
        this.selected_system_id.set('');
    }

    public confirmSystemSelection(): void {
        const system_id = this.selected_system_id();
        if (!system_id) return;

        const system = this.systems().find((s) => s.id === system_id);
        this._skills_state.clearWorkflow();
        this._skills_state.setSystemId(system_id, system?.name);
        this._skills_state.loadSystemModules(system_id);
        this.show_system_selector.set(false);
        this._router.navigate(['/skills', 'new']);
    }

    public openSkill(skill: SkillData): void {
        this._skills_state.loadSkill(skill);
        this._router.navigate(['/skills', skill.createdAt]);
    }

    public async toggleSkillEnabled(
        event: MouseEvent,
        skill: SkillData,
    ): Promise<void> {
        event.stopPropagation();
        const updated = { ...skill, enabled: !(skill.enabled ?? true) };
        this.skills.update((list) =>
            list.map((s) => (s.createdAt === skill.createdAt ? updated : s)),
        );
        await this._persistence.saveSkill(updated);
    }

    public async deleteSkill(
        event: MouseEvent,
        skill: SkillData,
    ): Promise<void> {
        event.stopPropagation();
        const details = await openConfirmModal(
            {
                title: 'Delete skill',
                content: `Delete the skill "${skill.name}"? This does not remove any trigger it was deployed to.`,
                confirm_text: 'Delete',
                icon: { content: 'delete' },
            },
            this._dialog,
        );
        if (details.reason !== 'done') return details.close();
        details.loading('Deleting skill...');
        try {
            await this._persistence.deleteSkill(skill);
            this.skills.update((list) =>
                list.filter((s) => s.createdAt !== skill.createdAt),
            );
            notifySuccess(`Deleted "${skill.name}"`);
        } catch (e) {
            notifyError('Failed to delete skill');
        }
        details.close();
    }

    public async duplicateSkill(
        event: MouseEvent,
        skill: SkillData,
    ): Promise<void> {
        event.stopPropagation();
        try {
            const copy = await this._persistence.duplicateSkill(skill);
            this.skills.update((list) => [...list, copy]);
            notifySuccess(`Created "${copy.name}"`);
        } catch (e) {
            notifyError('Failed to duplicate skill');
        }
    }

    public formatDate(iso_string: string): string {
        const date = new Date(iso_string);
        return date.toLocaleDateString();
    }
}
