import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../ui/icon.component';
import { TranslatePipe } from '../ui/translate.pipe';
import { ModuleFunction, SkillsStateService } from './skills-state.service';
import { WorkflowBlock } from './skills.types';

@Component({
    selector: 'skills-settings-panel',
    template: `
        <div class="w-72 bg-base-100 border-l border-base-200 flex flex-col overflow-hidden">
            @if (selected_block(); as block) {
                <!-- Panel Header -->
                <div class="p-4 border-b border-base-200">
                    <div class="flex items-center justify-between mb-2">
                        <h2 class="text-lg font-semibold text-base-content">{{ 'SKILLS.SETTINGS' | translate }}</h2>
                        <button
                            (click)="closePanel()"
                            class="text-base-content/60 hover:text-base-content"
                        >
                            <icon>close</icon>
                        </button>
                    </div>
                    <div class="flex items-center space-x-2 text-sm">
                        <icon [class]="getBlockIconColor(block.type)">{{ getBlockIcon(block.category) }}</icon>
                        <span class="text-base-content/80">{{ block.category }}</span>
                        <span class="text-base-content/50 capitalize">({{ block.type }})</span>
                    </div>

                </div>

                <!-- Settings Content -->
                <div class="flex-1 overflow-y-auto p-4">
                    <!-- Module Binding -->
                    @if (block.type === 'input' || block.type === 'output') {
                        <div class="mb-6">
                            <h3 class="text-sm font-semibold text-base-content mb-3">{{ 'SKILLS.MODULE_BINDING' | translate }}</h3>

                            <div class="mb-4">
                                <label for="binding-module" class="block text-xs font-medium text-base-content/60 mb-1">
                                    {{ 'SKILLS.SOURCE_MODULE' | translate }}
                                </label>
                                <select
                                    id="binding-module"
                                    [value]="block.binding?.mod || ''"
                                    (change)="setBindingModule($event, block)"
                                    class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="">{{ 'SKILLS.NO_MODULE' | translate }}</option>
                                    @for (mod of available_modules(); track mod.id) {
                                        <option [value]="mod.mod" [selected]="mod.mod === block.binding?.mod">{{ mod.mod }}</option>
                                    }
                                </select>
                                @if (!available_modules().length) {
                                    <p class="text-xs text-amber-600 mt-1">{{ 'SKILLS.NO_MODULES_IN_SYSTEM' | translate }}</p>
                                }
                            </div>

                            @if (block.binding?.mod; as mod_ref) {
                                @if (block.type === 'input') {
                                    <div class="mb-4">
                                        <label for="binding-status" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.STATUS_VARIABLE' | translate }}
                                        </label>
                                        @if (statusesFor(mod_ref); as statuses) {
                                            @if (statuses.length) {
                                                <select
                                                    id="binding-status"
                                                    [value]="block.binding?.status || ''"
                                                    (change)="setBindingField($event, block, 'status')"
                                                    class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                                >
                                                    <option value="">—</option>
                                                    @for (status of statuses; track status) {
                                                        <option [value]="status" [selected]="status === block.binding?.status">{{ status }}</option>
                                                    }
                                                </select>
                                            } @else {
                                                <input
                                                    id="binding-status"
                                                    type="text"
                                                    [value]="block.binding?.status || ''"
                                                    (change)="setBindingField($event, block, 'status')"
                                                    placeholder="presence"
                                                    class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                                />
                                                <p class="text-xs text-base-content/50 mt-1">{{ 'SKILLS.STATUS_MANUAL_HINT' | translate }}</p>
                                            }
                                        } @else {
                                            <div class="text-xs text-base-content/50 py-2">{{ 'SKILLS.LOADING' | translate }}</div>
                                        }
                                    </div>
                                } @else {
                                    <div class="mb-4">
                                        <label for="binding-method" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.FUNCTION' | translate }}
                                        </label>
                                        @if (functionsFor(mod_ref); as functions) {
                                            @if (functions.length) {
                                                <select
                                                    id="binding-method"
                                                    [value]="block.binding?.method || ''"
                                                    (change)="setBindingField($event, block, 'method')"
                                                    class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                                >
                                                    <option value="">—</option>
                                                    @for (fn of functions; track fn.name) {
                                                        <option [value]="fn.name" [selected]="fn.name === block.binding?.method">{{ fn.name }}({{ fn.params.join(', ') }})</option>
                                                    }
                                                </select>
                                            } @else {
                                                <input
                                                    id="binding-method"
                                                    type="text"
                                                    [value]="block.binding?.method || ''"
                                                    (change)="setBindingField($event, block, 'method')"
                                                    placeholder="power"
                                                    class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                                />
                                                <p class="text-xs text-base-content/50 mt-1">{{ 'SKILLS.FUNCTION_MANUAL_HINT' | translate }}</p>
                                            }
                                        } @else {
                                            <div class="text-xs text-base-content/50 py-2">{{ 'SKILLS.LOADING' | translate }}</div>
                                        }
                                    </div>

                                    <div class="mb-4">
                                        <label for="binding-args" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.FUNCTION_ARGS' | translate }}
                                        </label>
                                        <textarea
                                            id="binding-args"
                                            rows="2"
                                            [value]="argsJson(block)"
                                            (change)="setBindingArgs($event, block)"
                                            placeholder='{ "state": true }'
                                            class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded font-mono text-xs text-base-content focus:border-blue-500 focus:outline-none resize-none"
                                        ></textarea>
                                        @if (args_error()) {
                                            <p class="text-xs text-red-600 mt-1">{{ args_error() }}</p>
                                        }
                                    </div>
                                }
                            }
                        </div>
                    }

                    <!-- Common Settings -->
                    <div class="mb-6">
                        <h3 class="text-sm font-semibold text-base-content mb-3">{{ 'SKILLS.COMMON_SETTINGS' | translate }}</h3>

                        <!-- Block Name/Category -->
                        <div class="mb-4">
                            <label for="skill-setting-1" class="block text-xs font-medium text-base-content/60 mb-1">
                                {{ 'SKILLS.BLOCK_NAME' | translate }}
                            </label>
                            <input
                                id="skill-setting-1"
                                type="text"
                                [value]="block.category"
                                disabled
                                class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content opacity-50 cursor-not-allowed"
                            />
                        </div>

                        <!-- Comments -->
                        <div class="mb-4">
                            <label for="skill-setting-2" class="block text-xs font-medium text-base-content/60 mb-1">
                                {{ 'SKILLS.COMMENTS' | translate }}
                            </label>
                            <textarea
                                id="skill-setting-2"
                                [value]="block.comments || ''"
                                (input)="updateComments($event, block.id)"
                                rows="3"
                                class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none resize-none"
                                placeholder="Add notes about this block..."
                            ></textarea>
                        </div>
                    </div>

                    <!-- Block-specific Settings -->
                    <div>
                        <h3 class="text-sm font-semibold text-base-content mb-3">{{ 'SKILLS.BLOCK_SETTINGS' | translate }}</h3>

                        @switch (block.type) {
                            @case ('input') {
                                <div class="space-y-4">
                                    <!-- Threshold -->
                                    <div>
                                        <label for="skill-setting-3" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.THRESHOLD' | translate }}
                                        </label>
                                        <input
                                id="skill-setting-3"
                                            type="number"
                                            [value]="getSettingValue(block, 'threshold', 1)"
                                            (input)="updateSetting($event, block.id, 'threshold')"
                                            class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>

                                    <!-- Condition -->
                                    <div>
                                        <label for="skill-setting-4" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.CONDITION' | translate }}
                                        </label>
                                        <select
                                id="skill-setting-4"
                                            [value]="getSettingValue(block, 'condition', 'greater_than')"
                                            (change)="updateSetting($event, block.id, 'condition')"
                                            class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="greater_than">Greater than</option>
                                            <option value="less_than">Less than</option>
                                            <option value="equals">Equals</option>
                                        </select>
                                    </div>

                                    <!-- Simulated Count -->
                                    <div>
                                        <label for="skill-setting-5" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.SIMULATED_COUNT' | translate }}
                                        </label>
                                        <input
                                id="skill-setting-5"
                                            type="number"
                                            [value]="getSettingValue(block, 'simulatedCount', 2)"
                                            (input)="updateSetting($event, block.id, 'simulatedCount')"
                                            class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                        />
                                        <p class="text-xs text-base-content/50 mt-1">For testing purposes</p>
                                    </div>
                                </div>
                            }
                            @case ('output') {
                                <div class="space-y-4">
                                    <!-- Action -->
                                    <div>
                                        <label for="skill-setting-6" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.ACTION' | translate }}
                                        </label>
                                        <select
                                id="skill-setting-6"
                                            [value]="getSettingValue(block, 'action', 'turn_on')"
                                            (change)="updateSetting($event, block.id, 'action')"
                                            class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="turn_on">Turn On</option>
                                            <option value="turn_off">Turn Off</option>
                                            <option value="toggle">Toggle</option>
                                            <option value="set_value">Set Value</option>
                                        </select>
                                    </div>

                                    <!-- Value (if action is set_value) -->
                                    @if (getSettingValue(block, 'action', 'turn_on') === 'set_value') {
                                        <div>
                                            <label for="skill-setting-7" class="block text-xs font-medium text-base-content/60 mb-1">
                                                {{ 'SKILLS.VALUE' | translate }}
                                            </label>
                                            <input
                                id="skill-setting-7"
                                                type="text"
                                                [value]="getSettingValue(block, 'value', '')"
                                                (input)="updateSetting($event, block.id, 'value')"
                                                class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                    }
                                </div>
                            }
                            @case ('logic') {
                                <div class="space-y-4">
                                    <!-- Logic Type -->
                                    <div>
                                        <label for="skill-setting-8" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.LOGIC_TYPE' | translate }}
                                        </label>
                                        <select
                                id="skill-setting-8"
                                            [value]="getSettingValue(block, 'logicType', 'if_then')"
                                            (change)="updateSetting($event, block.id, 'logicType')"
                                            class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="if_then">If Then</option>
                                            <option value="and">AND</option>
                                            <option value="or">OR</option>
                                            <option value="not">NOT</option>
                                        </select>
                                    </div>
                                </div>
                            }
                            @case ('agent') {
                                <div class="space-y-4">
                                    <!-- Agent Prompt -->
                                    <div>
                                        <label for="skill-setting-9" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.AGENT_PROMPT' | translate }}
                                        </label>
                                        <textarea
                                id="skill-setting-9"
                                            [value]="getSettingValue(block, 'prompt', '')"
                                            (input)="updateSetting($event, block.id, 'prompt')"
                                            rows="5"
                                            class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none resize-none"
                                            placeholder="Describe what the AI agent should do..."
                                        ></textarea>
                                    </div>
                                </div>
                            }
                            @case ('communication') {
                                <div class="space-y-4">
                                    <!-- Message Template -->
                                    <div>
                                        <label for="skill-setting-10" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.MESSAGE_TEMPLATE' | translate }}
                                        </label>
                                        <textarea
                                id="skill-setting-10"
                                            [value]="getSettingValue(block, 'message', '')"
                                            (input)="updateSetting($event, block.id, 'message')"
                                            rows="4"
                                            class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none resize-none"
                                            placeholder="Enter message template..."
                                        ></textarea>
                                    </div>

                                    <!-- Recipients -->
                                    <div>
                                        <label for="skill-setting-11" class="block text-xs font-medium text-base-content/60 mb-1">
                                            {{ 'SKILLS.RECIPIENTS' | translate }}
                                        </label>
                                        <input
                                id="skill-setting-11"
                                            type="text"
                                            [value]="getSettingValue(block, 'recipients', '')"
                                            (input)="updateSetting($event, block.id, 'recipients')"
                                            class="w-full px-3 py-2 bg-base-200 border border-base-300 rounded text-sm text-base-content focus:border-blue-500 focus:outline-none"
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                </div>
                            }
                        }
                    </div>
                </div>

                <!-- Panel Footer -->
                <div class="p-4 border-t border-base-200">
                    <button
                        (click)="deleteBlock(block.id)"
                        class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                    >
                        <div class="flex items-center justify-center space-x-2">
                            <icon>delete</icon>
                            <span>{{ 'SKILLS.DELETE_BLOCK' | translate }}</span>
                        </div>
                    </button>
                </div>
            } @else {
                <!-- Empty State -->
                <div class="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <icon class="text-base-300 text-5xl mb-2">settings</icon>
                    <p class="text-sm text-base-content/50">{{ 'SKILLS.SELECT_BLOCK_TO_CONFIGURE' | translate }}</p>
                </div>
            }
        </div>
    `,
    styles: [``],
    imports: [CommonModule, FormsModule, IconComponent, TranslatePipe],
})
export class SkillsSettingsPanelComponent {
    private _state = inject(SkillsStateService);

