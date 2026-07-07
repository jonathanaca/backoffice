export interface WorkflowBlock {
    id: string;
    type: 'input' | 'output' | 'logic' | 'agent' | 'communication';
    category: string;
    position: { x: number; y: number };
    settings?: Record<string, any>;
    comments?: string;
}

export interface Connection {
    id: string;
    from: string;
    to: string;
    fromPort?: 'output';
    toPort?: 'input';
}

export interface PlaceOSModule {
    id: string;
    name: string;
    custom_name?: string;
    driver_id?: string;
}

export type ExecutionMode = 'simulate' | 'production';

export interface ValidationIssue {
    level: 'error' | 'warning';
    message: string;
}

export interface SkillData {
    name: string;
    description: string;
    blocks: WorkflowBlock[];
    connections: Connection[];
    system_id: string;
    enabled?: boolean;
    createdAt: string;
    updatedAt?: string;
}
