import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AsyncHandler } from '../common/async-handler.class';
import { IconComponent } from '../ui/icon.component';
import { ReportsStateService } from './reports-state.service';
import { REPORT_WIDGETS, ReportStatus } from './report-widgets.component';

interface OccupancyData {
    current: number;
    capacity: number;
    prediction: number;
    trend: 'up' | 'down' | 'flat';
}

interface EnergyAnomaly {
    equipment_id: string;
    equipment_name: string;
    severity: ReportStatus;
    message: string;
    potential_savings: number;
}

interface MeetingInsight {
    room_id: string;
    room_name: string;
    utilization_rate: number;
    ghost_meetings: number;
    avg_attendees: number;
    capacity: number;
    recommendation: string;
}

@Component({
    selector: 'app-reports-ai-analytics',
    template: `
        <div class="h-full overflow-auto p-6">
            <div class="mx-auto max-w-6xl space-y-4">
                <!-- Context Row -->
                <div class="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 class="text-base-content text-lg font-semibold">
                            {{ zone_name() }}
                        </h2>
                        <p class="text-base-content/60 text-sm">
                            AI-powered analytics for this zone
                        </p>
                    </div>
                    <p class="text-base-content/50 text-xs">
                        Updated {{ last_updated() | date: 'shortTime' }}
                    </p>
                </div>

                <div class="grid gap-4 lg:grid-cols-2">
                    <!-- Occupancy Intelligence -->
                    <report-card icon="groups" title="Occupancy intelligence">
                        <div class="space-y-4">
                            <div>
                                <report-stat
                                    label="Current occupancy"
                                    [value]="occupancy().current"
                                    [unit]="'/ ' + occupancy().capacity"
                                    [hint]="occupancy_percent() + '% of capacity'"
                                ></report-stat>
                                <div class="mt-2">
                                    <report-meter
                                        [value]="occupancy().current"
                                        [max]="occupancy().capacity"
                                        [status]="occupancy_status()"
                                    ></report-meter>
                                </div>
                            </div>
                            <report-stat
                                label="Next hour prediction"
                                [value]="occupancy().prediction"
                                unit="people"
                                [delta]="prediction_delta()"
                                [direction]="occupancy().trend"
                                [up_is_good]="true"
                            ></report-stat>
                            <div
                                class="flex items-start gap-2 rounded-lg bg-blue-500/10 px-3 py-2.5"
                            >
                                <icon class="mt-0.5 text-lg text-blue-700"
                                    >lightbulb</icon
                                >
                                <div class="min-w-0 text-sm">
                                    <p class="font-medium text-blue-900">
                                        Space optimisation
                                    </p>
                                    <p class="text-blue-900/70">
                                        Zone B is consistently underutilised
                                        (avg 23%). Consider consolidation.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </report-card>

                    <!-- Energy & Equipment -->
                    <report-card icon="bolt" title="Energy &amp; equipment">
                        <div class="space-y-3">
                            @for (
                                anomaly of energy_anomalies();
                                track anomaly.equipment_id
                            ) {
                                <div
                                    class="flex items-start justify-between gap-3"
                                >
                                    <div class="min-w-0">
                                        <div
                                            class="flex flex-wrap items-center gap-2"
                                        >
                                            <p
                                                class="text-base-content text-sm font-medium"
                                            >
                                                {{ anomaly.equipment_name }}
                                            </p>
                                            <report-chip
                                                [status]="anomaly.severity"
                                            >
                                                {{
                                                    severityLabel(
                                                        anomaly.severity
                                                    )
                                                }}
                                            </report-chip>
                                        </div>
                                        <p
                                            class="text-base-content/60 mt-0.5 text-sm"
                                        >
                                            {{ anomaly.message }}
                                        </p>
                                    </div>
                                    @if (anomaly.potential_savings > 0) {
                                        <div
                                            class="flex-none text-right"
                                        >
                                            <p
                                                class="text-base-content text-sm font-semibold"
                                            >
                                                \${{
                                                    anomaly.potential_savings
                                                }}/mo
                                            </p>
                                            <p
                                                class="text-base-content/50 text-xs"
                                            >
                                                potential saving
                                            </p>
                                        </div>
                                    }
                                </div>
                            }
                            <div
                                class="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5"
                            >
                                <icon class="mt-0.5 text-lg text-amber-700"
                                    >energy_savings_leaf</icon
                                >
                                <div class="min-w-0 text-sm">
                                    <p class="font-medium text-amber-900">
                                        Optimisation opportunity
                                    </p>
                                    <p class="text-amber-900/70">
                                        After-hours HVAC usage detected.
                                        Potential savings: $2,450/month.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </report-card>
                </div>

                <!-- Meeting Intelligence -->
                <report-card icon="meeting_room" title="Meeting intelligence">
                    <div class="grid gap-3 md:grid-cols-3">
                        @for (
                            insight of meeting_insights();
                            track insight.room_id
                        ) {
                            <div
                                class="border-base-200 rounded-lg border p-3"
                            >
                                <div
                                    class="mb-2 flex items-start justify-between gap-2"
                                >
                                    <h4
                                        class="text-base-content min-w-0 truncate text-sm font-medium"
                                    >
                                        {{ insight.room_name }}
                                    </h4>
                                    <report-chip
                                        [status]="
                                            utilizationStatus(
                                                insight.utilization_rate
                                            )
                                        "
                                        icon="donut_small"
                                    >
                                        {{ insight.utilization_rate }}%
                                    </report-chip>
                                </div>
                                <report-meter
                                    [value]="insight.utilization_rate"
                                    [status]="
                                        utilizationStatus(
                                            insight.utilization_rate
                                        )
                                    "
                                ></report-meter>
                                <div
                                    class="text-base-content/60 mt-3 grid grid-cols-2 gap-2 text-xs"
                                >
                                    <div>
                                        Avg attendees
                                        <span
                                            class="text-base-content ml-1 font-medium"
                                            >{{ insight.avg_attendees }}/{{
                                                insight.capacity
                                            }}</span
                                        >
                                    </div>
                                    <div>
                                        Ghost meetings
                                        <span
                                            class="text-base-content ml-1 font-medium"
                                            >{{ insight.ghost_meetings }}</span
                                        >
                                    </div>
                                </div>
                                @if (insight.recommendation) {
                                    <div
                                        class="bg-base-200 text-base-content/70 mt-3 flex items-start gap-1.5 rounded p-2 text-xs"
                                    >
                                        <icon
                                            class="text-base-content/50 !text-sm"
                                            >auto_awesome</icon
                                        >
                                        {{ insight.recommendation }}
                                    </div>
                                }
                            </div>
                        }
                    </div>
                </report-card>

            </div>
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
export class ReportsAiAnalyticsComponent
    extends AsyncHandler
    implements OnInit
{
    private _state = inject(ReportsStateService);

    public readonly last_updated = signal(new Date());

    public readonly zone_name = computed(() => {
        const zone = this._state.selected_zone();
        return zone ? this._state.zoneDisplayName(zone) : '';
    });

    // Sample data — replaced by PlaceOS analytics sources in production
    public readonly occupancy = signal<OccupancyData>({
        current: 234,
        capacity: 500,
        prediction: 285,
        trend: 'up',
    });

    public readonly occupancy_percent = computed(() => {
        const data = this.occupancy();
        return data.capacity
            ? Math.round((data.current / data.capacity) * 100)
            : 0;
    });

    public readonly occupancy_status = computed<ReportStatus>(() => {
        const percent = this.occupancy_percent();
        if (percent >= 90) return 'critical';
        if (percent >= 75) return 'warning';
        return 'good';
    });

    public readonly prediction_delta = computed(() => {
        const data = this.occupancy();
        const diff = data.prediction - data.current;
        return `${diff >= 0 ? '+' : ''}${diff} vs now`;
    });

    public readonly energy_anomalies = signal<EnergyAnomaly[]>([
        {
            equipment_id: 'hvac-3',
            equipment_name: 'HVAC Unit 3',
            severity: 'critical',
            message: 'Consuming 35% more energy than similar units',
            potential_savings: 850,
        },
        {
            equipment_id: 'lighting-zone-b',
            equipment_name: 'Lighting Zone B',
            severity: 'warning',
            message: 'Lights on for 3 hours with no occupancy',
            potential_savings: 120,
        },
        {
            equipment_id: 'chiller-1',
            equipment_name: 'Chiller 1',
            severity: 'good',
            message: 'Operating at 92% efficiency — within normal range',
            potential_savings: 0,
        },
    ]);

    public readonly meeting_insights = signal<MeetingInsight[]>([
        {
            room_id: 'conf-a',
            room_name: 'Conference Room A',
            utilization_rate: 35,
            ghost_meetings: 12,
            avg_attendees: 3,
            capacity: 12,
            recommendation:
                'Consider downsizing to a 6-person room based on usage patterns',
        },
        {
            room_id: 'conf-b',
            room_name: 'Conference Room B',
            utilization_rate: 78,
            ghost_meetings: 2,
            avg_attendees: 8,
            capacity: 10,
            recommendation: 'High utilisation — well matched to demand',
        },
        {
            room_id: 'board-room',
            room_name: 'Board Room',
            utilization_rate: 45,
            ghost_meetings: 5,
            avg_attendees: 6,
            capacity: 20,
            recommendation:
                'Large room underutilised — reserve for larger meetings',
        },
    ]);

    public ngOnInit(): void {
        this.interval(
            'update',
            () => {
                this.last_updated.set(new Date());
                this._updateSampleData();
            },
            30000,
        );
    }

    public severityLabel(severity: ReportStatus): string {
        switch (severity) {
            case 'critical':
                return 'Critical';
            case 'warning':
                return 'Warning';
            case 'good':
                return 'Healthy';
            default:
                return 'Info';
        }
    }

    public utilizationStatus(rate: number): ReportStatus {
        if (rate > 70) return 'good';
        if (rate >= 40) return 'warning';
        return 'critical';
    }

    private _updateSampleData(): void {
        const current = this.occupancy();
        const variation = Math.floor(Math.random() * 20) - 10;
        const next = Math.max(
            0,
            Math.min(current.capacity, current.current + variation),
        );
        this.occupancy.set({
            ...current,
            current: next,
            prediction: Math.max(
                0,
                Math.min(
                    current.capacity,
                    current.prediction + Math.floor(Math.random() * 30) - 15,
                ),
            ),
            trend: variation > 5 ? 'up' : variation < -5 ? 'down' : 'flat',
        });
    }
}