    public readonly selected_block = this._state.selected_block;
    public readonly available_modules = this._state.available_modules;
    public readonly args_error = signal('');

    constructor() {
        // Load the binding options whenever the selection points at a module
        effect(() => {
            const block = this.selected_block();
            const mod = block?.binding?.mod;
            if (!mod) return;
            if (block.type === 'input') this._state.loadModuleStatuses(mod);
            if (block.type === 'output') this._state.loadModuleFunctions(mod);
        });
    }

    public closePanel(): void {
        this._state.selectBlock(null);
    }

    /** Status variables for a module, undefined while loading */
    public statusesFor(mod: string): string[] | undefined {
        return this._state.module_statuses()[mod];
    }

    /** Functions for a module, undefined while loading */
    public functionsFor(mod: string): ModuleFunction[] | undefined {
        return this._state.module_functions()[mod];
    }

    public setBindingModule(event: Event, block: WorkflowBlock): void {
        const mod = (event.target as HTMLSelectElement).value;
        const module = this.available_modules().find((m) => m.mod === mod);
        const binding = module
            ? {
                  module_id: module.id,
                  mod: module.mod,
                  module_name: module.custom_name || module.name,
              }
            : null;
        this._updateBinding(block, binding);
        if (module) {
            if (block.type === 'input') {
                this._state.loadModuleStatuses(module.mod);
            } else {
                this._state.loadModuleFunctions(module.mod);
            }
        }
    }

