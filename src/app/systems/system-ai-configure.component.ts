import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AsyncHandler } from '../common/async-handler.class';
import { ActiveItemService } from '../common/item.service';
import { IconComponent } from '../ui/icon.component';
import { TranslatePipe } from '../ui/translate.pipe';

interface ModuleSuggestion {
    driver_name: string;
    role: string;
    settings: Record<string, any>;
    reasoning: string;
}

interface ConfigurationPlan {
    modules: ModuleSuggestion[];
    zones: string[];
    triggers: any[];
    metadata: Record<string, any>;
}

@Component({
    selector: 'system-ai-configure',
    template: `
        <div class="flex h-full flex-col overflow-hidden p-4">
            <div class="mb-4">
                <h2 class="text-2xl font-semibold">Configure System with Claude</h2>
                <p class="text-base-content/70 mt-1 text-sm">
                    AI-powered system configuration using PlaceOS documentation
                    and best practices
                </p>
            </div>

            @if (!configuring() && !configuration_plan()) {
                <div class="flex flex-1 flex-col gap-4 overflow-auto">
                    <!-- System Purpose -->
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >What is this system for?</label
                        >
                        <textarea
                            [(ngModel)]="system_purpose"
                            placeholder="e.g., Meeting room with video conferencing, lighting control, and display management"
                            rows="3"
                            class="border-base-300 bg-base-100 w-full rounded-lg border px-3 py-2"
                        ></textarea>
                    </div>

                    <!-- Available Devices -->
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Available Devices</label
                        >
                        <textarea
                            [(ngModel)]="available_devices"
                            placeholder="List the devices in this space (e.g., Cisco Webex codec, Lutron lighting processor, Samsung displays)"
                            rows="4"
                            class="border-base-300 bg-base-100 w-full rounded-lg border px-3 py-2"
                        ></textarea>
                    </div>

                    <!-- Building/Location Info -->
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Building & Location</label
                        >
                        <input
                            type="text"
                            [(ngModel)]="location"
                            placeholder="e.g., Level 3, Building A"
                            class="border-base-300 bg-base-100 w-full rounded-lg border px-3 py-2"
                        />
                    </div>

                    <!-- Special Requirements -->
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Special Requirements (Optional)</label
                        >
                        <textarea
                            [(ngModel)]="special_requirements"
                            placeholder="Any specific configuration needs, integrations, or constraints"
                            rows="3"
                            class="border-base-300 bg-base-100 w-full rounded-lg border px-3 py-2"
                        ></textarea>
                    </div>

                    <!-- Configure Button -->
                    <div class="flex justify-end gap-3 pt-4">
                        <button
                            class="border-base-300 hover:bg-base-200 rounded-lg border px-4 py-2"
                            (click)="reset()"
                        >
                            Reset
                        </button>
                        <button
                            class="bg-primary text-primary-content hover:bg-primary/90 disabled:bg-base-300 disabled:text-base-content/50 flex items-center gap-2 rounded-lg px-4 py-2"
                            [disabled]="!canConfigure()"
                            (click)="generateConfiguration()"
                        >
                            <icon>auto_awesome</icon>
                            <span>Generate Configuration</span>
                        </button>
                    </div>
                </div>
            } @else if (configuring()) {
                <!-- Configuring Progress -->
                <div class="flex flex-1 flex-col items-center justify-center">
                    <mat-spinner diameter="64"></mat-spinner>
                    <p class="mt-6 text-lg font-medium">{{ config_status() }}</p>
                    <p class="text-base-content/70 mt-2 text-sm">
                        Analyzing PlaceOS documentation and best practices...
                    </p>

                    @if (config_progress().length > 0) {
                        <div class="mt-8 w-full max-w-md">
                            @for (step of config_progress(); track $index) {
                                <div
                                    class="border-base-200 mb-2 flex items-start gap-3 border-l-2 py-2 pl-4"
                                >
                                    <icon
                                        class="text-success mt-0.5 text-xl"
                                        >check_circle</icon
                                    >
                                    <span class="text-sm">{{ step }}</span>
                                </div>
                            }
                        </div>
                    }
                </div>
            } @else if (configuration_plan()) {
                <!-- Configuration Plan Display -->
                <div class="flex flex-1 flex-col gap-4 overflow-auto">
                    <div class="bg-success/10 text-success rounded-lg border border-current p-4">
                        <div class="flex items-center gap-2">
                            <icon class="text-2xl">check_circle</icon>
                            <span class="font-medium"
                                >Configuration plan generated successfully!</span
                            >
                        </div>
                    </div>

                    <!-- Modules Section -->
                    <div class="border-base-200 rounded-lg border">
                        <div class="border-base-200 border-b bg-base-200/50 px-4 py-3">
                            <h3 class="flex items-center gap-2 font-semibold">
                                <icon>extension</icon>
                                <span>Recommended Modules ({{
                                    configuration_plan().modules.length
                                }})</span>
                            </h3>
                        </div>
                        <div class="divide-base-200 divide-y">
                            @for (
                                module of configuration_plan().modules;
                                track $index
                            ) {
                                <div class="p-4">
                                    <div class="mb-2 flex items-start justify-between">
                                        <div>
                                            <h4 class="font-medium">
                                                {{ module.driver_name }}
                                            </h4>
                                            <p class="text-base-content/70 text-sm">
                                                Role: {{ module.role }}
                                            </p>
                                        </div>
                                        <span
                                            class="bg-primary/10 text-primary rounded px-2 py-1 text-xs"
                                            >AI Recommended</span
                                        >
                                    </div>
                                    <p class="text-base-content/60 mb-2 text-sm italic">
                                        {{ module.reasoning }}
                                    </p>
                                    @if (module.settings && Object.keys(module.settings).length > 0) {
                                        <div class="bg-base-200/50 mt-2 rounded p-2">
                                            <p class="mb-1 text-xs font-medium">
                                                Suggested Settings:
                                            </p>
                                            <pre
                                                class="text-xs">{{ formatSettings(module.settings) }}</pre>
                                        </div>
                                    }
                                </div>
                            }
                        </div>
                    </div>

                    <!-- Zones Section -->
                    @if (configuration_plan().zones.length > 0) {
                        <div class="border-base-200 rounded-lg border">
                            <div class="border-base-200 border-b bg-base-200/50 px-4 py-3">
                                <h3 class="flex items-center gap-2 font-semibold">
                                    <icon>location_on</icon>
                                    <span>Recommended Zones</span>
                                </h3>
                            </div>
                            <div class="p-4">
                                <div class="flex flex-wrap gap-2">
                                    @for (
                                        zone of configuration_plan().zones;
                                        track zone
                                    ) {
                                        <span
                                            class="bg-base-200 rounded-full px-3 py-1 text-sm"
                                            >{{ zone }}</span
                                        >
                                    }
                                </div>
                            </div>
                        </div>
                    }

                    <!-- Metadata Section -->
                    @if (configuration_plan().metadata && Object.keys(configuration_plan().metadata).length > 0) {
                        <div class="border-base-200 rounded-lg border">
                            <div class="border-base-200 border-b bg-base-200/50 px-4 py-3">
                                <h3 class="flex items-center gap-2 font-semibold">
                                    <icon>info</icon>
                                    <span>System Metadata</span>
                                </h3>
                            </div>
                            <div class="p-4">
                                <pre
                                    class="text-sm">{{ formatSettings(configuration_plan().metadata) }}</pre>
                            </div>
                        </div>
                    }

                    <!-- Action Buttons -->
                    <div class="flex justify-end gap-3 pt-4">
                        <button
                            class="border-base-300 hover:bg-base-200 rounded-lg border px-4 py-2"
                            (click)="reset()"
                        >
                            Start Over
                        </button>
                        <button
                            class="border-primary text-primary hover:bg-primary/10 rounded-lg border px-4 py-2"
                            (click)="exportConfiguration()"
                        >
                            Export Configuration
                        </button>
                        <button
                            class="bg-primary text-primary-content hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2"
                            (click)="applyConfiguration()"
                        >
                            <icon>done</icon>
                            <span>Apply Configuration</span>
                        </button>
                    </div>
                </div>
            }
        </div>
    `,
    styles: [``],
    imports: [
        CommonModule,
        FormsModule,
        IconComponent,
        TranslatePipe,
        MatProgressSpinnerModule,
    ],
})
export class SystemAIConfigureComponent extends AsyncHandler {
    private _service = inject(ActiveItemService);

