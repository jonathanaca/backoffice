import { Component, computed, inject, input, signal } from '@angular/core';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IconComponent } from '../ui/icon.component';
import { WorkflowBlock } from './skills.types';
import { SkillsStateService } from './skills-state.service';

@Component({
    selector: 'skills-block',
    template: `
        <!-- eslint-disable @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div
            cdkDrag
            [cdkDragFreeDragPosition]="drag_position()"
            [cdkDragScale]="scale()"
            (cdkDragEnded)="onDragEnded($event)"
            (cdkDragStarted)="onDragStarted()"
            [class]="getBlockClasses()"
            (mouseenter)="onMouseEnter()"
            (mouseleave)="onMouseLeave()"
            (click)="onClick($event)"
        >
            <!-- Input Connection Point (Left Side) -->
            <div
                class="absolute -left-3 top-1/2 -translate-y-1/2 z-30"
                (click)="onInputConnectorClick($event)"
            >
                <div [class]="getInputConnectorClasses()">
                    <div class="w-3 h-3 rounded-full bg-base-100"></div>
                </div>
            </div>

            <!-- Output Connection Point (Right Side) -->
            <div
                class="absolute -right-3 top-1/2 -translate-y-1/2 z-30"
                (click)="onOutputConnectorClick($event)"
            >
                <div [class]="getOutputConnectorClasses()">
                    <div class="w-3 h-3 rounded-full bg-base-100"></div>
                </div>
            </div>

            <!-- Block Content -->
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                        <icon>{{ getBlockIcon() }}</icon>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate">{{ block().category }}</div>
                        <div class="text-xs opacity-60 capitalize">{{ block().type }}</div>
                    </div>
                </div>

                <button
                    (click)="onRemove($event)"
                    class="ml-2 opacity-50 hover:opacity-100 transition-opacity"
                >
                    <icon>close</icon>
                </button>
            </div>

            <!-- Selected Workplace Event -->
            @if (block().settings?.['event_label']; as event_label) {
                <div class="mt-1.5 flex max-w-40 items-center gap-1">
                    <icon class="!text-sm opacity-60">bolt</icon>
                    <span class="truncate text-xs font-medium"
                        >on {{ event_label }}</span
                    >
                </div>
            }

            <!-- Source Module Binding -->
            @if (block().binding; as binding) {
                <div class="mt-2 flex items-center gap-1 max-w-40" [matTooltip]="'Backed by the ' + binding.module_name + ' module'">
                    <icon class="!text-sm opacity-60">cable</icon>
                    <span class="text-xs opacity-60 truncate">via {{ binding.module_name }}</span>
                </div>
                @if (getBindingDetail(); as detail) {
                    <div class="mt-0.5 max-w-40 truncate font-mono text-[10px] opacity-50">
                        {{ detail }}
                    </div>
                }
            } @else if (block().binding === null && (block().type === 'input' || block().type === 'output')) {
                <div class="mt-2 flex items-center gap-1 max-w-40" matTooltip="No matching module found in this system">
                    <icon class="!text-sm text-amber-600">link_off</icon>
                    <span class="text-xs text-amber-600/90 truncate">no module linked</span>
                </div>
            }

            <!-- Block Settings Preview -->
            @if (block().settings && hasSettings()) {
                <div class="mt-2 pt-2 border-t border-current/20">
                    <div class="text-xs opacity-70">
                        @for (entry of getSettingsPreview(); track entry.key) {
                            <div class="truncate">
                                {{ entry.key }}: {{ entry.value }}
                            </div>
                        }
                    </div>
                </div>
            }
        </div>
    `,
    styles: [`
        :host {
            position: absolute;
            top: 0;
            left: 0;
        }
    `],
    imports: [CommonModule, CdkDrag, MatTooltipModule, IconComponent],
})
export class SkillsBlockComponent {
    private _state = inject(SkillsStateService);

    public readonly block = input.required<WorkflowBlock>();

    public readonly scale = this._state.scale;

    private readonly is_dragging = signal(false);

