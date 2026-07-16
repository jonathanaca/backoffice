import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaceZone } from '@placeos/ts-client';
import { AsyncHandler } from '../common/async-handler.class';
import { ActiveItemService } from '../common/item.service';
import { IconComponent } from '../ui/icon.component';
import {
    REPORT_WIDGETS,
    ReportStatus,
} from '../reports/report-widgets.component';

interface ZoneReportData {
    total_systems: number;
    meeting_rooms: number;
    occupancy_percent: number;
    occupancy_count: number;
    capacity: number;
    active_meetings: number;
    meeting_utilization: number;
    energy_today: number;
    peak_occupancy: number;
    weekly_average: number;
    busiest_day: string;
    trend_percent: number;
    trend_up: boolean;
    today_meetings: number;
    avg_duration: number;
    no_show_rate: number;
    popular_room: string;
    avg_temp: number;
    co2_level: number;
    comfort_score: number;
    current_load: number;
    energy_vs_target: number;
    efficiency_score: number;
    savings_opportunity: number;
    desk_usage: number;
    meeting_room_usage: number;
    common_area_usage: number;
}

@Component({
    selector: 'zone-reports',
    template: `
        <div class="h-full w-full overflow-auto p-4">
            @if (!zone()) {
                <div
                    class="text-base-content/60 flex items-center justify-center p-8"
                >
                    No zone selected
                </div>
            } @else {
                <div class="space-y-4">
                    <!-- KPI Row -->
                    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div
                            class="border-base-200 flex items-center gap-3 rounded-lg border p-4"
                        >
                            <div
                                class="bg-base-200 flex h-10 w-10 flex-none items-center justify-center rounded-lg"
                            >
                                <icon class="text-base-content/70 text-xl"
                                    >meeting_room</icon
                                >
                            </div>
                            <report-stat
                                label="Systems"
                                [value]="data().total_systems"
                                [hint]="
                                    data().meeting_rooms + ' meeting rooms'
                                "
                            ></report-stat>
                        </div>
                        <div
                            class="border-base-200 rounded-lg border p-4"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="bg-base-200 flex h-10 w-10 flex-none items-center justify-center rounded-lg"
                                >
                                    <icon class="text-base-content/70 text-xl"
                                        >groups</icon
                                    >
                                </div>
                                <report-stat
                                    label="Current occupancy"
                                    [value]="data().occupancy_percent + '%'"
                                    [hint]="
                                        data().occupancy_count +
                                        ' / ' +
                                        data().capacity +
                                        ' people'
                                    "
                                ></report-stat>
                            </div>
                            <div class="mt-2">
                                <report-meter
                                    [value]="data().occupancy_percent"
                                    [status]="occupancy_status()"
                                ></report-meter>
                            </div>
                        </div>
                        <div
                            class="border-base-200 flex items-center gap-3 rounded-lg border p-4"
                        >
                            <div
                                class="bg-base-200 flex h-10 w-10 flex-none items-center justify-center rounded-lg"
                            >
                                <icon class="text-base-content/70 text-xl"
                                    >event</icon
                                >
                            </div>
                            <report-stat
                                label="Active meetings"
                                [value]="data().active_meetings"
                                [hint]="
                                    data().meeting_utilization +
                                    '% utilisation'
                                "
                            ></report-stat>
                        </div>
                        <div
                            class="border-base-200 flex items-center gap-3 rounded-lg border p-4"
                        >
                            <div
                                class="bg-base-200 flex h-10 w-10 flex-none items-center justify-center rounded-lg"
                            >
                                <icon class="text-base-content/70 text-xl"
                                    >electric_bolt</icon
                                >
                            </div>
                            <report-stat
                                label="Energy today"
                                [value]="data().energy_today"
                                unit="kWh"
                            ></report-stat>
                        </div>
                    </div>

                    <!-- Detailed Cards -->
                    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <report-card icon="trending_up" title="Occupancy trends">
                            <div class="space-y-2.5 text-sm">
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Peak today</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >{{ data().peak_occupancy }}%</span
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Average this week</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >{{ data().weekly_average }}%</span
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Busiest day</span
                                    >
                                    <span class="text-base-content font-medium">{{
                                        data().busiest_day
                                    }}</span>
                                </div>
                                <div
                                    class="border-base-200 text-base-content/50 flex items-center gap-1 border-t pt-2 text-xs"
                                >
                                    <icon class="!text-sm">{{
                                        data().trend_up
                                            ? 'trending_up'
                                            : 'trending_down'
                                    }}</icon>
                                    {{ data().trend_up ? 'Up' : 'Down' }}
                                    {{ data().trend_percent }}% from last week
                                </div>
                            </div>
                        </report-card>

                        <report-card icon="videocam" title="Meeting analytics">
                            <div class="space-y-2.5 text-sm">
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Today's meetings</span
                                    >
                                    <span class="text-base-content font-medium">{{
                                        data().today_meetings
                                    }}</span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Average duration</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >{{ data().avg_duration }} min</span
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >No-shows</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >{{ data().no_show_rate }}%</span
                                    >
                                </div>
                                <div
                                    class="border-base-200 text-base-content/50 border-t pt-2 text-xs"
                                >
                                    Most popular: {{ data().popular_room }}
                                </div>
                            </div>
                        </report-card>

                        <report-card icon="eco" title="Environmental health">
                            <div class="space-y-2.5 text-sm">
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Average temperature</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >{{ data().avg_temp }}°C</span
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Air quality</span
                                    >
                                    <report-chip status="good"
                                        >Good</report-chip
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >CO₂ levels</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >{{ data().co2_level }} ppm</span
                                    >
                                </div>
                                <div
                                    class="border-base-200 text-base-content/50 border-t pt-2 text-xs"
                                >
                                    {{ data().comfort_score }}% comfort score
                                </div>
                            </div>
                        </report-card>

                        <report-card icon="bolt" title="Energy performance">
                            <div class="space-y-2.5 text-sm">
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Current load</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >{{ data().current_load }} kW</span
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Today vs target</span
                                    >
                                    <report-chip
                                        [status]="
                                            data().energy_vs_target <= 100
                                                ? 'good'
                                                : 'warning'
                                        "
                                        >{{ data().energy_vs_target }}%</report-chip
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Efficiency score</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >{{ data().efficiency_score }}/100</span
                                    >
                                </div>
                                <div
                                    class="border-base-200 text-base-content/50 border-t pt-2 text-xs"
                                >
                                    Savings opportunity:
                                    \${{ data().savings_opportunity }}/month
                                </div>
                            </div>
                        </report-card>

                        <report-card
                            icon="space_dashboard"
                            title="Space utilisation"
                        >
                            <div class="space-y-3 text-sm">
                                @for (
                                    row of utilization_rows();
                                    track row.label
                                ) {
                                    <div>
                                        <div
                                            class="mb-1 flex items-center justify-between"
                                        >
                                            <span class="text-base-content/60">{{
                                                row.label
                                            }}</span>
                                            <span
                                                class="text-base-content font-medium"
                                                >{{ row.value }}%</span
                                            >
                                        </div>
                                        <report-meter
                                            [value]="row.value"
                                            [status]="row.status"
                                        ></report-meter>
                                    </div>
                                }
                            </div>
                        </report-card>

                        <report-card icon="monitor_heart" title="System health">
                            <div class="space-y-2.5 text-sm">
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Systems online</span
                                    >
                                    <report-chip status="good"
                                        >{{ data().total_systems }} /
                                        {{ data().total_systems }}</report-chip
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Active alerts</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >0</span
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-base-content/60"
                                        >Last incident</span
                                    >
                                    <span class="text-base-content font-medium"
                                        >12 days ago</span
                                    >
                                </div>
                                <div
                                    class="border-base-200 text-base-content/50 border-t pt-2 text-xs"
                                >
                                    All modules responding normally
                                </div>
                            </div>
                        </report-card>
                    </div>
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
export class ZoneReportsComponent extends AsyncHandler implements OnInit {
    private _service = inject(ActiveItemService);

    public readonly zone = signal<PlaceZone | null>(null);
    public readonly data = signal<ZoneReportData>(this._sampleData());

    public readonly occupancy_status = computed<ReportStatus>(() => {
        const percent = this.data().occupancy_percent;
        if (percent >= 90) return 'critical';
        if (percent >= 75) return 'warning';
        return 'good';
    });

    public readonly utilization_rows = computed(() => {
        const data = this.data();
        const status = (value: number): ReportStatus =>
            value > 70 ? 'good' : value >= 40 ? 'warning' : 'critical';
        return [
            {
                label: 'Desks',
                value: data.desk_usage,
                status: status(data.desk_usage),
            },
            {
                label: 'Meeting rooms',
                value: data.meeting_room_usage,
                status: status(data.meeting_room_usage),
            },
            {
                label: 'Common areas',
                value: data.common_area_usage,
                status: status(data.common_area_usage),
            },
        ];
    });

    public ngOnInit(): void {
        this.subscription(
            'item',
            this._service.active_item$.subscribe((item) => {
                if (item?.id) {
                    this.zone.set(item as PlaceZone);
                    // Fresh sample data per zone, stable until the zone changes
                    this.data.set(this._sampleData());
                }
            }),
        );
    }

    /** Sample data — replaced by PlaceOS analytics sources in production */
    private _sampleData(): ZoneReportData {
        const rand = (min: number, max: number) =>
            Math.floor(Math.random() * (max - min + 1)) + min;
        const capacity = rand(180, 320);
        const occupancy_count = rand(40, capacity);
        return {
            total_systems: rand(8, 24),
            meeting_rooms: rand(3, 9),
            occupancy_percent: Math.round(
                (occupancy_count / capacity) * 100,
            ),
            occupancy_count,
            capacity,
            active_meetings: rand(1, 8),
            meeting_utilization: rand(40, 85),
            energy_today: rand(240, 520),
            peak_occupancy: rand(70, 95),
            weekly_average: rand(45, 70),
            busiest_day: 'Wednesday',
            trend_percent: rand(2, 12),
            trend_up: Math.random() > 0.4,
            today_meetings: rand(6, 18),
            avg_duration: rand(30, 55),
            no_show_rate: rand(5, 20),
            popular_room: 'Boardroom',
            avg_temp: rand(21, 24),
            co2_level: rand(420, 640),
            comfort_score: rand(78, 95),
            current_load: rand(3, 9),
            energy_vs_target: rand(85, 115),
            efficiency_score: rand(65, 92),
            savings_opportunity: rand(400, 2200),
            desk_usage: rand(35, 85),
            meeting_room_usage: rand(40, 80),
            common_area_usage: rand(25, 60),
        };
    }
}
