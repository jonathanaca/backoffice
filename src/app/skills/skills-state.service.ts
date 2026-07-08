import { computed, Injectable, signal } from '@angular/core';
import { queryModules, PlaceModule } from '@placeos/ts-client';
import { firstValueFrom } from 'rxjs';
import {
    BlockModuleRef,
    CATEGORY_MODULE_PATTERNS,
    Connection,
    ExecutionMode,
    PlaceOSModule,
    SkillData,
    ValidationIssue,
    WorkflowBlock,
} from './skills.types';

interface WorkflowSnapshot {
    blocks: WorkflowBlock[];
    connections: Connection[];
}

const HISTORY_LIMIT = 50;
const HISTORY_COALESCE_MS = 1000;

@Injectable({
    providedIn: 'root',
})
export class SkillsStateService {
    public readonly blocks = signal<WorkflowBlock[]>([]);
    public readonly connections = signal<Connection[]>([]);
    public readonly selected_block = signal<WorkflowBlock | null>(null);
    public readonly is_connecting = signal(false);
    public readonly connection_start = signal<{
        blockId: string;
        port: string;
    } | null>(null);
    public readonly hovered_block = signal<string | null>(null);
    public readonly scale = signal(1);
    public readonly pan = signal({ x: 0, y: 0 });
    public readonly skill_enabled = signal(true);
    public readonly can_undo = signal(false);
    public readonly can_redo = signal(false);
    public readonly execution_mode = signal<ExecutionMode>('simulate');

    public readonly validation_issues = computed<ValidationIssue[]>(() =>
        this._validate(this.blocks(), this.connections()),
    );

    private _undo_stack: WorkflowSnapshot[] = [];
    private _redo_stack: WorkflowSnapshot[] = [];
    private _last_history_key: string | null = null;
    private _last_history_time = 0;
    public readonly available_modules = signal<PlaceOSModule[]>([]);
    public readonly module_functions = signal<Record<string, string[]>>({});
    public readonly module_statuses = signal<Record<string, string[]>>({});
    public readonly current_system_id = signal<string | null>(null);
    public readonly current_skill = signal<SkillData | null>(null);

    constructor() {
        const stored_mode = localStorage.getItem(
            'BACKOFFICE.SKILLS.executionMode',
        );
        if (stored_mode === 'simulate' || stored_mode === 'production') {
            this.execution_mode.set(stored_mode);
        }
    }

    public async loadSystemModules(system_id: string): Promise<void> {
        try {
            const modules_response = await firstValueFrom(
                queryModules({ limit: 500 }),
            );
            const system_modules = modules_response.data.filter(
                (m: PlaceModule) => m.control_system_id === system_id,
            );
            this.available_modules.set(
                system_modules.map((m: PlaceModule) => ({
                    id: m.id,
                    name: m.driver?.module_name || m.name,
                    custom_name: m.custom_name,
                    driver_id: m.driver?.id,
                })),
            );
        } catch (e) {
            console.error('Failed to load modules for system', system_id, e);
            this.available_modules.set([]);
        }
        this._backfillBlockModules();
    }

    /** Whether a block category is backed by a hardware module at all */
    public categoryNeedsModule(category: string): boolean {
        return !!CATEGORY_MODULE_PATTERNS[category]?.length;
    }

    /**
     * Find the system module backing a block category, matching the same
     * name patterns used for palette availability.
     */
    public resolveModuleForCategory(category: string): BlockModuleRef | null {
        const patterns = CATEGORY_MODULE_PATTERNS[category];
        if (!patterns?.length) return null;
        const module = this.available_modules().find((m) => {
            const module_name = (m.name || '').toLowerCase();
            const custom_name = (m.custom_name || '').toLowerCase();
            return patterns.some(
                (pattern) =>
                    module_name.includes(pattern.toLowerCase()) ||
                    custom_name.includes(pattern.toLowerCase()),
            );
        });
        return module
            ? { id: module.id, name: module.custom_name || module.name }
            : null;
    }

    /** Link source modules to blocks added before the module list loaded */
    private _backfillBlockModules(): void {
        if (!this.available_modules().length) return;
        const resolvable = (b: WorkflowBlock) =>
            (b.type === 'input' || b.type === 'output') &&
            b.module === undefined &&
            this.categoryNeedsModule(b.category);
        if (!this.blocks().some(resolvable)) return;
        this.blocks.update((blocks) =>
            blocks.map((b) =>
                resolvable(b)
                    ? { ...b, module: this.resolveModuleForCategory(b.category) }
                    : b,
            ),
        );
    }

