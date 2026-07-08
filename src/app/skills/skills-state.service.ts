import { computed, inject, Injectable, signal } from '@angular/core';
import {
    addSystemTrigger,
    addTrigger,
    functionList,
    PlaceModule,
    queryModules,
    showSystem,
    systemModuleState,
    TriggerActions,
    TriggerConditionOperator,
    TriggerConditions,
    updateTrigger,
} from '@placeos/ts-client';
import { firstValueFrom } from 'rxjs';
import { calculateModuleIndex } from '../common/api';
import { SkillsPersistenceService } from './skills-persistence.service';
import {
    BlockBinding,
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

export interface ModuleFunction {
    name: string;
    params: string[];
}

export interface SimulationResult {
    ok: boolean;
    errors: string[];
    summary: string;
}

const HISTORY_LIMIT = 50;
const HISTORY_COALESCE_MS = 1000;

const OPERATOR_MAP: Record<string, TriggerConditionOperator> = {
    greater_than: TriggerConditionOperator.GT,
    less_than: TriggerConditionOperator.LT,
    equals: TriggerConditionOperator.EQ,
};

@Injectable({
    providedIn: 'root',
})
export class SkillsStateService {
    private _persistence = inject(SkillsPersistenceService);

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
    /** Whether the workflow has changes that have not been saved */
    public readonly dirty = signal(false);
    public readonly saving = signal(false);
    public readonly execution_mode = signal<ExecutionMode>('simulate');

    public readonly validation_issues = computed<ValidationIssue[]>(() =>
        this._validate(this.blocks(), this.connections()),
    );

    private _undo_stack: WorkflowSnapshot[] = [];
    private _redo_stack: WorkflowSnapshot[] = [];
    private _last_history_key: string | null = null;
    private _last_history_time = 0;
    public readonly available_modules = signal<PlaceOSModule[]>([]);
    /** Function lists for modules, keyed by the module reference (\`HVAC_1\`) */
    public readonly module_functions = signal<
        Record<string, ModuleFunction[]>
    >({});
    /** Status variables for modules, keyed by the module reference */
    public readonly module_statuses = signal<Record<string, string[]>>({});
    public readonly current_system_id = signal<string | null>(null);
    public readonly current_system_name = signal<string>('');
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
                queryModules({ control_system_id: system_id, limit: 500 }),
            );
            const system_modules = modules_response.data.filter(
                (m: PlaceModule) =>
                    !m.control_system_id ||
                    m.control_system_id === system_id,
            );
            this.available_modules.set(
                system_modules.map((m: PlaceModule) => {
                    const module_class =
                        m.custom_name || m.name || m.driver?.module_name;
                    const index = calculateModuleIndex(system_modules, m);
                    return {
                        id: m.id,
                        name: m.driver?.module_name || m.name,
                        custom_name: m.custom_name,
                        driver_id: m.driver?.id,
                        mod: `${module_class}_${index}`,
                        display_name: `${module_class}_${index}`,
                    };
                }),
            );
        } catch (e) {
            console.error('Failed to load modules for system', system_id, e);
            this.available_modules.set([]);
        }
        this._backfillBlockBindings();
    }

    /** Load the status variables exposed by a module (for input bindings) */
    public async loadModuleStatuses(mod: string): Promise<string[]> {
        const cached = this.module_statuses()[mod];
        if (cached) return cached;
        const system_id = this.current_system_id();
        if (!system_id) return [];
        const { module_class, index } = this._splitModuleRef(mod);
        let statuses: string[] = [];
        try {
            const state = await firstValueFrom(
                systemModuleState(system_id, module_class, index),
            );
            statuses = Object.keys(state || {});
        } catch (e) {
            console.warn('Failed to load module state for', mod, e);
        }
        this.module_statuses.update((map) => ({ ...map, [mod]: statuses }));
        return statuses;
    }

    /** Load the functions exposed by a module (for output bindings) */
    public async loadModuleFunctions(mod: string): Promise<ModuleFunction[]> {
        const cached = this.module_functions()[mod];
        if (cached) return cached;
        const system_id = this.current_system_id();
        if (!system_id) return [];
        const { module_class, index } = this._splitModuleRef(mod);
        let functions: ModuleFunction[] = [];
        try {
            const fn_map = await firstValueFrom(
                functionList(system_id, module_class, index),
            );
            functions = Object.entries(fn_map || {}).map(
                ([name, details]: [string, any]) => ({
                    name,
                    params: Object.keys(details?.params || {}),
                }),
            );
        } catch (e) {
            console.warn('Failed to load function list for', mod, e);
        }
        this.module_functions.update((map) => ({ ...map, [mod]: functions }));
        return functions;
    }

    private _splitModuleRef(mod: string): {
        module_class: string;
        index: number;
    } {
        const parts = (mod || '').split('_');
        const index = +parts[parts.length - 1];
        if (parts.length > 1 && !isNaN(index)) {
            return {
                module_class: parts.slice(0, parts.length - 1).join('_'),
                index,
            };
        }
        return { module_class: mod, index: 1 };
    }

    /** Whether a block category is backed by a hardware module at all */
    public categoryNeedsModule(category: string): boolean {
        return !!CATEGORY_MODULE_PATTERNS[category]?.length;
    }

    /**
     * Find the system module backing a block category, matching the same
     * name patterns used for palette availability.
     */
    public resolveModuleForCategory(category: string): BlockBinding | null {
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
            ? {
                  module_id: module.id,
                  mod: module.mod,
                  module_name: module.custom_name || module.name,
              }
            : null;
    }

    /** Link modules to blocks added before the module list loaded */
    private _backfillBlockBindings(): void {
        if (!this.available_modules().length) return;
        const resolvable = (b: WorkflowBlock) =>
            (b.type === 'input' || b.type === 'output') &&
            b.binding === undefined &&
            this.categoryNeedsModule(b.category);
        if (!this.blocks().some(resolvable)) return;
        this.blocks.update((blocks) =>
            blocks.map((b) =>
                resolvable(b)
                    ? {
                          ...b,
                          binding: this.resolveModuleForCategory(b.category),
                      }
                    : b,
            ),
        );
    }

    public setExecutionMode(mode: ExecutionMode): void {
        this.execution_mode.set(mode);
        localStorage.setItem('BACKOFFICE.SKILLS.executionMode', mode);
    }

    public setSystemId(system_id: string, system_name?: string): void {
        const changed = this.current_system_id() !== system_id;
        if (changed) {
            this.module_statuses.set({});
            this.module_functions.set({});
        }
        this.current_system_id.set(system_id);
        if (system_name) {
            this.current_system_name.set(system_name);
        } else if (system_id && (changed || !this.current_system_name())) {
            this.current_system_name.set('');
            firstValueFrom(showSystem(system_id))
                .then((system) =>
                    this.current_system_name.set(system?.name || system_id),
                )
                .catch(() => this.current_system_name.set(system_id));
        }
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
        this.dirty.set(true);
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
        this.dirty.set(true);
        this._updateHistorySignals();
    }

    public redo(): void {
        const snapshot = this._redo_stack.pop();
        if (!snapshot) return;
        this._undo_stack.push(this._snapshot());
        this._restore(snapshot);
        this._last_history_key = null;
        this.dirty.set(true);
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
            new_block.binding === undefined &&
            (new_block.type === 'input' || new_block.type === 'output') &&
            this.categoryNeedsModule(new_block.category) &&
            this.available_modules().length
        ) {
            new_block.binding = this.resolveModuleForCategory(
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

    public async saveSkill(
        name: string,
        description: string,
    ): Promise<SkillData> {
        const existing = this.current_skill();
        const now = new Date().toISOString();
        const skill_data: SkillData = {
            name,
            description,
            blocks: this.blocks(),
            connections: this.connections(),
            system_id: this.current_system_id() || existing?.system_id || '',
            system_name:
                this.current_system_name() || existing?.system_name || '',
            enabled: this.skill_enabled(),
            trigger_id: existing?.trigger_id || null,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
        };
        this.saving.set(true);
        try {
            await this._persistence.saveSkill(skill_data);
            this.current_skill.set(skill_data);
            this.dirty.set(false);
        } finally {
            this.saving.set(false);
        }
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
        this.dirty.set(false);
        this._clearHistory();
        if (skill_data.system_id) {
            this.setSystemId(skill_data.system_id, skill_data.system_name);
            this.loadSystemModules(skill_data.system_id);
        }
    }

    public async setSkillEnabled(enabled: boolean): Promise<void> {
        this.skill_enabled.set(enabled);
        const current = this.current_skill();
        if (!current) return;
        const updated = { ...current, enabled };
        this.current_skill.set(updated);
        await this._persistence.saveSkill(updated);
    }

    public async loadSkillById(
        created_at: string,
        system_id?: string,
    ): Promise<boolean> {
        const skill = await this._persistence.loadSkill(
            created_at,
            system_id,
        );
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
        this.dirty.set(false);
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
                message:
                    'Add at least one input block to trigger the workflow',
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

        for (const input of inputs) {
            if (!input.binding?.mod || !input.binding.status) {
                issues.push({
                    level: 'warning',
                    message: `"${input.category}" is not bound to a module status variable`,
                });
            }
        }
        for (const output of outputs) {
            if (!output.binding?.mod || !output.binding.method) {
                issues.push({
                    level: 'warning',
                    message: `"${output.category}" is not bound to a module function`,
                });
            }
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

    /* Trigger compilation */

    /**
     * Compile the workflow graph into PlaceTrigger conditions and actions.
     * Input bindings become status comparisons, and output bindings that are
     * reachable from an input become function executes.
     */
    public compileToTrigger(): {
        conditions: TriggerConditions;
        actions: TriggerActions;
        issues: string[];
    } {
        const blocks = this.blocks();
        const connections = this.connections();
        const issues: string[] = [];
        const inputs = blocks.filter((b) => b.type === 'input');
        const outputs = blocks.filter((b) => b.type === 'output');
        const reachable = this._reachableFrom(
            inputs.map((i) => i.id),
            connections,
        );

        const comparisons = [];
        for (const input of inputs) {
            const binding = input.binding;
            if (!binding?.mod || !binding.status) {
                issues.push(
                    `"${input.category}" is not bound to a module status variable`,
                );
                continue;
            }
            const operator =
                OPERATOR_MAP[String(input.settings?.condition)] ||
                TriggerConditionOperator.GT;
            const threshold = input.settings?.threshold ?? 1;
            comparisons.push({
                left: { mod: binding.mod, status: binding.status, keys: [] },
                operator,
                right: isNaN(Number(threshold))
                    ? String(threshold)
                    : Number(threshold),
            });
        }

        const functions = [];
        for (const output of outputs) {
            if (!reachable.has(output.id)) continue;
            const binding = output.binding;
            if (!binding?.mod || !binding.method) {
                issues.push(
                    `"${output.category}" is not bound to a module function`,
                );
                continue;
            }
            functions.push({
                mod: binding.mod,
                method: binding.method,
                args: binding.args || {},
            });
        }

        if (!comparisons.length) {
            issues.push('No input conditions could be compiled');
        }
        if (!functions.length) {
            issues.push('No output actions could be compiled');
        }
        const unsupported = blocks.filter((b) =>
            ['logic', 'agent', 'communication'].includes(b.type),
        );
        if (unsupported.length) {
            issues.push(
                `${unsupported.length} logic/agent/communication block(s) are not yet supported by trigger compilation and will be ignored`,
            );
        }

        return {
            conditions: { comparisons, time_dependents: [] },
            actions: { functions, mailers: [] },
            issues,
        };
    }

    /**
     * Deploy the skill as a PlaceTrigger attached to the current system.
     * The skill must be saved first so the trigger can be linked back to it.
     */
    public async deploySkill(): Promise<SkillData> {
        const skill = this.current_skill();
        const system_id = this.current_system_id();
        if (!skill || !system_id) {
            throw new Error('Save the skill before deploying it');
        }
        if (this.dirty()) {
            throw new Error('Save your changes before deploying');
        }
        const { conditions, actions, issues } = this.compileToTrigger();
        if (!conditions.comparisons.length || !actions.functions.length) {
            throw new Error(
                'Cannot deploy this workflow:\n' +
                    issues.map((i) => `• ${i}`).join('\n'),
            );
        }
        const trigger_data = {
            name: `Skill: ${skill.name}`,
            description: skill.description || `Compiled from the "${skill.name}" skill`,
            conditions,
            actions,
            enabled: this.skill_enabled(),
        };
        let updated = { ...skill };
        if (updated.trigger_id) {
            await firstValueFrom(
                updateTrigger(updated.trigger_id, trigger_data),
            );
        } else {
            const trigger = await firstValueFrom(addTrigger(trigger_data));
            // Record the trigger against the skill immediately so a failed
            // attach below doesn't orphan it and re-create on retry
            updated = { ...updated, trigger_id: trigger.id };
            this.current_skill.set(updated);
            await this._persistence.saveSkill(updated);
        }
        if (!updated.trigger_attached) {
            await firstValueFrom(
                addSystemTrigger(system_id, {
                    control_system_id: system_id,
                    enabled: true,
                    important: false,
                    trigger_id: updated.trigger_id,
                } as any),
            );
            updated = { ...updated, trigger_attached: true };
        }
        this.current_skill.set(updated);
        await this._persistence.saveSkill(updated);
        return updated;
    }

    /** Dry-run the workflow and describe what would happen */
    public simulateWorkflow(): SimulationResult {
        const blocks_array = this.blocks();
        const connections_array = this.connections();
        const inputs = blocks_array.filter((b) => b.type === 'input');
        const outputs = blocks_array.filter((b) => b.type === 'output');

        const errors = this.validation_issues()
            .filter((issue) => issue.level === 'error')
            .map((issue) => issue.message);
        if (!blocks_array.length || errors.length) {
            return {
                ok: false,
                errors: errors.length ? errors : ['Workflow is empty'],
                summary: '',
            };
        }

        const occ =
            inputs.find((b) =>
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
            .filter((b): b is WorkflowBlock => !!b && b.type === 'output');

        const targets = connected_outputs.length
            ? connected_outputs
            : outputs;

        const describe = (block: WorkflowBlock) =>
            block.binding?.mod && block.binding.method
                ? `${block.category} → ${block.binding.mod}.${block.binding.method}()`
                : block.category;

        const input_label = occ.binding?.mod
            ? `${occ.category} (${occ.binding.mod}${occ.binding.status ? '.' + occ.binding.status : ''})`
            : occ.category;

        const summary = [
            `Input: ${input_label}`,
            `Simulated value: ${simulated_count}`,
            `Condition: ${condition.replace(/_/g, ' ')} ${threshold} → ${ok ? 'TRUE' : 'FALSE'}`,
            ok
                ? `Would run: ${targets.map(describe).join(', ')}`
                : 'Would run: (nothing — condition not met)',
        ].join('\n');

        return { ok: true, errors: [], summary };
    }
}
