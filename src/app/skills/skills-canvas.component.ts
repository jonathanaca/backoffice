import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IconComponent } from '../ui/icon.component';
import { TranslatePipe } from '../ui/translate.pipe';
import { SkillsBlockComponent } from './skills-block.component';
import { SkillsStateService } from './skills-state.service';

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const BLOCK_WIDTH = 180;
const BLOCK_HEIGHT = 110;

@Component({
    selector: 'skills-canvas',
    template: `
        <!-- eslint-disable @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div class="flex-1 relative overflow-hidden bg-base-200">
            <!-- Canvas Controls -->
            <div class="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-3">
                <div class="relative">
                    <button
                        (click)="automation_dropdown_open.set(!automation_dropdown_open())"
                        class="flex items-center space-x-2 bg-base-100 hover:bg-base-200 border border-base-300 px-4 py-2 rounded-lg shadow-sm transition-colors"
                    >
                        <icon class="text-secondary">bolt</icon>
                        <span class="text-sm font-medium text-base-content">Automation</span>
                        <icon [class]="'w-4 h-4 text-base-content/50 transition-transform ' + (automation_dropdown_open() ? 'rotate-180' : '')">expand_more</icon>
                    </button>

                    <!-- Dropdown Menu -->
                    @if (automation_dropdown_open()) {
                        <div class="absolute top-full left-0 mt-2 w-56 bg-base-100 border border-base-200 rounded-lg shadow-xl z-50">
                            <div class="py-2">
                                <button
                                    (click)="addAutomationBlock('agent')"
                                    class="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-base-200 transition-colors"
                                >
                                    <icon class="text-red-500">smart_toy</icon>
                                    <div>
                                        <div class="text-sm font-medium text-base-content">Agent Block</div>
                                        <div class="text-xs text-base-content/60">AI-powered decision making</div>
                                    </div>
                                </button>

                                <button
                                    (click)="addAutomationBlock('logic')"
                                    class="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-base-200 transition-colors"
                                >
                                    <icon class="text-purple-500">settings</icon>
                                    <div>
                                        <div class="text-sm font-medium text-base-content">Logic Block</div>
                                        <div class="text-xs text-base-content/60">Conditional logic and rules</div>
                                    </div>
                                </button>

                                <button
                                    (click)="addAutomationBlock('communication')"
                                    class="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-base-200 transition-colors"
                                >
                                    <icon class="text-orange-500">chat</icon>
                                    <div>
                                        <div class="text-sm font-medium text-base-content">Communication</div>
                                        <div class="text-xs text-base-content/60">Send notifications and messages</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    }
                </div>

                <!-- Click outside to close dropdown -->
                @if (automation_dropdown_open()) {
                    <div
                        class="fixed inset-0 z-40"
                        (click)="automation_dropdown_open.set(false)"
                    ></div>
                }
            </div>

            <!-- Canvas Area -->
            <div
                #canvasElement
                [class]="getCanvasClasses()"
                (mousedown)="onCanvasMouseDown($event)"
                (mousemove)="onCanvasMouseMove($event)"
                (mouseup)="onCanvasMouseUp()"
                (mouseleave)="onCanvasMouseUp()"
                (wheel)="onWheel($event)"
                (click)="onCanvasClick()"
            >
                <!-- Grid Pattern -->
                <div
                    class="absolute inset-0 opacity-30"
                    [style]="getGridStyle()"
                ></div>

                <!-- Drop zone for sidebar items. Sibling of the blocks layer so
                     block drags stay free-form instead of list-managed. -->
                <div
                    cdkDropList
                    id="canvas-list"
                    cdkDropListSortingDisabled
                    (cdkDropListDropped)="onBlockDropped($event)"
                    class="absolute inset-0"
                ></div>

                <!-- Panned + scaled content layer -->
                <div
                    class="absolute inset-0 pointer-events-none"
                    [style.transform]="getContentTransform()"
                    style="transform-origin: 0 0"
                >
                <!-- Connection Preview Line -->
                @if (is_connecting() && connection_start()) {
                    <div class="absolute inset-0 pointer-events-none" style="z-index: 50;">
                        <svg class="w-full h-full">
                            <defs>
                                <marker
                                    id="preview-arrowhead"
                                    markerWidth="10"
                                    markerHeight="7"
                                    refX="9"
                                    refY="3.5"
                                    orient="auto"
                                >
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#60a5fa" opacity="0.7" />
                                </marker>
                            </defs>
                            <path
                                [attr.d]="getPreviewPathData()"
                                stroke="#60a5fa"
                                stroke-width="6"
                                stroke-dasharray="5,5"
                                fill="none"
                                opacity="1"
                                marker-end="url(#preview-arrowhead)"
                                class="drop-shadow-lg"
                            >
                                <animate
                                    attributeName="stroke-dashoffset"
                                    values="0;10"
                                    dur="0.5s"
                                    repeatCount="indefinite"
                                />
                            </path>
                        </svg>
                    </div>
                }

                <!-- Connection Lines -->
                <svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 1;">
                    <defs>
                        <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="7"
                            refX="9"
                            refY="3.5"
                            orient="auto"
                        >
                            <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
                        </marker>
                    </defs>
                    @for (connection of connections(); track connection.id) {
                        @if (getConnectionPath(connection.from, connection.to); as path) {
                            <g (click)="removeConnection($event, connection.id)" class="cursor-pointer">
                                <!-- Invisible wider hitbox -->
                                <path
                                    [attr.d]="path"
                                    stroke="transparent"
                                    stroke-width="20"
                                    fill="none"
                                    class="pointer-events-auto"
                                />
                                <!-- Visible line -->
                                <path
                                    [attr.d]="path"
                                    stroke="#10b981"
                                    stroke-width="3"
                                    fill="none"
                                    marker-end="url(#arrowhead)"
                                    class="pointer-events-none hover:stroke-red-400 transition-colors"
                                />
                            </g>
                        }
                    }
                </svg>

                <!-- Workflow Blocks -->
                @for (block of blocks(); track block.id) {
                    <skills-block [block]="block"></skills-block>
                }

                <!-- Connection Guidelines -->
                @if (is_connecting() && hovered_block()) {
                    @if (getHoveredBlockPosition(); as pos) {
                        <div
                            class="absolute border-2 border-yellow-400 bg-yellow-400/10 rounded-lg pointer-events-none"
                            [style.left.px]="pos.x - 4"
                            [style.top.px]="pos.y - 4"
                            [style.width.px]="158"
                            [style.height.px]="88"
                            [style.z-index]="5"
                        ></div>
                    }
                }
                </div>

                <!-- Empty State -->
                @if (blocks().length === 0) {
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div class="text-center">
                            <div class="w-16 h-16 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                <icon class="text-base-content/40 text-4xl">bolt</icon>
                            </div>
                            <h3 class="text-lg font-medium text-base-content mb-2">Start Building Your Workflow</h3>
                            <p class="text-base-content/60 max-w-md mx-auto">
                                Drag blocks from the sidebar onto the canvas to create your automation workflow.
                            </p>
                            <div class="mt-4 text-sm text-base-content/50">
                                <p><strong>How to connect:</strong> Click the right connector (output) on one block, then click the left connector (input) on another block</p>
                                <p class="mt-1">Connected blocks show green connectors, unconnected ones are gray</p>
                            </div>
                        </div>
                    </div>
                }
            </div>

            <!-- Zoom Controls -->
            <div class="absolute bottom-4 right-4 flex items-center gap-1 bg-base-100 border border-base-200 rounded-lg shadow-sm px-2 py-1">
                <button
                    (click)="zoomOut()"
                    [matTooltip]="'SKILLS.ZOOM_OUT' | translate"
                    class="w-7 h-7 flex items-center justify-center rounded hover:bg-base-200 text-sm font-bold transition-colors"
                >
                    <icon class="text-base-content">remove</icon>
                </button>
                <button
                    (click)="resetZoom()"
                    [matTooltip]="'SKILLS.RESET_ZOOM' | translate"
                    class="text-xs text-base-content/60 hover:text-base-content w-10 text-center transition-colors"
                >
                    {{ Math.round(scale() * 100) }}%
                </button>
                <button
                    (click)="zoomIn()"
                    [matTooltip]="'SKILLS.ZOOM_IN' | translate"
                    class="w-7 h-7 flex items-center justify-center rounded hover:bg-base-200 text-sm font-bold transition-colors"
                >
                    <icon class="text-base-content">add</icon>
                </button>
                <div class="w-px h-5 bg-base-200 mx-1"></div>
                <button
                    (click)="fitToView()"
                    [matTooltip]="'SKILLS.FIT_VIEW' | translate"
                    class="w-7 h-7 flex items-center justify-center rounded hover:bg-base-200 transition-colors"
                >
                    <icon class="text-base-content">fit_screen</icon>
                </button>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        :host ::ng-deep .cdk-drag-placeholder {
            display: none;
        }
    `],
    imports: [
        CommonModule,
        CdkDropList,
        MatTooltipModule,
        IconComponent,
        TranslatePipe,
        SkillsBlockComponent,
    ],
})
export class SkillsCanvasComponent {
    private _state = inject(SkillsStateService);