    public setBindingField(
        event: Event,
        block: WorkflowBlock,
        field: 'status' | 'method',
    ): void {
        const value = (
            event.target as HTMLSelectElement | HTMLInputElement
        ).value.trim();
        const binding = block.binding;
        if (!binding) return;
        this._updateBinding(block, { ...binding, [field]: value });
    }

    public setBindingArgs(event: Event, block: WorkflowBlock): void {
        const raw = (event.target as HTMLTextAreaElement).value.trim();
        const binding = block.binding;
        if (!binding) return;
        if (!raw) {
            this.args_error.set('');
            this._updateBinding(block, { ...binding, args: {} });
            return;
        }
        try {
            const args = JSON.parse(raw);
            if (typeof args !== 'object' || Array.isArray(args)) {
                throw new Error('Arguments must be a JSON object');
            }
            this.args_error.set('');
            this._updateBinding(block, { ...binding, args });
        } catch {
            this.args_error.set('Invalid JSON — arguments were not saved');
        }
    }

    public argsJson(block: WorkflowBlock): string {
        const args = block.binding?.args;
        return args && Object.keys(args).length ? JSON.stringify(args) : '';
    }

    private _updateBinding(
        block: WorkflowBlock,
        binding: WorkflowBlock['binding'],
    ): void {
        this._state.updateBlock(block.id, { binding });
        this._state.selectBlock({ ...block, binding });
    }

