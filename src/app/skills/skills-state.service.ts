import { Injectable, signal } from '@angular/core';
import { queryModules, PlaceModule } from '@placeos/ts-client';
import { firstValueFrom } from 'rxjs';
import {
    Connection,
    ExecutionMode,
    PlaceOSModule,
    SkillData,
    WorkflowBlock,
} from './skills.types';

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
    public readonly execution_mode = signal<ExecutionMode>('simulate');
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

    public addBlock(block_data: Omit<WorkflowBlock, 'id'>): void {
        const snapped_position = this.snapToGrid(
            block_data.position.x,
            block_data.position.y,
        );
        const new_block: WorkflowBlock = {
            ...block_data,
            position: snapped_position,
            id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        this.blocks.update((blocks) => [...blocks, new_block]);
    }

    public updateBlock(id: string, updates: Partial<WorkflowBlock>): void {
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
        if (skill_data.system_id) {
            this.setSystemId(skill_data.system_id);
            this.loadSystemModules(skill_data.system_id);
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

    public clearWorkflow(): void {
        this.blocks.set([]);
        this.connections.set([]);
        this.selected_block.set(null);
        this.current_skill.set(null);
        this.cancelConnection();
    }

    public simulateWorkflow(): void {
        const blocks_array = this.blocks();
        const connections_array = this.connections();
        const inputs = blocks_array.filter((b) => b.type === 'input');
        const outputs = blocks_array.filter((b) => b.type === 'output');

        if (!inputs.length || !outputs.length) {
            alert('Add at least one input and one output block before running.');
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