    public readonly canvas_element = viewChild<ElementRef>('canvasElement');

    public readonly blocks = this._state.blocks;
    public readonly connections = this._state.connections;
    public readonly is_connecting = this._state.is_connecting;
    public readonly connection_start = this._state.connection_start;
    public readonly hovered_block = this._state.hovered_block;

    public readonly scale = this._state.scale;
    public readonly pan = this._state.pan;
    public readonly mouse_position = signal({ x: 0, y: 0 });
    public readonly automation_dropdown_open = signal(false);
    public readonly is_panning = signal(false);

    private _pan_start: { x: number; y: number } | null = null;
    private _pan_moved = false;

    public readonly Math = Math;

    public getCanvasClasses(): string {
        const base = 'w-full h-full relative transition-colors duration-200';
        const cursor = this.is_connecting()
            ? 'cursor-crosshair'
            : this.is_panning()
              ? 'cursor-grabbing'
              : 'cursor-grab';
        return `${base} ${cursor}`;
    }

    public getContentTransform(): string {
        const pan = this.pan();
        return `translate(${pan.x}px, ${pan.y}px) scale(${this.scale()})`;
    }

    public getGridStyle(): string {
        const pan = this.pan();
        const size = 12 * this.scale();
        return `
            background-image:
                linear-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px),
                linear-gradient(90deg, rgba(59, 130, 246, 0.15) 1px, transparent 1px);
            background-size: ${size}px ${size}px;
            background-position: ${pan.x}px ${pan.y}px;
        `;
    }