    public system_purpose = '';
    public available_devices = '';
    public location = '';
    public special_requirements = '';
    public readonly configuring = signal(false);
    public readonly config_status = signal('');
    public readonly config_progress = signal<string[]>([]);
    public readonly configuration_plan = signal<ConfigurationPlan | null>(null);

    public readonly Object = Object;

    public canConfigure(): boolean {
        return !!(this.system_purpose && this.available_devices);
    }

    public reset(): void {
        this.system_purpose = '';
        this.available_devices = '';
        this.location = '';
        this.special_requirements = '';
        this.configuration_plan.set(null);
        this.config_progress.set([]);
    }

    public async generateConfiguration(): Promise<void> {
        this.configuring.set(true);
        this.config_progress.set([]);

        const steps = [
            'Analyzing system requirements...',
            'Consulting PlaceOS documentation...',
            'Identifying compatible drivers...',
            'Planning module configuration...',
            'Determining optimal settings...',
            'Generating configuration plan...',
        ];

        for (let i = 0; i < steps.length; i++) {
            this.config_status.set(steps[i]);
            await this.delay(700);
            this.config_progress.update((p) => [...p, steps[i]]);
        }

        // Generate mock configuration
        const plan = this.generateMockConfiguration();
        this.configuration_plan.set(plan);
        this.configuring.set(false);
    }

