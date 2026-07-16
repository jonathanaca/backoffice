import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AsyncHandler } from '../common/async-handler.class';
import { IconComponent } from '../ui/icon.component';
import { SidebarMenuComponent } from '../ui/sidebar-menu.component';
import { TranslatePipe } from '../ui/translate.pipe';
import {
    REPORT_WIDGETS,
    ReportStatus,
} from '../reports/report-widgets.component';

interface EquipmentRisk {
    id: string;
    equipment: string;
    system: string;
    issue: string;
    probability: number;
    timeframe: string;
    severity: ReportStatus;
    scheduled: boolean;
}

interface ScheduledService {
    id: string;
    equipment: string;
    task: string;
    due: string;
    status: 'booked' | 'due' | 'overdue';
}

@Component({
    selector: 'app-predictive-maintenance',
    template: `
        <div class="bg-base-100 absolute inset-0 flex">
            <sidebar-menu [(open)]="open_menu" class="sm:h-full"></sidebar-menu>
            <div class="flex h-full w-px flex-1 flex-col overflow-hidden">
                <!-- Page Header -->
                <header
                    class="border-base-200 flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-6 py-4"
                >
                    <h1 class="text-2xl font-semibold">
                        {{ 'MAINTENANCE.TITLE' | translate }}
                    </h1>
                    <span
                        class="flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-700"
                        [matTooltip]="'MAINTENANCE.SAMPLE_DATA_HINT' | translate"
                    >
                        <icon class="!text-sm">science</icon>
                        {{ 'MAINTENANCE.SAMPLE_DATA' | translate }}
                    </span>
                </header>

                <!-- Content -->
                <main class="flex-1 overflow-auto p-6">
                    <div class="mx-auto max-w-6xl space-y-4">
                        <!-- KPI Row -->
                        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <div
                                class="border-base-200 flex items-center gap-3 rounded-lg border p-4"
                            >
                                <div
                                    class="bg-base-200 flex h-10 w-10 flex-none items-center justify-center rounded-lg"
                                >
                                    <icon class="text-base-content/70 text-xl"
                                        >build_circle</icon
                                    >
                                </div>
                                <report-stat
                                    label="Open predictions"
                                    [value]="risks().length"
                                ></report-stat>
                            </div>
                            <div
                                class="border-base-200 flex items-center gap-3 rounded-lg border p-4"
                            >
                                <div
                                    class="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-red-500/15"
                                >
                                    <icon class="text-xl text-red-700"
                                        >error</icon
                                    >
                                </div>
                                <report-stat
                                    label="Critical"
                                    [value]="critical_count()"
                                    [hint]="
                                        critical_count()
                                            ? 'needs attention now'
                                            : 'all clear'
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
                                        >event_available</icon
                                    >
                                </div>
                                <report-stat
                                    label="Services scheduled"
                                    [value]="scheduled_count()"
                                    [hint]="'of ' + risks().length + ' predictions'"
                                ></report-stat>
                            </div>
                            <div
                                class="border-base-200 flex items-center gap-3 rounded-lg border p-4"
                            >
                                <div
                                    class="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-green-500/15"
                                >
                                    <icon class="text-xl text-green-700"
                                        >savings</icon
                                    >
                                </div>
                                <report-stat
                                    label="Avoided downtime cost"
                                    value="$18.4K"
                                    hint="last 90 days"
                                ></report-stat>
                            </div>
                        </div>

                        <!-- Equipment at Risk -->
                        <report-card
                            icon="engineering"
                            title="Equipment at risk"
                        >
                            <div class="space-y-4">
                                @for (risk of risks(); track risk.id) {
                                    <div
                                        class="flex flex-wrap items-center gap-x-4 gap-y-2"
                                    >
                                        <report-chip [status]="risk.severity">
                                            {{ severityLabel(risk.severity) }}
                                        </report-chip>
                                        <div class="min-w-0 flex-1">
                                            <p
                                                class="text-base-content text-sm font-medium"
                                            >
                                                {{ risk.equipment }} —
                                                {{ risk.issue }}
                                            </p>
                                            <p
                                                class="text-base-content/60 text-xs"
                                            >
                                                {{ risk.system }} ·
                                                {{ risk.timeframe }}
                                            </p>
                                        </div>
                                        <div class="w-40 flex-none">
                                            <div
                                                class="text-base-content/60 mb-1 flex justify-between text-xs"
                                            >
                                                <span>Failure probability</span>
                                                <span
                                                    class="text-base-content font-medium"
                                                    >{{ risk.probability }}%</span
                                                >
                                            </div>
                                            <report-meter
                                                [value]="risk.probability"
                                                [status]="risk.severity"
                                            ></report-meter>
                                        </div>
                                        @if (risk.scheduled) {
                                            <span
                                                class="text-base-content/50 flex w-36 flex-none items-center justify-end gap-1 text-xs"
                                            >
                                                <icon class="!text-sm"
                                                    >event_available</icon
                                                >
                                                Service booked
                                            </span>
                                        } @else {
                                            <button
                                                class="bg-secondary text-secondary-content w-36 flex-none rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
                                                (click)="schedule(risk)"
                                            >
                                                Schedule service
                                            </button>
                                        }
                                    </div>
                                    @if (!$last) {
                                        <div
                                            class="border-base-200 border-t"
                                        ></div>
                                    }
                                }
                            </div>
                        </report-card>

                        <!-- Upcoming Services -->
                        <report-card
                            icon="calendar_clock"
                            title="Upcoming services"
                        >
                            <div class="space-y-2.5">
                                @for (
                                    service of services();
                                    track service.id
                                ) {
                                    <div
                                        class="flex items-center justify-between gap-3 text-sm"
                                    >
                                        <div class="min-w-0">
                                            <span
                                                class="text-base-content font-medium"
                                                >{{ service.equipment }}</span
                                            >
                                            <span class="text-base-content/60">
                                                — {{ service.task }}</span
                                            >
                                        </div>
                                        <report-chip
                                            [status]="
                                                serviceStatusKind(
                                                    service.status
                                                )
                                            "
                                            icon="schedule"
                                        >
                                            {{ service.due }}
                                        </report-chip>
                                    </div>
                                }
                            </div>
                        </report-card>
                    </div>
                </main>
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
    imports: [
        CommonModule,
        MatTooltipModule,
        IconComponent,
        TranslatePipe,
        SidebarMenuComponent,
        ...REPORT_WIDGETS,
    ],
})
export class PredictiveMaintenanceComponent extends AsyncHandler {
    public open_menu = false;

    // Sample data — replaced by analytics/driver sources in production
    public readonly risks = signal<EquipmentRisk[]>([
        {
            id: 'elevator-2',
            equipment: 'Elevator 2',
            system: 'Vertical transport · Tower A',
            issue: 'motor wear detected',
            probability: 78,
            timeframe: 'likely failure within 2 weeks',
            severity: 'critical',
            scheduled: false,
        },
        {
            id: 'hvac-5',
            equipment: 'HVAC Unit 5',
            system: 'Climate · Level 12',
            issue: 'filter replacement due',
            probability: 45,
            timeframe: 'efficiency down 15%, service in 5 days',
            severity: 'warning',
            scheduled: false,
        },
        {
            id: 'chiller-1',
            equipment: 'Chiller 1',
            system: 'Climate · Plant room',
            issue: 'bearing vibration trending up',
            probability: 22,
            timeframe: 'monitor — service within 60 days',
            severity: 'info',
            scheduled: true,
        },
        {
            id: 'ahu-3',
            equipment: 'AHU 3',
            system: 'Climate · Level 8',
            issue: 'belt tension drifting',
            probability: 12,
            timeframe: 'routine check recommended',
            severity: 'good',
            scheduled: true,
        },
    ]);

    public readonly services = signal<ScheduledService[]>([
        {
            id: 'svc-1',
            equipment: 'Chiller 1',
            task: 'Bearing inspection and lubrication',
            due: 'Tomorrow, 7:00 AM',
            status: 'booked',
        },
        {
            id: 'svc-2',
            equipment: 'AHU 3',
            task: 'Belt tension adjustment',
            due: 'Fri, 9:30 AM',
            status: 'booked',
        },
        {
            id: 'svc-3',
            equipment: 'Cooling Tower',
            task: 'Quarterly water treatment',
            due: 'In 12 days',
            status: 'due',
        },
    ]);

    public readonly critical_count = computed(
        () => this.risks().filter((r) => r.severity === 'critical').length,
    );

    public readonly scheduled_count = computed(
        () => this.risks().filter((r) => r.scheduled).length,
    );

    public severityLabel(severity: ReportStatus): string {
        switch (severity) {
            case 'critical':
                return 'Critical';
            case 'warning':
                return 'Due soon';
            case 'info':
                return 'Monitor';
            default:
                return 'Routine';
        }
    }

    public serviceStatusKind(status: ScheduledService['status']): ReportStatus {
        return status === 'booked'
            ? 'good'
            : status === 'due'
              ? 'info'
              : 'critical';
    }

    public schedule(risk: EquipmentRisk): void {
        this.risks.update((list) =>
            list.map((r) =>
                r.id === risk.id ? { ...r, scheduled: true } : r,
            ),
        );
        this.services.update((list) => [
            ...list,
            {
                id: `svc-${risk.id}`,
                equipment: risk.equipment,
                task: risk.issue,
                due: 'Pending confirmation',
                status: 'due',
            },
        ]);
    }
}