    public setExecutionMode(mode: ExecutionMode): void {
        this.execution_mode.set(mode);
        localStorage.setItem('BACKOFFICE.SKILLS.executionMode', mode);
    }

    public setSystemId(system_id: string): void {
        this.current_system_id.set(system_id);
    }

    private snapToGrid(x: number, y: number) {
        const grid_size = 12;
        return {
            x: Math.round(x / grid_size) * grid_size,
            y: Math.round(y / grid_size) * grid_size,
        };
    }

    /* History */

    private _snapshot(): WorkflowSnapshot {
        return {
            blocks: structuredClone(this.blocks()),
            connections: structuredClone(this.connections()),
        };
    }

    private _restore(snapshot: WorkflowSnapshot): void {
        this.blocks.set(snapshot.blocks);
        this.connections.set(snapshot.connections);
        const selected = this.selected_block();
        if (selected) {
            this.selected_block.set(
                snapshot.blocks.find((b) => b.id === selected.id) ?? null,
            );
        }
    }

    private _updateHistorySignals(): void {
        this.can_undo.set(this._undo_stack.length > 0);
        this.can_redo.set(this._redo_stack.length > 0);
    }

    /**
     * Record the current workflow before a mutation. Rapid repeats with the
     * same coalesce key (e.g. typing in a settings field) collapse into one
     * undo step.
     */
    private _pushHistory(coalesce_key?: string): void {
        const now = Date.now();
        if (
            coalesce_key &&
            coalesce_key === this._last_history_key &&
            now - this._last_history_time < HISTORY_COALESCE_MS
        ) {
            this._last_history_time = now;
            return;
        }
        this._undo_stack.push(this._snapshot());
        if (this._undo_stack.length > HISTORY_LIMIT) this._undo_stack.shift();
        this._redo_stack = [];
        this._last_history_key = coalesce_key ?? null;
        this._last_history_time = now;
        this._updateHistorySignals();
    }

    private _clearHistory(): void {
        this._undo_stack = [];
        this._redo_stack = [];
        this._last_history_key = null;
        this._updateHistorySignals();
    }

    public undo(): void {
        const snapshot = this._undo_stack.pop();
        if (!snapshot) return;
        this._redo_stack.push(this._snapshot());
        this._restore(snapshot);
        this._last_history_key = null;
        this._updateHistorySignals();
    }

    public redo(): void {
        const snapshot = this._redo_stack.pop();
        if (!snapshot) return;
        this._undo_stack.push(this._snapshot());
        this._restore(snapshot);
        this._last_history_key = null;
        this._updateHistorySignals();
    }

