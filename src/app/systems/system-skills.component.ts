import { Component, inject, OnInit, signal } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AsyncHandler } from '../common/async-handler.class';
import { ActiveItemService } from '../common/item.service';
import { IconComponent } from '../ui/icon.component';
import { SkillData } from '../skills/skills.types';
import { SkillsPersistenceService } from '../skills/skills-persistence.service';
import { SkillsStateService } from '../skills/skills-state.service';

@Component({
    selector: 'system-skills',
    template: `
        <!-- eslint-disable @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div class="h-full w-full overflow-auto p-4">
            <div class="mb-4 flex items-center justify-between">
                <h2 class="text-xl font-semibold">Skills for this System</h2>
                <button
                    class="bg-secondary text-secondary-content flex items-center space-x-2 rounded-lg px-4 py-2"
                    matRipple
                    (click)="createNewSkill()"
                >
                    <icon>add</icon>
                    <span>New Skill</span>
                </button>
            </div>

            @if (skills().length === 0) {
                <div
                    class="border-base-200 bg-base-100 flex flex-col items-center justify-center rounded-lg border p-12 text-center"
                >
                    <icon class="text-base-content mb-4 text-6xl opacity-30"
                        >automation</icon
                    >
                    <h3 class="text-base-content mb-2 text-lg font-medium">
                        No Skills Yet
                    </h3>
                    <p class="text-base-content mb-4 max-w-md opacity-60">
                        Create your first automation skill for this system.
                        Skills let you build visual workflows that connect
                        inputs to outputs.
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
                                >
                                    {{ skill.name }}
                                </h3>
                                <icon
                                    class="text-base-content opacity-0 transition-opacity group-hover:opacity-100"
                                    >chevron_right</icon
                                >
                            </div>
                            <p
                                class="text-base-content mb-3 line-clamp-2 text-sm opacity-60"
                            >
                                {{ skill.description }}
                            </p>
                            <div
                                class="text-base-content flex items-center space-x-4 text-xs opacity-40"
                            >
                                <span
                                    >{{ skill.blocks?.length || 0 }} blocks</span
                                >
                                <span
                                    >{{
                                        skill.connections?.length || 0
                                    }}
                                    connections</span
                                >
                            </div>
                            <div
                                class="text-base-content mt-2 text-xs opacity-30"
                            >
                                Created
                                {{ formatDate(skill.createdAt) }}
                            </div>
                        </div>
                    }
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
    imports: [IconComponent, MatRippleModule],
})
export class SystemSkillsComponent extends AsyncHandler implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _service = inject(ActiveItemService);
    private _skills = inject(SkillsStateService);
    private _persistence = inject(SkillsPersistenceService);

    public readonly system_id = signal<string>('');
    public readonly skills = signal<SkillData[]>([]);

    public ngOnInit(): void {
        this.subscription(
            'route',
            this._service.active_item$.subscribe((item) => {
                if (item?.id) {
                    this.system_id.set(item.id);
                    this.loadSkills();
                }
            }),
        );
    }

    private async loadSkills(): Promise<void> {
        try {
            this.skills.set(
                await this._persistence.loadSystemSkills(this.system_id()),
            );
        } catch (e) {
            console.error('Failed to load skills', e);
            this.skills.set([]);
        }
    }

    public createNewSkill(): void {
        const sys_id = this.system_id();
        if (!sys_id) return;

        this._skills.clearWorkflow();
        this._skills.setSystemId(sys_id, this._service.active_item?.name);
        this._router.navigate(['/skills', 'new'], {
            queryParams: { system_id: sys_id },
        });
    }

    public openSkill(skill: SkillData): void {
        this._skills.loadSkill(skill);
        this._router.navigate(['/skills', skill.createdAt], {
            queryParams: { system_id: skill.system_id },
        });
    }

    public formatDate(iso_string: string): string {
        const date = new Date(iso_string);
        return date.toLocaleDateString();
    }
}
