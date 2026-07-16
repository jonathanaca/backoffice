import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaceSystem } from '@placeos/ts-client';
import { AsyncHandler } from '../common/async-handler.class';
import { ActiveItemService } from '../common/item.service';
import { IconComponent } from '../ui/icon.component';
import {
    REPORT_WIDGETS,
    ReportStatus,
} from '../reports/report-widgets.component';

interface ModuleReport {
    id: string;
    title: string;
    icon: string;
    driver: string;
    module_name: string;
    type: 'meeting' | 'occupancy' | 'environment' | 'energy';
}

interface SystemReportData {
    meeting_status: string;
    meeting_count: number;
    avg_duration: number;
    utilization: number;
    peak_hours: string;
    occupancy: number;
    capacity: number;
    peak_occupancy: number;
    peak_time: string;
    avg_occupancy: number;
    temperature: number;
    humidity: number;
    co2: number;
    power: number;
    energy_usage: number;
    lighting_active: number;
    hvac_mode: string;
}

@Component({
    selector: 'system-reports',
    template: `
        <div class="h-full w-full overflow-auto p-4">
            @if (!system()) {
                <div
                    class="text-base-content/60 flex items-center justify-center p-8"
                >
                    No system selected
                </div>
            } @else if (!reports().length) {
                <div
                    class="border-base-200 mx-auto flex max-w-md flex-col items-center rounded-lg border p-12 text-center"
                >
                    <div
                        class="bg-base-200 mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                    >
                        <icon class="text-base-content/40 text-4xl"
                            >monitoring</icon
                        >
                    </div>
                    <h3 class="text-base-content mb-2 text-lg font-medium">
                        No reporting modules
                    </h3>
                    <p class="text-base-content/60 text-sm">
                        This system doesn't have any modules that provide
                        reporting data.
                    </p>
                </div>
            } @else {
                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    @for (report of reports(); track report.id) {
                        <report-card
                            [icon]="report.icon"
                            [title]="report.title"
                        >
                            @switch (report.type) {
                                @case ('meeting') {
                                    <div class="space-y-3">
                                        <div
                                            class="flex items-center justify-between"
                                        >
                                            <report-stat
                                                label="Current status"
                                                [value]="data().meeting_status"
                                            ></report-stat>
                                            <report-chip
                                                [status]="meeting_status_kind()"
                                            >
                                                {{ data().meeting_status }}
                                            </report-chip>
                                        </div>
                                        <div
                                            class="text-base-content/60 grid grid-cols-2 gap-x-3 gap-y-2 text-sm"
                                        >
                                            <div>
                                                Meetings today
                                                <span
                                                    class="text-base-content ml-1 font-medium"
                                                    >{{
                                                        data().meeting_count
                                                    }}</span
                                                >
                                            </div>
                                            <div>
                                                Avg duration
                                                <span
                                                    class="text-base-content ml-1 font-medium"
                                                    >{{ data().avg_duration }}
                                                    min</span
                                                >
                                            </div>
                                            <div>
                                                Utilisation
                                                <span
                                                    class="text-base-content ml-1 font-medium"
                                                    >{{
                                                        data().utilization
                                                    }}%</span
                                                >
                                            </div>
                                            <div>
                                                Peak hours
                                                <span
                                                    class="text-base-content ml-1 font-medium"
                                                    >{{
                                                        data().peak_hours
                                                    }}</span
                                                >
                                            </div>
                                        </div>
                                    </div>
                                }
                                @case ('occupancy') {
                                    <div class="space-y-3">
                                        <report-stat
                                            label="Current occupancy"
                                            [value]="data().occupancy"
                                            [unit]="'/ ' + data().capacity"
                                        ></report-stat>
                                        <report-meter
                                            [value]="data().occupancy"
                                            [max]="data().capacity"
                                            [status]="occupancy_status()"
                                        ></report-meter>
                                        <div
                                            class="text-base-content/60 space-y-1.5 text-sm"
                                        >
                                            <div>
                                                Peak today
                                                <span
                                                    class="text-base-content ml-1 font-medium"
                                                    >{{
                                                        data().peak_occupancy
                                                    }}
                                                    at
                                                    {{
                                                        data().peak_time
                                                    }}</span
                                                >
                                            </div>
                                            <div>
                                                Average today
                                                <span
                                                    class="text-base-content ml-1 font-medium"
                                                    >{{
                                                        data().avg_occupancy
                                                    }}
                                                    people</span
                                                >
                                            </div>
                                        </div>
                                    </div>
                                }
                                @case ('environment') {
                                    <div class="space-y-2.5 text-sm">
                                        <div
                                            class="flex items-center justify-between"
                                        >
                                            <span class="text-base-content/60"
                                                >Temperature</span
                                            >
                                            <span
                                                class="text-base-content font-medium"
                                                >{{
                                                    data().temperature
                                                }}°C</span
                                            >
                                        </div>
                                        <div
                                            class="flex items-center justify-between"
                                        >
                                            <span class="text-base-content/60"
                                                >Humidity</span
                                            >
                                            <span
                                                class="text-base-content font-medium"
                                                >{{ data().humidity }}%</span
                                            >
                                        </div>
                                        <div
                                            class="flex items-center justify-between"
                                        >
                                            <span class="text-base-content/60"
                                                >CO₂ level</span
                                            >
                                            <span
                                                class="text-base-content font-medium"
                                                >{{ data().co2 }} ppm</span
                                            >
                                        </div>
                                        <div
                                            class="flex items-center justify-between"
                                        >
                                            <span class="text-base-content/60"
                                                >Air quality</span
                                            >
                                            <report-chip status="good"
                                                >Good</report-chip
                                            >
                                        </div>
                                    </div>
                                }
                                @case ('energy') {
                                    <div class="space-y-3">
                                        <report-stat
                                            label="Current power"
                                            [value]="data().power"
                                            unit="kW"
                                        ></report-stat>
                                        <div
                                            class="text-base-content/60 space-y-1.5 text-sm"
                                        >
                                            <div>
                                                Today's usage
                                                <span
                                                    class="text-base-content ml-1 font-medium"
                                                    >{{ data().energy_usage }}
                                                    kWh</span
                                                >
                                            </div>
                                            <div>
                                                Lighting
                                                <span
                                                    class="text-base-content ml-1 font-medium"
                                                    >{{
                                                        data().lighting_active
                                                    }}% active</span
                                                >
                                            </div>
                                            <div>
                                                HVAC mode
                                                <span
                                                    class="text-base-content ml-1 font-medium"
                                                    >{{
                                                        data().hvac_mode
                                                    }}</span
                                                >
                                            </div>
                                        </div>
                                    </div>
                                }
                            }
                            <div
                                class="border-base-200 text-base-content/50 mt-3 flex items-center gap-1 border-t pt-2 font-mono text-xs"
                                [title]="report.driver"
                            >
                                <icon class="!text-sm">cable</icon>
                                {{ report.module_name }}
                            </div>
                        </report-card>
                    }
                </div>
            }
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                height: 100%;
            }
        `,
    ],
    imports: [CommonModule, IconComponent, ...REPORT_WIDGETS],
})
export class SystemReportsComponent extends AsyncHandler implements OnInit {
    private _service = inject(ActiveItemService);

