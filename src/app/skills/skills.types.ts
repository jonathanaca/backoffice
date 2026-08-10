/** Link between a block and a real module in the skill's system */
export interface BlockBinding {
    /** Database ID of the module */
    module_id: string;
    /** Module reference used by triggers/execute, e.g. \`Occupancy_1\` */
    mod: string;
    /** Human-friendly module name for display */
    module_name: string;
    /** Status variable watched by input blocks, e.g. \`presence\` */
    status?: string;
    /** Function executed by output blocks, e.g. \`power\` */
    method?: string;
    /** Arguments passed to the function */
    args?: Record<string, any>;
}

export interface WorkflowBlock {
    id: string;
    type: 'input' | 'output' | 'logic' | 'agent' | 'communication';
    category: string;
    position: { x: number; y: number };
    settings?: Record<string, any>;
    comments?: string;
    /** The system module this block reads from / acts on */
    binding?: BlockBinding | null;
}

/** The category name for the workplace-event input block */
export const WORKPLACE_EVENTS_CATEGORY = 'Workplace Events';

export interface WorkplaceEvent {
    /** Status/trigger key, matching mailer template trigger naming */
    key: string;
    label: string;
    description: string;
}

/**
 * Workplace lifecycle events, grouped by domain. These mirror the trigger
 * points used by the mailer template system (e.g. \`visitor_invited\`), so a
 * skill can react to the same moments that template emails are sent for —
 * but trigger any action instead.
 */
export const WORKPLACE_EVENTS: { group: string; events: WorkplaceEvent[] }[] = [
    {
        group: 'Visitors',
        events: [
            {
                key: 'visitor_invited',
                label: 'Visitor invited',
                description: 'A visitor is invited to an event or booking',
            },
            {
                key: 'visitor_arrived',
                label: 'Visitor arrived',
                description: 'A visitor checks in at reception or a kiosk',
            },
            {
                key: 'visitor_checked_out',
                label: 'Visitor checked out',
                description: 'A visitor leaves the building',
            },
        ],
    },
    {
        group: 'Meetings',
        events: [
            {
                key: 'meeting_checked_in',
                label: 'Meeting room check-in',
                description: 'A host checks in to their meeting room',
            },
            {
                key: 'meeting_no_show',
                label: 'Meeting no-show',
                description: 'A booked room is never checked in to',
            },
            {
                key: 'meeting_cancelled',
                label: 'Meeting cancelled',
                description: 'A booking is cancelled by the organiser',
            },
            {
                key: 'meeting_ended_early',
                label: 'Meeting ended early',
                description: 'A room is released before the booking ends',
            },
        ],
    },
    {
        group: 'Desks',
        events: [
            {
                key: 'desk_booked',
                label: 'Desk booked',
                description: 'A desk booking is created',
            },
            {
                key: 'desk_checked_in',
                label: 'Desk check-in',
                description: 'Someone checks in to their booked desk',
            },
            {
                key: 'desk_released',
                label: 'Desk released',
                description: 'A desk booking is released or expires',
            },
        ],
    },
    {
        group: 'Parking',
        events: [
            {
                key: 'car_space_allocated',
                label: 'Car space allocated',
                description: 'A parking space is assigned to someone',
            },
            {
                key: 'car_space_released',
                label: 'Car space released',
                description: 'A parking space becomes available again',
            },
        ],
    },
];

/**
 * Driver/module name patterns for each block category. Used to check block
 * availability and to resolve which module a block is backed by. An empty
 * list means the block is software-only and always available.
 */
export const CATEGORY_MODULE_PATTERNS: Record<string, string[]> = {
    [WORKPLACE_EVENTS_CATEGORY]: [
        'mailer',
        'booking',
        'visitor',
        'calendar',
        'desk',
    ],
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
    /** Module reference within the system, e.g. \`Occupancy_1\` */
    mod: string;
    /** Display name for pickers */
    display_name: string;
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
    system_name?: string;
    enabled?: boolean;
    /** ID of the PlaceTrigger this skill was compiled to, if deployed */
    trigger_id?: string | null;
    /** Whether the trigger has been attached to the system as an instance */
    trigger_attached?: boolean;
    createdAt: string;
    updatedAt?: string;
}
