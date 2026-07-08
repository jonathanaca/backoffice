import { ModuleFunction } from './skills-state.service';
import { CATEGORY_MODULE_PATTERNS, PlaceOSModule } from './skills.types';

/**
 * A virtual system for demos: every block category resolves to a module so
 * the whole palette is active, and the binding pickers are fed canned data.
 * Skills built against it persist like any other, but cannot be deployed.
 */
export const DEMO_SYSTEM_ID = 'sys-demo';
export const DEMO_SYSTEM_NAME = 'Demo System';

/** One module per category that needs hardware, named to match its patterns */
export function demoModules(): PlaceOSModule[] {
    return Object.entries(CATEGORY_MODULE_PATTERNS)
        .filter(([, patterns]) => patterns.length)
        .map(([category, patterns], index) => {
            const module_class = category.replace(/[^A-Za-z0-9]/g, '');
            return {
                id: `demo-mod-${index}`,
                name: patterns[0],
                custom_name: `Demo ${category}`,
                mod: `${module_class}_1`,
                display_name: `${module_class}_1`,
            };
        });
}

export const DEMO_MODULE_STATUSES: string[] = [
    'presence',
    'people_count',
    'level',
    'state',
    'temperature',
    'humidity',
    'power',
    'connected',
];

export const DEMO_MODULE_FUNCTIONS: ModuleFunction[] = [
    { name: 'power', params: ['state'] },
    { name: 'set_level', params: ['level'] },
    { name: 'toggle', params: [] },
    { name: 'set_value', params: ['value'] },
    { name: 'notify', params: ['message'] },
];