    public addBlock(block_data: Omit<WorkflowBlock, 'id'>): void {
        this._pushHistory();
        const snapped_position = this.snapToGrid(
            block_data.position.x,
            block_data.position.y,
        );
        const new_block: WorkflowBlock = {
            ...block_data,
            position: snapped_position,
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        if (
            new_block.module === undefined &&
            (new_block.type === 'input' || new_block.type === 'output') &&
            this.categoryNeedsModule(new_block.category) &&
            this.available_modules().length
        ) {
            new_block.module = this.resolveModuleForCategory(
                new_block.category,
            );
        }
        this.blocks.update((blocks) => [...blocks, new_block]);
    }

    public updateBlock(id: string, updates: Partial<WorkflowBlock>): void {
        this._pushHistory(
            `update:${id}:${Object.keys(updates).sort().join(',')}`,
        );
        if (updates.position) {
            updates.position = this.snapToGrid(
                updates.position.x,
                updates.position.y,
            );
        }
        this.blocks.update((blocks) =>
            blocks.map((block) =>
                block.id === id ? { ...block, ...updates } : block,
            ),
        );
        const selected = this.selected_block();
        if (selected && selected.id === id) {
            this.selected_block.set({ ...selected, ...updates });
        }
    }

    public removeBlock(id: string): void {
        this._pushHistory();
        this.blocks.update((blocks) => blocks.filter((b) => b.id !== id));
        this.connections.update((conns) =>
            conns.filter((c) => c.from !== id && c.to !== id),
        );
        const selected = this.selected_block();
        if (selected && selected.id === id) {
            this.selected_block.set(null);
        }
    }

    public selectBlock(block: WorkflowBlock | null): void {
        this.selected_block.set(block);
    }

    public addConnection(from: string, to: string): void {
        const existing = this.connections().find(
            (c) => c.from === from && c.to === to,
        );
        if (existing) return;

        this._pushHistory();
        const existing_input = this.connections().find((c) => c.to === to);
        if (existing_input) {
            this.connections.update((conns) =>
                conns.filter((c) => c.id !== existing_input.id),
            );
        }

        const new_connection: Connection = {
            id: `connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            from,
            to,
            fromPort: 'output',
            toPort: 'input',
        };
        this.connections.update((conns) => [...conns, new_connection]);
    }

    public removeConnection(id: string): void {
        if (!this.connections().some((c) => c.id === id)) return;
        this._pushHistory();
        this.connections.update((conns) => conns.filter((c) => c.id !== id));
    }

    public startConnection(block_id: string, port: string): void {
        this.is_connecting.set(true);
        this.connection_start.set({ blockId: block_id, port });
    }

    public endConnection(block_id: string, port: string): void {
        const start = this.connection_start();
        if (start && start.blockId !== block_id) {
            if (start.port === 'output' && port === 'input') {
                this.addConnection(start.blockId, block_id);
            } else if (start.port === 'input' && port === 'output') {
                this.addConnection(block_id, start.blockId);
            }
        }
        this.cancelConnection();
    }

    public cancelConnection(): void {
        this.is_connecting.set(false);
        this.connection_start.set(null);
        this.hovered_block.set(null);
    }

    public saveSkill(name: string, description: string): SkillData {
        const existing = this.current_skill();
        const now = new Date().toISOString();
        const skill_data: SkillData = {
            name,
            description,
            blocks: this.blocks(),
            connections: this.connections(),
            system_id:
                this.current_system_id() || existing?.system_id || '',
            enabled: this.skill_enabled(),
            createdAt: existing?.createdAt || now,
            updatedAt: now,
        };

        const saved_skills: SkillData[] = JSON.parse(
            localStorage.getItem('BACKOFFICE.SKILLS') || '[]',
        );
        const index = saved_skills.findIndex(
            (s) => s.createdAt === skill_data.createdAt,
        );
        if (index >= 0) saved_skills[index] = skill_data;
        else saved_skills.push(skill_data);
        localStorage.setItem(
            'BACKOFFICE.SKILLS',
            JSON.stringify(saved_skills),
        );
        this.current_skill.set(skill_data);
        return skill_data;
    }

    public loadSkill(skill_data: SkillData): void {
        this.blocks.set(skill_data.blocks || []);
        this.connections.set(skill_data.connections || []);
        this.selected_block.set(null);
        this.current_skill.set(skill_data);
        this.skill_enabled.set(skill_data.enabled ?? true);
        this.pan.set({ x: 0, y: 0 });
        this.scale.set(1);
        this._clearHistory();
        if (skill_data.system_id) {
            this.setSystemId(skill_data.system_id);
            this.loadSystemModules(skill_data.system_id);
        }
    }

    public setSkillEnabled(enabled: boolean): void {
        this.skill_enabled.set(enabled);
        const current = this.current_skill();
        if (!current) return;
        const updated = { ...current, enabled };
        this.current_skill.set(updated);
        const saved_skills: SkillData[] = JSON.parse(
            localStorage.getItem('BACKOFFICE.SKILLS') || '[]',
        );
        const index = saved_skills.findIndex(
            (s) => s.createdAt === current.createdAt,
        );
        if (index >= 0) {
            saved_skills[index] = updated;
            localStorage.setItem(
                'BACKOFFICE.SKILLS',
                JSON.stringify(saved_skills),
            );
        }
    }

    public loadSkillById(created_at: string): boolean {
        const saved_skills: SkillData[] = JSON.parse(
            localStorage.getItem('BACKOFFICE.SKILLS') || '[]',
        );
        const skill = saved_skills.find((s) => s.createdAt === created_at);
        if (!skill) return false;
        this.loadSkill(skill);
        return true;
    }

    /** Empty the canvas as an undoable action, keeping the current skill */
    public clearCanvas(): void {
        if (!this.blocks().length && !this.connections().length) return;
        this._pushHistory();
        this.blocks.set([]);
        this.connections.set([]);
        this.selected_block.set(null);
        this.cancelConnection();
    }

    /** Full reset when starting a new skill */
    public clearWorkflow(): void {
        this.blocks.set([]);
        this.connections.set([]);
        this.selected_block.set(null);
        this.current_skill.set(null);
        this.skill_enabled.set(true);
        this.pan.set({ x: 0, y: 0 });
        this.scale.set(1);
        this._clearHistory();
        this.cancelConnection();
    }

    private _validate(
        blocks: WorkflowBlock[],
        connections: Connection[],
    ): ValidationIssue[] {
        if (!blocks.length) return [];
        const issues: ValidationIssue[] = [];

        const inputs = blocks.filter((b) => b.type === 'input');
        const outputs = blocks.filter((b) => b.type === 'output');
        if (!inputs.length) {
            issues.push({
                level: 'error',
                message: 'Add at least one input block to trigger the workflow',
            });
        }
        if (!outputs.length) {
            issues.push({
                level: 'error',
                message: 'Add at least one output block to perform an action',
            });
        }

        const connected = new Set<string>();
        for (const conn of connections) {
            connected.add(conn.from);
            connected.add(conn.to);
        }
        const dangling = blocks.filter(
            (b) => !connected.has(b.id) && blocks.length > 1,
        );
        for (const block of dangling) {
            issues.push({
                level: 'warning',
                message: `"${block.category}" is not connected to anything`,
            });
        }

        if (this._hasCycle(blocks, connections)) {
            issues.push({
                level: 'error',
                message: 'Workflow contains a circular connection',
            });
        } else if (inputs.length && outputs.length) {
            const reachable = this._reachableFrom(
                inputs.map((i) => i.id),
                connections,
            );
            for (const output of outputs) {
                if (connected.has(output.id) && !reachable.has(output.id)) {
                    issues.push({
                        level: 'warning',
                        message: `"${output.category}" is not reachable from any input`,
                    });
                }
            }
        }
        return issues;
    }

    private _hasCycle(
        blocks: WorkflowBlock[],
        connections: Connection[],
    ): boolean {
        const adjacency = new Map<string, string[]>();
        for (const conn of connections) {
            adjacency.set(conn.from, [
                ...(adjacency.get(conn.from) || []),
                conn.to,
            ]);
        }
        const visiting = new Set<string>();
        const visited = new Set<string>();
        const visit = (id: string): boolean => {
            if (visiting.has(id)) return true;
            if (visited.has(id)) return false;
            visiting.add(id);
            for (const next of adjacency.get(id) || []) {
                if (visit(next)) return true;
            }
            visiting.delete(id);
            visited.add(id);
            return false;
        };
        return blocks.some((b) => visit(b.id));
    }

    private _reachableFrom(
        start_ids: string[],
        connections: Connection[],
    ): Set<string> {
        const reachable = new Set<string>(start_ids);
        const queue = [...start_ids];
        while (queue.length) {
            const id = queue.shift();
            for (const conn of connections) {
                if (conn.from === id && !reachable.has(conn.to)) {
                    reachable.add(conn.to);
                    queue.push(conn.to);
                }
            }
        }
        return reachable;
    }

    public simulateWorkflow(): void {
        const blocks_array = this.blocks();
        const connections_array = this.connections();
        const inputs = blocks_array.filter((b) => b.type === 'input');
        const outputs = blocks_array.filter((b) => b.type === 'output');

        const errors = this.validation_issues().filter(
            (issue) => issue.level === 'error',
        );
        if (!blocks_array.length || errors.length) {
            alert(
                'Cannot run this workflow:\n\n' +
                    (errors.map((e) => `• ${e.message}`).join('\n') ||
                        '• Workflow is empty'),
            );
            return;
        }

        const occ = inputs.find((b) =>
            b.category.toLowerCase().includes('occupancy'),
        ) || inputs[0];
        const threshold = Number(occ.settings?.threshold ?? 1);
        const condition = String(occ.settings?.condition ?? 'greater_than');
        const simulated_count = Number(
            occ.settings?.simulatedCount ?? threshold + 1,
        );

        const ok =
            condition === 'less_than'
                ? simulated_count < threshold
                : condition === 'equals'
                  ? simulated_count === threshold
                  : simulated_count > threshold;

        const connected_outputs = connections_array
            .filter((c) => c.from === occ.id)
            .map((c) => blocks_array.find((b) => b.id === c.to))
            .filter(
                (b): b is WorkflowBlock => !!b && b.type === 'output',
            );

        const targets = connected_outputs.length
            ? connected_outputs
            : outputs;

        const mode_label =
            this.execution_mode() === 'simulate'
                ? 'SIMULATION'
                : 'PRODUCTION (dry-run only)';
        const summary = [
            `[${mode_label}] Input: ${occ.category}`,
            `Simulated occupancy: ${simulated_count}`,
            `Threshold check: ${condition} ${threshold} => ${ok ? 'TRUE' : 'FALSE'}`,
            ok
                ? `Would trigger outputs: ${targets.map((t) => t.category).join(', ')}`
                : 'Would trigger outputs: (none)',
            '',
            'Note: Production execution is not wired yet. This is a safe preview.',
        ].join('\n');

        console.log(summary);
        alert(summary);
    }
}
