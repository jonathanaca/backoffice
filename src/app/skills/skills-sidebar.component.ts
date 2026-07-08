import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragStart, CdkDropList } from '@angular/cdk/drag-drop';
import { IconComponent } from '../ui/icon.component';
import { TranslatePipe } from '../ui/translate.pipe';
import { SkillsStateService } from './skills-state.service';
import { CATEGORY_MODULE_PATTERNS } from './skills.types';

interface BlockItem {
    category: string;
    icon: string;
    type: 'input' | 'output';
}

@Component({
    selector: 'skills-sidebar',
    template: `
        <!-- eslint-disable @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <aside class="w-80 h-full bg-base-100 border-r border-base-200 flex flex-col overflow-hidden">
            <!-- Inputs Section -->
            <div class="flex-1 min-h-0 p-6 border-b border-base-200 overflow-y-auto">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-4">{{ 'SKILLS.INPUTS' | translate }}</h2>
                <div
                    cdkDropList
                    [cdkDropListData]="input_items"
                    [cdkDropListConnectedTo]="['canvas-list']"
                    cdkDropListSortingDisabled
                    id="inputs-list"
                    class="space-y-3"
                >
                    @for (item of input_items; track item.category) {
                        <div
                            cdkDrag
                            [cdkDragData]="item"
                            [cdkDragDisabled]="!isBlockAvailable(item.type, item.category)"
                            (cdkDragStarted)="onDragStarted($event, item)"
                            [class]="getBlockItemClasses(item.type, isBlockAvailable(item.type, item.category))"
                            (click)="onUnavailableClick(item.category, isBlockAvailable(item.type, item.category))"
                        >
                            <div class="flex items-center space-x-2">
                                <div class="w-5 h-5">
                                    <icon>{{ item.icon }}</icon>
                                </div>
                                <span class="text-sm font-medium">{{ item.category }}</span>
                            </div>
                        </div>
                    }
                </div>
            </div>

            <!-- Outputs Section -->
            <div class="flex-1 min-h-0 p-6 overflow-y-auto">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xs font-semibold uppercase tracking-wider text-base-content/50">{{ 'SKILLS.OUTPUTS' | translate }}</h2>
                    <button class="text-base-content/40 hover:text-base-content">
                        <icon>more_horiz</icon>
                    </button>
                </div>
                <div
                    cdkDropList
                    [cdkDropListData]="output_items"
                    [cdkDropListConnectedTo]="['canvas-list']"
                    cdkDropListSortingDisabled
                    id="outputs-list"
                    class="space-y-3"
                >
                    @for (item of output_items; track item.category) {
                        <div
                            cdkDrag
                            [cdkDragData]="item"
                            [cdkDragDisabled]="!isBlockAvailable(item.type, item.category)"
                            (cdkDragStarted)="onDragStarted($event, item)"
                            [class]="getBlockItemClasses(item.type, isBlockAvailable(item.type, item.category))"
                            (click)="onUnavailableClick(item.category, isBlockAvailable(item.type, item.category))"
                        >
                            <div class="flex items-center space-x-2">
                                <div class="w-5 h-5">
                                    <icon>{{ item.icon }}</icon>
                                </div>
                                <span class="text-sm font-medium">{{ item.category }}</span>
                            </div>
                        </div>
                    }
                </div>
            </div>

            <!-- Unavailable Module Modal -->
            @if (show_unavailable_modal()) {
                <div class="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-base-100 border border-orange-500 rounded-lg shadow-2xl p-4 max-w-md animate-fade-in">
                    <div class="flex items-start space-x-3">
                        <div class="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <icon class="text-orange-500">shield</icon>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-base-content font-semibold mb-1">Module Not Available</h3>
                            <p class="text-sm text-base-content/70 mb-2">
                                You do not have a <span class="font-semibold text-orange-600">{{ unavailable_module() }}</span> module in your current system.
                            </p>
                            <button
                                class="text-xs bg-secondary text-secondary-content hover:opacity-90 px-3 py-1.5 rounded transition-opacity font-medium"
                            >
                                Add modules in Backoffice
                            </button>
                        </div>
                    </div>
                </div>
            }
        </aside>
    `,
    styles: [`
        :host {
            display: flex;
            height: 100%;
        }

        @keyframes fade-in {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        .animate-fade-in {
            animation: fade-in 0.3s ease-out;
        }
    `],
    imports: [CommonModule, CdkDrag, CdkDropList, IconComponent, TranslatePipe],
})
export class SkillsSidebarComponent {
    private _state = inject(SkillsStateService);

