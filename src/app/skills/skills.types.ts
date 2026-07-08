export interface BlockModuleRef {
    id: string;
    name: string;
}

export interface WorkflowBlock {
    id: string;
    type: 'input' | 'output' | 'logic' | 'agent' | 'communication';
    category: string;
    position: { x: number; y: number };
    settings?: Record<string, any>;
    comments?: string;
    /** The system module this block reads from / acts on */
    module?: BlockModuleRef | null;
}

/**
 * Driver/module name patterns for each block category. Used to check block
 * availability and to resolve which module a block is backed by. An empty
 * list means the block is software-only and always available.
 */
export const CATEGORY_MODULE_PATTERNS: Record<string, string[]> = {
    'Occupancy': ['occupancy', 'sensor', 'people counter'],
    'Power State': ['power', 'pdu', 'relay'],
    'Booking': ['booking', 'calendar', 'exchange'],
    'Sensor': ['sensor'],
    'Motion': ['motion', 'camera', 'pir'],
    'Sound Level': ['audio', 'microphone', 'sound'],
    'Light Level': ['light', 'sensor'],
    'Security': ['security', 'access'],
    'Temperature': ['temperature', 'sensor', 'hvac', 'climate'],
    'Humidity': ['humidity', 'sensor', 'climate'],
    'HVAC': ['hvac', 'climate', 'aircon', 'ac'],
    'Access': ['access', 'door', 'lock'],
    'Lighting': ['lighting', 'light', 'dmx', 'dali'],
    'Audio Visual': ['display', 'screen', 'projector', 'av'],
    'Display Control': ['display', 'screen'],
    'Blinds/Shades': ['blind', 'shade', 'curtain'],
    'Notification': [], // Always available (software-only)
    'Email Alert': [], // Always available (software-only)
    'Time Schedule': [], // Always available (software-only)
    'Calendar Event': ['calendar', 'booking'],
    'Location': ['location', 'beacon'],
    'Network Status': [], // Always available (software-only)
    'Device Status': [], // Always available (checks other modules)
    'Mobile App': [], // Always available (software-only)
    'Room Functions': ['logic'], // Always available (generic)
};

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