    /** Convert a viewport point into canvas-local coordinates */
    private toCanvasPoint(client_x: number, client_y: number) {
        const canvas = this.canvas_element()?.nativeElement;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const pan = this.pan();
        const scale = this.scale();
        return {
            x: (client_x - rect.left - pan.x) / scale,
            y: (client_y - rect.top - pan.y) / scale,
        };
    }

    public onCanvasMouseDown(event: MouseEvent): void {
        if (event.button !== 0 || this.is_connecting()) return;
        const target = event.target as HTMLElement;
        if (target.closest('skills-block')) return;
        this._pan_start = { x: event.clientX, y: event.clientY };
        this._pan_moved = false;
        this.is_panning.set(true);
    }

    public onCanvasMouseMove(event: MouseEvent): void {
        if (this._pan_start && event.buttons === 1) {
            const dx = event.clientX - this._pan_start.x;
            const dy = event.clientY - this._pan_start.y;
            if (dx || dy) this._pan_moved = true;
            this._pan_start = { x: event.clientX, y: event.clientY };
            this.pan.update((p) => ({ x: p.x + dx, y: p.y + dy }));
            return;
        }
        if (this.is_connecting()) {
            const point = this.toCanvasPoint(event.clientX, event.clientY);
            if (point) this.mouse_position.set(point);
        }
    }

    public onCanvasMouseUp(): void {
        this._pan_start = null;
        this.is_panning.set(false);
    }

    public onWheel(event: WheelEvent): void {
        event.preventDefault();
        const canvas = this.canvas_element()?.nativeElement;
        if (!canvas) return;
        if (event.ctrlKey || event.metaKey) {
            const rect = canvas.getBoundingClientRect();
            const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
            this.zoomAt(
                this.scale() * factor,
                event.clientX - rect.left,
                event.clientY - rect.top,
            );
        } else {
            this.pan.update((p) => ({
                x: p.x - event.deltaX,
                y: p.y - event.deltaY,
            }));
        }
    }