    public getBlockClasses(): string {
        const base = 'absolute pointer-events-auto rounded-lg border-2 p-4 transition-shadow duration-200 min-w-[150px] bg-base-100 shadow-md hover:shadow-lg cursor-grab';
        const is_selected = this._state.selected_block()?.id === this.block().id;
        const is_hovered = this._state.hovered_block() === this.block().id && this._state.is_connecting();
        const is_dragging = this.is_dragging();

        let type_classes = '';
        switch (this.block().type) {
            case 'input':
                type_classes = `border-blue-500 bg-blue-500/10 text-blue-800 ${
                    is_selected && !is_dragging ? 'ring-2 ring-blue-400' : ''
                } ${is_hovered ? 'ring-2 ring-yellow-400' : ''}`;
                break;
            case 'output':
                type_classes = `border-green-500 bg-green-500/10 text-green-800 ${
                    is_selected && !is_dragging ? 'ring-2 ring-green-400' : ''
                } ${is_hovered ? 'ring-2 ring-yellow-400' : ''}`;
                break;
            case 'logic':
                type_classes = `border-purple-500 bg-purple-500/10 text-purple-800 ${
                    is_selected && !is_dragging ? 'ring-2 ring-purple-400' : ''
                } ${is_hovered ? 'ring-2 ring-yellow-400' : ''}`;
                break;
            case 'agent':
                type_classes = `border-red-500 bg-red-500/10 text-red-800 ${
                    is_selected && !is_dragging ? 'ring-2 ring-red-400' : ''
                } ${is_hovered ? 'ring-2 ring-yellow-400' : ''}`;
                break;
            case 'communication':
                type_classes = `border-orange-500 bg-orange-500/10 text-orange-800 ${
                    is_selected && !is_dragging ? 'ring-2 ring-orange-400' : ''
                } ${is_hovered ? 'ring-2 ring-yellow-400' : ''}`;
                break;
            default:
                type_classes = 'border-base-300 bg-base-200 text-base-content/70';
        }

        return `${base} ${type_classes}`;
    }

    public getInputConnectorClasses(): string {
        const has_connection = this._state.connections().some(c => c.to === this.block().id);
        const is_valid_target = this._state.is_connecting() &&
            this._state.connection_start()?.port === 'output' &&
            this._state.connection_start()?.blockId !== this.block().id;

        if (is_valid_target) {
            return 'w-6 h-6 rounded-full border-2 border-yellow-400 bg-yellow-400 shadow-lg shadow-yellow-400/50 scale-125 flex items-center justify-center transition-all duration-200 cursor-pointer';
        } else if (has_connection) {
            return 'w-6 h-6 rounded-full border-2 border-green-400 bg-green-400 hover:bg-green-300 hover:scale-110 flex items-center justify-center transition-all duration-200 cursor-pointer';
        } else {
            return 'w-6 h-6 rounded-full border-2 border-base-content/30 bg-base-300 hover:bg-base-200 hover:border-base-content/50 hover:scale-110 flex items-center justify-center transition-all duration-200 cursor-pointer';
        }
    }

    public getOutputConnectorClasses(): string {
        const has_connections = this._state.connections().filter(c => c.from === this.block().id).length > 0;
        const is_valid_target = this._state.is_connecting() &&
            this._state.connection_start()?.port === 'input' &&
            this._state.connection_start()?.blockId !== this.block().id;

        if (is_valid_target) {
            return 'w-6 h-6 rounded-full border-2 border-yellow-400 bg-yellow-400 shadow-lg shadow-yellow-400/50 scale-125 flex items-center justify-center transition-all duration-200 cursor-pointer';
        } else if (has_connections) {
            return 'w-6 h-6 rounded-full border-2 border-green-400 bg-green-400 hover:bg-green-300 hover:scale-110 flex items-center justify-center transition-all duration-200 cursor-pointer';
        } else {
            return 'w-6 h-6 rounded-full border-2 border-base-content/30 bg-base-300 hover:bg-base-200 hover:border-base-content/50 hover:scale-110 flex items-center justify-center transition-all duration-200 cursor-pointer';
        }
    }