    public readonly show_unavailable_modal = signal(false);
    public readonly unavailable_module = signal('');
    public readonly available_modules = this._state.available_modules;

    public readonly input_items: BlockItem[] = [
        { category: 'Occupancy', icon: 'group', type: 'input' },
        { category: 'Power State', icon: 'power_settings_new', type: 'input' },
        { category: 'Booking', icon: 'book', type: 'input' },
        { category: 'Sensor', icon: 'sensors', type: 'input' },
        { category: 'Motion', icon: 'videocam', type: 'input' },
        { category: 'Sound Level', icon: 'volume_up', type: 'input' },
        { category: 'Light Level', icon: 'lightbulb', type: 'input' },
        { category: 'Security', icon: 'shield', type: 'input' },
        { category: 'Time Schedule', icon: 'schedule', type: 'input' },
        { category: 'Calendar Event', icon: 'event', type: 'input' },
        { category: 'Location', icon: 'location_on', type: 'input' },
        { category: 'Network Status', icon: 'wifi', type: 'input' },
        { category: 'Device Status', icon: 'monitor', type: 'input' },
        { category: 'Mobile App', icon: 'smartphone', type: 'input' },
        { category: 'Temperature', icon: 'thermostat', type: 'input' },
        { category: 'Humidity', icon: 'water_drop', type: 'input' },
    ];

    public readonly output_items: BlockItem[] = [
        { category: 'HVAC', icon: 'thermostat', type: 'output' },
        { category: 'Access', icon: 'door_open', type: 'output' },
        { category: 'Room Functions', icon: 'meeting_room', type: 'output' },
        { category: 'Lighting', icon: 'lightbulb', type: 'output' },
        { category: 'Audio Visual', icon: 'tv', type: 'output' },
        { category: 'Display Control', icon: 'tablet', type: 'output' },
        { category: 'Printing', icon: 'print', type: 'output' },
        { category: 'Coffee Machine', icon: 'coffee', type: 'output' },
        { category: 'Parking', icon: 'local_parking', type: 'output' },
        { category: 'Blinds/Shades', icon: 'curtains', type: 'output' },
        { category: 'Notification', icon: 'notifications', type: 'output' },
        { category: 'Email Alert', icon: 'email', type: 'output' },
        { category: 'Security System', icon: 'security', type: 'output' },
        { category: 'Fire Safety', icon: 'local_fire_department', type: 'output' },
    ];

    public isBlockAvailable(type: 'input' | 'output', category: string): boolean {
        const modules = this.available_modules();

        // If no modules loaded yet, show all blocks as available
        if (modules.length === 0) {
            return true;
        }

        // Get the driver patterns for this category
        const patterns = CATEGORY_MODULE_PATTERNS[category];

        // If no patterns defined (software-only blocks), always available
        if (!patterns || patterns.length === 0) {
            return true;
        }

        // Check if any module matches the patterns
        return modules.some(module => {
            const module_name = (module.name || '').toLowerCase();
            const custom_name = (module.custom_name || '').toLowerCase();

            return patterns.some(pattern =>
                module_name.includes(pattern.toLowerCase()) ||
                custom_name.includes(pattern.toLowerCase())
            );
        });
    }

    public getBlockItemClasses(type: 'input' | 'output', is_available: boolean): string {
        const base = 'border-2 border-dashed rounded-lg p-3 transition-all duration-200';

        if (type === 'input') {
            return is_available
                ? `${base} border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 cursor-move hover:scale-105 hover:shadow-md`
                : `${base} border-base-300 bg-base-200 text-base-content/40 cursor-not-allowed opacity-70`;
        } else {
            return is_available
                ? `${base} border-green-500 bg-green-500/10 hover:bg-green-500/20 text-green-700 cursor-move hover:scale-105 hover:shadow-md`
                : `${base} border-base-300 bg-base-200 text-base-content/40 cursor-not-allowed opacity-70`;
        }
    }

    public onDragStarted(event: CdkDragStart, item: BlockItem): void {
        // Could add drag feedback here
    }

    public onUnavailableClick(category: string, is_available: boolean): void {
        if (!is_available) {
            this.unavailable_module.set(category);
            this.show_unavailable_modal.set(true);
            setTimeout(() => this.show_unavailable_modal.set(false), 3000);
        }
    }
}