    public getBlockIcon(category: string): string {
        const icon_map: Record<string, string> = {
            'Occupancy': 'group',
            'Power State': 'power_settings_new',
            'Booking': 'book',
            'Sensor': 'sensors',
            'HVAC': 'thermostat',
            'Access': 'door_open',
            'Room Functions': 'meeting_room',
            'Agent Block': 'smart_toy',
            'Logic Block': 'settings',
            'Communication': 'chat',
        };
        return icon_map[category] || 'settings';
    }

    public getBlockIconColor(type: string): string {
        const color_map: Record<string, string> = {
            'input': 'text-blue-500',
            'output': 'text-green-500',
            'logic': 'text-purple-500',
            'agent': 'text-red-500',
            'communication': 'text-orange-500',
        };
        return color_map[type] || 'text-base-content/60';
    }

    public getSettingValue(block: WorkflowBlock, key: string, default_value: any): any {
        return block.settings?.[key] ?? default_value;
    }

    public updateSetting(event: Event, block_id: string, key: string): void {
        const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const value = target.type === 'number' ? Number(target.value) : target.value;

        const block = this._state.selected_block();
        if (!block) return;

        const updated_settings = { ...block.settings, [key]: value };
        this._state.updateBlock(block_id, { settings: updated_settings });
        this._state.selectBlock({ ...block, settings: updated_settings });
    }

    public updateComments(event: Event, block_id: string): void {
        const target = event.target as HTMLTextAreaElement;
        const comments = target.value;

        const block = this._state.selected_block();
        if (!block) return;

        this._state.updateBlock(block_id, { comments });
        this._state.selectBlock({ ...block, comments });
    }

    public deleteBlock(block_id: string): void {
        if (confirm('Are you sure you want to delete this block?')) {
            this._state.removeBlock(block_id);
        }
    }
}