    public getBlockIcon(): string {
        const icon_map: Record<string, string> = {
            'Workplace Events': 'event_note',
            'Occupancy': 'group',
            'Power State': 'power_settings_new',
            'Booking': 'book',
            'Sensor': 'sensors',
            'HVAC': 'thermostat',
            'Access': 'door_open',
            'Room Functions': 'meeting_room',
            'Agent Block': 'smart_toy',
            'Logic Block': 'settings',
            'Motion': 'videocam',
            'Sound Level': 'volume_up',
            'Light Level': 'lightbulb',
            'Security': 'shield',
            'Time Schedule': 'schedule',
            'Calendar Event': 'event',
            'Location': 'location_on',
            'Network Status': 'wifi',
            'Device Status': 'monitor',
            'Mobile App': 'smartphone',
            'Temperature': 'thermostat',
            'Humidity': 'water_drop',
            'Lighting': 'lightbulb',
            'Audio Visual': 'tv',
            'Display Control': 'tablet',
            'Printing': 'print',
            'Coffee Machine': 'coffee',
            'Parking': 'local_parking',
            'Blinds/Shades': 'curtains',
            'Notification': 'notifications',
            'Email Alert': 'email',
            'Security System': 'security',
            'Fire Safety': 'local_fire_department',
            'Communication': 'chat',
        };
        return icon_map[this.block().category] || 'settings';
    }

    /** Technical detail of the binding, e.g. \`Occupancy_1.presence\` */
    public getBindingDetail(): string {
        const binding = this.block().binding;
        if (!binding?.mod) return '';
        if (this.block().type === 'input' && binding.status) {
            return `${binding.mod}.${binding.status}`;
        }
        if (this.block().type === 'output' && binding.method) {
            return `${binding.mod}.${binding.method}()`;
        }
        return '';
    }

    public hasSettings(): boolean {
        const settings = this.block().settings;
        return settings ? Object.keys(settings).length > 0 : false;
    }

    public getSettingsPreview(): Array<{key: string, value: string}> {
        const settings = this.block().settings;
        if (!settings) return [];
        return Object.entries(settings)
            .filter(([key]) => key !== 'event' && key !== 'event_label')
            .slice(0, 2)
            .map(([key, value]) => ({ key, value: String(value) }));
    }

    public onDragStarted(): void {
        this.is_dragging.set(true);
    }

    /**
     * CDK's free drag position (with \`cdkDragScale\`) works in screen pixels,
     * while block positions are stored in canvas-local coordinates. A computed
     * keeps the object reference stable between position changes — a fresh
     * object per change-detection cycle would make CdkDrag reset the position
     * mid-drag.
     */
    public readonly drag_position = computed(() => {
        const position = this.block().position;
        const scale = this.scale();
        return { x: position.x * scale, y: position.y * scale };
    });

    public onDragEnded(event: any): void {
        this.is_dragging.set(false);
        const position = event.source.getFreeDragPosition();
        const scale = this.scale();
        this._state.updateBlock(this.block().id, {
            position: { x: position.x / scale, y: position.y / scale },
        });
    }

    public onClick(event: MouseEvent): void {
        if (!this.is_dragging() && !this._state.is_connecting()) {
            event.stopPropagation();
            this._state.selectBlock(this.block());
        }
    }

    public onRemove(event: MouseEvent): void {
        event.stopPropagation();
        this._state.removeBlock(this.block().id);
    }

    public onInputConnectorClick(event: MouseEvent): void {
        event.stopPropagation();

        if (this.is_dragging()) return;

        const connection_start = this._state.connection_start();
        if (this._state.is_connecting() && connection_start && connection_start.blockId !== this.block().id) {
            if (connection_start.port === 'output') {
                this._state.endConnection(this.block().id, 'input');
                return;
            }
        }

        const existing_connection = this._state.connections().find(conn => conn.to === this.block().id);
        if (existing_connection) {
            this._state.removeConnection(existing_connection.id);
            return;
        }

        if (!this._state.is_connecting()) {
            this._state.startConnection(this.block().id, 'input');
        }
    }

    public onOutputConnectorClick(event: MouseEvent): void {
        event.stopPropagation();

        if (this.is_dragging()) return;

        const connection_start = this._state.connection_start();
        if (this._state.is_connecting() && connection_start && connection_start.blockId !== this.block().id) {
            if (connection_start.port === 'input') {
                this._state.endConnection(this.block().id, 'output');
                return;
            }
        }

        if (!this._state.is_connecting()) {
            this._state.startConnection(this.block().id, 'output');
        }
    }

    public onMouseEnter(): void {
        if (this._state.is_connecting()) {
            this._state.hovered_block.set(this.block().id);
        }
    }

    public onMouseLeave(): void {
        if (this._state.is_connecting()) {
            this._state.hovered_block.set(null);
        }
    }
}