    public readonly system = signal<PlaceSystem | null>(null);
    public readonly data = signal<SystemReportData>(this._sampleData());

    public readonly occupancy_status = computed<ReportStatus>(() => {
        const d = this.data();
        const percent = d.capacity ? (d.occupancy / d.capacity) * 100 : 0;
        if (percent >= 90) return 'critical';
        if (percent >= 75) return 'warning';
        return 'good';
    });

    public readonly meeting_status_kind = computed<ReportStatus>(() => {
        switch (this.data().meeting_status) {
            case 'Available':
                return 'good';
            case 'In Meeting':
                return 'info';
            default:
                return 'warning';
        }
    });

    /** Reports offered, based on the modules present in the system */
    public readonly reports = computed<ModuleReport[]>(() => {
        const sys = this.system();
        if (!sys) return [];
        const module_count = sys.modules?.length || 0;
        const name = sys.name?.toLowerCase() || '';
        const reports: ModuleReport[] = [];

        if (
            name.includes('meeting') ||
            name.includes('room') ||
            name.includes('boardroom')
        ) {
            reports.push({
                id: 'meeting',
                title: 'Meeting room analytics',
                icon: 'event',
                driver: 'PlaceOS::Drivers::Meeting',
                module_name: 'Bookings_1',
                type: 'meeting',
            });
        }
        reports.push({
            id: 'occupancy',
            title: 'Occupancy tracking',
            icon: 'groups',
            driver: 'PlaceOS::Drivers::Sensors',
            module_name: 'Occupancy_1',
            type: 'occupancy',
        });
        if (module_count > 1) {
            reports.push({
                id: 'environment',
                title: 'Environmental sensors',
                icon: 'eco',
                driver: 'PlaceOS::Drivers::Environment',
                module_name: 'Environment_1',
                type: 'environment',
            });
        }
        if (module_count > 2) {
            reports.push({
                id: 'energy',
                title: 'Energy management',
                icon: 'bolt',
                driver: 'PlaceOS::Drivers::Power',
                module_name: 'Power_1',
                type: 'energy',
            });
        }
        return reports;
    });

    public ngOnInit(): void {
        this.subscription(
            'item',
            this._service.active_item$.subscribe((item) => {
                if (item && 'modules' in item) {
                    this.system.set(item as PlaceSystem);
                    // Fresh sample data per system, stable until it changes
                    this.data.set(this._sampleData());
                }
            }),
        );
    }

    /** Sample data — replaced by live module state in production */
    private _sampleData(): SystemReportData {
        const rand = (min: number, max: number) =>
            Math.floor(Math.random() * (max - min + 1)) + min;
        const statuses = ['Available', 'In Meeting', 'Reserved'];
        const capacity = 25;
        return {
            meeting_status: statuses[rand(0, statuses.length - 1)],
            meeting_count: rand(3, 10),
            avg_duration: rand(30, 60),
            utilization: rand(40, 80),
            peak_hours: '10–11am, 2–3pm',
            occupancy: rand(5, 20),
            capacity,
            peak_occupancy: rand(20, capacity),
            peak_time: '2:30 PM',
            avg_occupancy: rand(12, 17),
            temperature: rand(21, 24),
            humidity: rand(40, 60),
            co2: rand(400, 600),
            power: +(Math.random() * 3 + 2).toFixed(1),
            energy_usage: rand(30, 80),
            lighting_active: rand(40, 80),
            hvac_mode: 'Cooling · Eco',
        };
    }
}
