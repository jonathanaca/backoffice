import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsyncHandler } from '../common/async-handler.class';
import { IconComponent } from '../ui/icon.component';
import { ReportsStateService } from './reports-state.service';
import { REPORT_WIDGETS, ReportStatus } from './report-widgets.component';

interface BuildingScore {
    zone_id: string;
    zone_name: string;
    energy_score: number;
    occupancy_score: number;
    comfort_score: number;
    maintenance_score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    rank: number;
    trend: 'improving' | 'declining' | 'stable';
}

interface KPI {
    id: string;
    name: string;
    value: number;
    unit: string;
    target: number;
    status: ReportStatus;
    status_label: string;
    sparkline: number[];
}

interface Benchmark {
    metric: string;
    your_value: number;
    peer_average: number;
    best_in_class: number;
    percentile: number;
    unit: string;
}

const GRADE_CLASSES: Record<string, string> = {
    A: 'bg-green-500/15 text-green-700',
    B: 'bg-blue-500/15 text-blue-700',
    C: 'bg-amber-500/15 text-amber-700',
    D: 'bg-orange-500/15 text-orange-700',
    F: 'bg-red-500/15 text-red-700',
};

@Component({
    selector: 'app-reports-benchmarking',
    template: `
        <div class="h-full overflow-auto p-6">
            <div class="mx-auto max-w-6xl space-y-4">
                <!-- Context Row -->
                <div class="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 class="text-base-content text-lg font-semibold">
                            {{ zone_name() }}
                        </h2>
                        <p class="text-base-content/60 text-sm">
                            Performance against your portfolio and industry
                            peers
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <select
                            class="bg-base-200 border-base-300 text-base-content rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            [(ngModel)]="selected_period"
                        >
                            <option value="day">Last 24 hours</option>
                            <option value="week">Last 7 days</option>
                            <option value="month">Last 30 days</option>
                            <option value="quarter">Last quarter</option>
                            <option value="year">Last year</option>
                        </select>
                        <select
                            class="bg-base-200 border-base-300 text-base-content rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            [(ngModel)]="comparison_mode"
                        >
                            <option value="portfolio">Portfolio</option>
                            <option value="peer">Peer group</option>
                            <option value="industry">Industry</option>
                        </select>
                    </div>
                </div>

                <!-- Portfolio Comparison -->
                @if (comparison_mode === 'portfolio') {
                    <report-card
                        icon="apartment"
                        title="Portfolio comparison"
                    >
                        <div class="overflow-x-auto">
                            <table class="w-full min-w-[40rem] text-sm">
                                <thead>
                                    <tr
                                        class="text-base-content/50 border-base-200 border-b text-left text-xs font-semibold tracking-wider uppercase"
                                    >
                                        <th class="pb-2 pr-4 font-semibold">
                                            Building
                                        </th>
                                        <th
                                            class="px-3 pb-2 text-center font-semibold"
                                        >
                                            Grade
                                        </th>
                                        <th class="px-3 pb-2 font-semibold">
                                            Energy
                                        </th>
                                        <th class="px-3 pb-2 font-semibold">
                                            Occupancy
                                        </th>
                                        <th class="px-3 pb-2 font-semibold">
                                            Comfort
                                        </th>
                                        <th class="px-3 pb-2 font-semibold">
                                            Maintenance
                                        </th>
                                        <th class="px-3 pb-2 font-semibold">
                                            Trend
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (
                                        score of building_scores();
                                        track score.zone_id
                                    ) {
                                        <tr
                                            class="border-base-200 border-b last:border-0"
                                        >
                                            <td class="py-3 pr-4">
                                                <p
                                                    class="text-base-content font-medium"
                                                >
                                                    {{ score.zone_name }}
                                                </p>
                                                <p
                                                    class="text-base-content/50 text-xs"
                                                >
                                                    Rank #{{ score.rank }}
                                                </p>
                                            </td>
                                            <td class="px-3 py-3 text-center">
                                                <span
                                                    class="inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-bold"
                                                    [class]="
                                                        gradeClass(score.grade)
                                                    "
                                                >
                                                    {{ score.grade }}
                                                </span>
                                            </td>
                                            @for (
                                                cell of scoreCells(score);
                                                track cell.label
                                            ) {
                                                <td class="px-3 py-3">
                                                    <div
                                                        class="text-base-content mb-1 font-medium"
                                                    >
                                                        {{ cell.value }}
                                                    </div>
                                                    <report-meter
                                                        class="block w-16"
                                                        [value]="cell.value"
                                                        [status]="cell.status"
                                                    ></report-meter>
                                                </td>
                                            }
                                            <td class="px-3 py-3">
                                                <span
                                                    class="flex items-center gap-1 text-sm"
                                                    [class]="
                                                        trendClass(score.trend)
                                                    "
                                                >
                                                    <icon class="text-lg">{{
                                                        trendIcon(score.trend)
                                                    }}</icon>
                                                    {{
                                                        trendLabel(score.trend)
                                                    }}
                                                </span>
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        </div>
                    </report-card>
                }

                <div class="grid gap-4 lg:grid-cols-2">
                    <!-- KPIs -->
                    <report-card
                        icon="speed"
                        title="Key performance indicators"
                    >
                        <div class="space-y-4">
                            @for (kpi of kpis(); track kpi.id) {
                                <div
                                    class="flex items-center justify-between gap-3"
                                >
                                    <report-stat
                                        class="min-w-0 flex-1"
                                        [label]="kpi.name"
                                        [value]="kpi.value"
                                        [unit]="kpi.unit"
                                        [hint]="
                                            'Target ' + kpi.target + kpi.unit
                                        "
                                    ></report-stat>
                                    <report-sparkline
                                        [values]="kpi.sparkline"
                                        [status]="kpi.status"
                                    ></report-sparkline>
                                    <report-chip [status]="kpi.status">
                                        {{ kpi.status_label }}
                                    </report-chip>
                                </div>
                            }
                        </div>
                    </report-card>

                    <!-- Industry Benchmarks -->
                    <report-card
                        icon="social_leaderboard"
                        title="Industry benchmarks"
                    >
                        <div class="space-y-5">
                            @for (
                                benchmark of benchmarks();
                                track benchmark.metric
                            ) {
                                <div>
                                    <div
                                        class="mb-1.5 flex items-center justify-between gap-2"
                                    >
                                        <p
                                            class="text-base-content text-sm font-medium"
                                        >
                                            {{ benchmark.metric }}
                                        </p>
                                        <report-chip
                                            [status]="
                                                percentileStatus(
                                                    benchmark.percentile
                                                )
                                            "
                                            icon="percent"
                                        >
                                            {{ benchmark.percentile }}th
                                        </report-chip>
                                    </div>
                                    <!-- Bullet bar: you vs peers vs best -->
                                    <div class="relative h-4">
                                        <div
                                            class="bg-base-200 absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full"
                                        ></div>
                                        <div
                                            class="bg-base-content/40 absolute top-1/2 h-4 w-0.5 -translate-y-1/2"
                                            [style.left.%]="
                                                markerPosition(
                                                    benchmark.peer_average,
                                                    benchmark
                                                )
                                            "
                                        ></div>
                                        <div
                                            class="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-green-600"
                                            [style.left.%]="
                                                markerPosition(
                                                    benchmark.best_in_class,
                                                    benchmark
                                                )
                                            "
                                        ></div>
                                        <div
                                            class="bg-secondary border-base-100 absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                                            [style.left.%]="
                                                markerPosition(
                                                    benchmark.your_value,
                                                    benchmark
                                                )
                                            "
                                        ></div>
                                    </div>
                                    <div
                                        class="text-base-content/60 mt-1 flex justify-between text-xs"
                                    >
                                        <span
                                            >You:
                                            <b class="text-base-content">{{
                                                benchmark.your_value
                                            }}{{ benchmark.unit }}</b></span
                                        >
                                        <span
                                            >Peers: {{ benchmark.peer_average
                                            }}{{ benchmark.unit }}</span
                                        >
                                        <span
                                            >Best: {{ benchmark.best_in_class
                                            }}{{ benchmark.unit }}</span
                                        >
                                    </div>
                                </div>
                            }
                            <!-- Legend -->
                            <div
                                class="text-base-content/60 border-base-200 flex flex-wrap items-center gap-4 border-t pt-3 text-xs"
                            >
                                <span class="flex items-center gap-1.5">
                                    <span
                                        class="bg-secondary inline-block h-2.5 w-2.5 rounded-full"
                                    ></span>
                                    Your value
                                </span>
                                <span class="flex items-center gap-1.5">
                                    <span
                                        class="bg-base-content/40 inline-block h-3 w-0.5"
                                    ></span>
                                    Peer average
                                </span>
                                <span class="flex items-center gap-1.5">
                                    <span
                                        class="inline-block h-3 w-0.5 bg-green-600"
                                    ></span>
                                    Best in class
                                </span>
                            </div>
                        </div>
                    </report-card>
                </div>

                <!-- Executive Summary -->
                <report-card icon="summarize" title="Executive summary">
                    <button
                        actions
                        class="bg-secondary text-secondary-content flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
                    >
                        <icon class="text-lg">download</icon>
                        Export
                    </button>
                    <div class="grid gap-4 md:grid-cols-3">
                        <div class="flex items-center gap-3">
                            <div
                                class="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-green-500/15"
                            >
                                <icon class="text-xl text-green-700"
                                    >savings</icon
                                >
                            </div>
                            <report-stat
                                label="Monthly savings vs baseline"
                                value="$45,230"
                            ></report-stat>
                        </div>
                        <div class="flex items-center gap-3">
                            <div
                                class="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-green-500/15"
                            >
                                <icon class="text-xl text-green-700">eco</icon>
                            </div>
                            <report-stat
                                label="Carbon reduction YoY"
                                value="23%"
                                delta="on track"
                                direction="up"
                            ></report-stat>
                        </div>
                        <div class="flex items-center gap-3">
                            <div
                                class="bg-base-200 flex h-10 w-10 flex-none items-center justify-center rounded-lg"
                            >
                                <icon class="text-base-content/70 text-xl"
                                    >emoji_events</icon
                                >
                            </div>
                            <report-stat
                                label="Industry ranking"
                                value="Top 25%"
                            ></report-stat>
                        </div>
                    </div>

                    <div class="bg-base-200 mt-4 rounded-lg p-4">
                        <h4 class="text-base-content mb-1 text-sm font-semibold">
                            Improvement roadmap
                        </h4>
                        <p class="text-base-content/60 mb-3 text-sm">
                            To reach the top 10% performance tier, focus on:
                        </p>
                        <ol class="space-y-2.5">
                            @for (
                                item of roadmap();
                                track item.title;
                                let i = $index
                            ) {
                                <li class="flex items-start gap-2.5">
                                    <span
                                        class="bg-base-100 text-base-content/70 mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-semibold"
                                    >
                                        {{ i + 1 }}
                                    </span>
                                    <div>
                                        <p
                                            class="text-base-content text-sm font-medium"
                                        >
                                            {{ item.title }}
                                        </p>
                                        <p
                                            class="text-base-content/60 text-xs"
                                        >
                                            {{ item.detail }}
                                        </p>
                                    </div>
                                </li>
                            }
                        </ol>
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
    imports: [CommonModule, FormsModule, IconComponent, ...REPORT_WIDGETS],
})
export class ReportsBenchmarkingComponent extends AsyncHandler {
    private _state = inject(ReportsStateService);

    public selected_period = 'month';
    public comparison_mode = 'portfolio';

    public readonly zone_name = computed(() => {
        const zone = this._state.selected_zone();
        return zone ? this._state.zoneDisplayName(zone) : '';
    });

    // Sample data — replaced by PlaceOS analytics sources in production
    public readonly building_scores = signal<BuildingScore[]>([
        {
            zone_id: 'zone-1',
            zone_name: 'Tower A',
            energy_score: 85,
            occupancy_score: 72,
            comfort_score: 88,
            maintenance_score: 91,
            grade: 'A',
            rank: 1,
            trend: 'improving',
        },
        {
            zone_id: 'zone-2',
            zone_name: 'Tower B',
            energy_score: 78,
            occupancy_score: 65,
            comfort_score: 82,
            maintenance_score: 75,
            grade: 'B',
            rank: 2,
            trend: 'stable',
        },
        {
            zone_id: 'zone-3',
            zone_name: 'Tower C',
            energy_score: 62,
            occupancy_score: 58,
            comfort_score: 71,
            maintenance_score: 68,
            grade: 'C',
            rank: 3,
            trend: 'declining',
        },
    ]);

    public readonly kpis = signal<KPI[]>([
        {
            id: 'energy-intensity',
            name: 'Energy intensity',
            value: 45.2,
            unit: 'kWh/m²',
            target: 40,
            status: 'warning',
            status_label: 'Off target',
            sparkline: [45, 47, 46, 48, 45, 44, 45, 43],
        },
        {
            id: 'occupancy-rate',
            name: 'Average occupancy',
            value: 68,
            unit: '%',
            target: 75,
            status: 'info',
            status_label: 'On track',
            sparkline: [65, 66, 67, 68, 69, 68, 67, 68],
        },
        {
            id: 'maintenance-response',
            name: 'Maintenance response time',
            value: 2.5,
            unit: 'hrs',
            target: 3,
            status: 'good',
            status_label: 'Ahead',
            sparkline: [3, 2.8, 2.6, 2.5, 2.4, 2.5, 2.6, 2.5],
        },
        {
            id: 'tenant-satisfaction',
            name: 'Tenant satisfaction',
            value: 4.2,
            unit: '/5',
            target: 4.5,
            status: 'info',
            status_label: 'On track',
            sparkline: [4.0, 4.1, 4.1, 4.2, 4.2, 4.3, 4.2, 4.2],
        },
    ]);

    public readonly benchmarks = signal<Benchmark[]>([
        {
            metric: 'Energy use intensity',
            your_value: 45.2,
            peer_average: 52.8,
            best_in_class: 35.0,
            percentile: 68,
            unit: 'kWh/m²',
        },
        {
            metric: 'Water consumption',
            your_value: 0.85,
            peer_average: 1.2,
            best_in_class: 0.6,
            percentile: 72,
            unit: 'kL/m²',
        },
        {
            metric: 'Waste diversion rate',
            your_value: 65,
            peer_average: 55,
            best_in_class: 85,
            percentile: 58,
            unit: '%',
        },
        {
            metric: 'Indoor air quality',
            your_value: 820,
            peer_average: 950,
            best_in_class: 600,
            percentile: 71,
            unit: 'ppm',
        },
    ]);

    public readonly roadmap = signal([
        {
            title: 'Lighting system upgrade',
            detail: 'Estimated savings $8,500/month · ROI 18 months',
        },
        {
            title: 'BMS optimisation',
            detail: 'Estimated savings $5,200/month · ROI 6 months',
        },
        {
            title: 'Occupancy-based HVAC control',
            detail: 'Estimated savings $3,800/month · ROI 12 months',
        },
    ]);

    public gradeClass(grade: string): string {
        return GRADE_CLASSES[grade] || GRADE_CLASSES['C'];
    }

    public scoreCells(score: BuildingScore) {
        const status = (value: number): ReportStatus =>
            value >= 80 ? 'good' : value >= 60 ? 'warning' : 'critical';
        return [
            { label: 'Energy', value: score.energy_score, status: status(score.energy_score) },
            { label: 'Occupancy', value: score.occupancy_score, status: status(score.occupancy_score) },
            { label: 'Comfort', value: score.comfort_score, status: status(score.comfort_score) },
            { label: 'Maintenance', value: score.maintenance_score, status: status(score.maintenance_score) },
        ];
    }

    public trendIcon(trend: string): string {
        return trend === 'improving'
            ? 'trending_up'
            : trend === 'declining'
              ? 'trending_down'
              : 'trending_flat';
    }

    public trendLabel(trend: string): string {
        return trend === 'improving'
            ? 'Improving'
            : trend === 'declining'
              ? 'Declining'
              : 'Stable';
    }

    public trendClass(trend: string): string {
        return trend === 'improving'
            ? 'text-green-700'
            : trend === 'declining'
              ? 'text-red-700'
              : 'text-base-content/50';
    }

    public percentileStatus(percentile: number): ReportStatus {
        if (percentile >= 75) return 'good';
        if (percentile >= 50) return 'info';
        if (percentile >= 25) return 'warning';
        return 'critical';
    }

    /** Position on the bullet bar, padded so markers stay inside the track */
    public markerPosition(value: number, benchmark: Benchmark): number {
        const max = Math.max(
            benchmark.best_in_class,
            benchmark.peer_average,
            benchmark.your_value,
        );
        return Math.max(2, Math.min(98, (value / (max || 1)) * 100));
    }
}