    /** Zoom keeping the given canvas-viewport point stationary */
    private zoomAt(next_scale: number, cx: number, cy: number): void {
        const scale = this.scale();
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next_scale));
        if (next === scale) return;
        const pan = this.pan();
        this.pan.set({
            x: cx - ((cx - pan.x) * next) / scale,
            y: cy - ((cy - pan.y) * next) / scale,
        });
        this.scale.set(next);
    }

    private zoomAtCentre(next_scale: number): void {
        const canvas = this.canvas_element()?.nativeElement;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        this.zoomAt(next_scale, rect.width / 2, rect.height / 2);
    }

    public resetZoom(): void {
        this.zoomAtCentre(1);
    }

    public fitToView(): void {
        const canvas = this.canvas_element()?.nativeElement;
        const blocks = this.blocks();
        if (!canvas) return;
        if (!blocks.length) {
            this.scale.set(1);
            this.pan.set({ x: 0, y: 0 });
            return;
        }
        const min_x = Math.min(...blocks.map((b) => b.position.x));
        const min_y = Math.min(...blocks.map((b) => b.position.y));
        const max_x = Math.max(
            ...blocks.map((b) => b.position.x + BLOCK_WIDTH),
        );
        const max_y = Math.max(
            ...blocks.map((b) => b.position.y + BLOCK_HEIGHT),
        );
        const rect = canvas.getBoundingClientRect();
        const margin = 48;
        const scale = Math.min(
            MAX_SCALE,
            Math.max(
                MIN_SCALE,
                Math.min(
                    (rect.width - margin * 2) / (max_x - min_x),
                    (rect.height - margin * 2) / (max_y - min_y),
                    1.25,
                ),
            ),
        );
        this.scale.set(scale);
        this.pan.set({
            x: (rect.width - (max_x - min_x) * scale) / 2 - min_x * scale,
            y: (rect.height - (max_y - min_y) * scale) / 2 - min_y * scale,
        });
    }

    public onCanvasClick(): void {
        // A drag-to-pan shouldn't count as a click
        if (this._pan_moved) {
            this._pan_moved = false;
            return;
        }
        if (this.is_connecting()) {
            this._state.cancelConnection();
        }
    }

    public getPreviewPathData(): string {
        const start = this.connection_start();
        if (!start) return '';

        const start_block = this.blocks().find(b => b.id === start.blockId);
        if (!start_block) return '';

        const start_x = start.port === 'output'
            ? start_block.position.x + 150
            : start_block.position.x;
        const start_y = start_block.position.y + 50;

        const mouse_pos = this.mouse_position();
        const mid_x = start_x + (mouse_pos.x - start_x) / 2;

        return `M ${start_x} ${start_y} C ${mid_x} ${start_y}, ${mid_x} ${mouse_pos.y}, ${mouse_pos.x} ${mouse_pos.y}`;
    }

    public getConnectionPath(from_id: string, to_id: string): string | null {
        const from_block = this.blocks().find(b => b.id === from_id);
        const to_block = this.blocks().find(b => b.id === to_id);

        if (!from_block || !to_block) return null;

        const start_x = from_block.position.x + 150;
        const start_y = from_block.position.y + 50;
        const end_x = to_block.position.x;
        const end_y = to_block.position.y + 50;

        const mid_x = start_x + (end_x - start_x) / 2;

        return `M ${start_x} ${start_y} C ${mid_x} ${start_y}, ${mid_x} ${end_y}, ${end_x} ${end_y}`;
    }

    public getHoveredBlockPosition(): { x: number, y: number } | null {
        const hovered_id = this.hovered_block();
        if (!hovered_id) return null;

        const block = this.blocks().find(b => b.id === hovered_id);
        return block ? block.position : null;
    }

    public removeConnection(event: MouseEvent, connection_id: string): void {
        event.stopPropagation();
        this._state.removeConnection(connection_id);
    }

    public addAutomationBlock(type: 'agent' | 'logic' | 'communication'): void {
        const block_configs = {
            agent: {
                type: 'agent' as const,
                category: 'Agent Block',
                position: { x: 400, y: 100 },
            },
            logic: {
                type: 'logic' as const,
                category: 'Logic Block',
                position: { x: 600, y: 100 },
            },
            communication: {
                type: 'communication' as const,
                category: 'Communication',
                position: { x: 800, y: 100 },
            },
        };

        this._state.addBlock(block_configs[type]);
        this.automation_dropdown_open.set(false);
    }

    public zoomIn(): void {
        this.zoomAtCentre(this.scale() + 0.1);
    }

    public zoomOut(): void {
        this.zoomAtCentre(this.scale() - 0.1);
    }

    public onBlockDropped(event: CdkDragDrop<any>): void {
        // Only handle drops from the sidebar lists (cross-container drops)
        if (event.previousContainer === event.container) return;

        const item = event.item.data;
        if (!item) return;

        const point = this.toCanvasPoint(event.dropPoint.x, event.dropPoint.y);
        if (!point) return;

        // Centre the block on the drop point
        this._state.addBlock({
            type: item.type,
            category: item.category,
            position: { x: point.x - 75, y: point.y - 40 },
        });
    }
}