    private generateMockConfiguration(): ConfigurationPlan {
        // Parse devices from input
        const devices = this.available_devices
            .toLowerCase()
            .split(/[,\n]/)
            .map((d) => d.trim());

        const modules: ModuleSuggestion[] = [];

        // Mock AI logic to suggest modules based on keywords
        if (devices.some((d) => d.includes('webex') || d.includes('cisco'))) {
            modules.push({
                driver_name: 'Cisco Webex',
                role: 'VideoConference',
                settings: {
                    ip_address: '192.168.1.100',
                    username: 'admin',
                    enable_auto_answer: true,
                },
                reasoning:
                    'Detected Cisco Webex device. This driver provides full control over video conferencing features including calls, camera control, and presentation sharing.',
            });
        }

        if (devices.some((d) => d.includes('lutron') || d.includes('light'))) {
            modules.push({
                driver_name: 'Lutron Processor',
                role: 'Lighting',
                settings: {
                    ip_address: '192.168.1.101',
                    port: 23,
                    integration_id: 1,
                },
                reasoning:
                    'Lutron lighting control detected. This driver enables scene control and dimming for optimal room lighting conditions.',
            });
        }

        if (devices.some((d) => d.includes('display') || d.includes('samsung'))) {
            modules.push({
                driver_name: 'Samsung Display',
                role: 'Display',
                settings: {
                    ip_address: '192.168.1.102',
                    model: 'QM55R',
                },
                reasoning:
                    'Samsung display identified. This driver provides power control, input switching, and display management.',
            });
        }

        // Always add a booking module for meeting rooms
        if (this.system_purpose.toLowerCase().includes('meeting')) {
            modules.push({
                driver_name: 'PlaceOS Bookings',
                role: 'Bookings',
                settings: {
                    calendar_service: 'office365',
                    auto_release_minutes: 15,
                },
                reasoning:
                    'Meeting room detected. The bookings module integrates with calendar systems for room scheduling and availability.',
            });
        }

        return {
            modules,
            zones: [
                'Level-3',
                'Building-A',
                this.location || 'Unknown-Location',
                'Meeting-Rooms',
            ],
            triggers: [],
            metadata: {
                purpose: this.system_purpose,
                location: this.location,
                capacity: 8,
                features: ['video_conference', 'wireless_presentation', 'lighting_control'],
                configured_by: 'Claude AI',
                configuration_date: new Date().toISOString(),
            },
        };
    }

    public formatSettings(settings: Record<string, any>): string {
        return JSON.stringify(settings, null, 2);
    }

    public exportConfiguration(): void {
        const config_json = JSON.stringify(this.configuration_plan(), null, 2);
        const blob = new Blob([config_json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'placeos-system-config.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    public applyConfiguration(): void {
        alert(
            'Configuration would be applied to the system! In a real implementation, this would:\n\n' +
                '1. Add the recommended modules\n' +
                '2. Configure settings for each module\n' +
                '3. Assign zones to the system\n' +
                '4. Set metadata\n\n' +
                'For now, this is a mockup.',
        );
        this.reset();
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
