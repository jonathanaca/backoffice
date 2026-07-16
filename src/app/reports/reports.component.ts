import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    ActivatedRoute,
    NavigationEnd,
    Router,
    RouterModule,
} from '@angular/router';
import { AsyncHandler } from '../common/async-handler.class';
import { IconComponent } from '../ui/icon.component';
import { SidebarMenuComponent } from '../ui/sidebar-menu.component';
import { TranslatePipe } from '../ui/translate.pipe';
import { ReportsStateService } from './reports-state.service';

@Component({
    selector: 'app-reports',
    template: `
        <div class="bg-base-100 absolute inset-0 flex">
            <sidebar-menu [(open)]="open_menu" class="sm:h-full"></sidebar-menu>
            <div class="flex h-full w-px flex-1 flex-col overflow-hidden">
                <!-- Page Header -->
                <header
                    class="border-base-200 flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-6 py-4"
                >
                    <h1 class="text-2xl font-semibold">
                        {{ 'REPORTS.TITLE' | translate }}
                    </h1>

                    <!-- Zone Selector -->
                    <div class="flex items-center gap-2">
                        <label
                            for="report-zone"
                            class="text-base-content/60 text-sm"
                        >
                            {{ 'REPORTS.ZONE' | translate }}
                        </label>
                        <select
                            id="report-zone"
                            class="bg-base-200 border-base-300 text-base-content w-64 rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            [value]="selected_zone_id()"
                            (change)="selectZone($event)"
                        >
                            <option value="">
                                {{ 'REPORTS.SELECT_ZONE' | translate }}
                            </option>
                            @if (organisations().length) {
                                <optgroup
                                    [label]="
                                        'REPORTS.ORGANISATIONS' | translate
                                    "
                                >
                                    @for (
                                        zone of organisations();
                                        track zone.id
                                    ) {
                                        <option
                                            [value]="zone.id"
                                            [selected]="
                                                zone.id === selected_zone_id()
                                            "
                                        >
                                            {{ zoneName(zone) }}
                                        </option>
                                    }
                                </optgroup>
                            }
                            @if (buildings().length) {
                                <optgroup
                                    [label]="'REPORTS.BUILDINGS' | translate"
                                >
                                    @for (zone of buildings(); track zone.id) {
                                        <option
                                            [value]="zone.id"
                                            [selected]="
                                                zone.id === selected_zone_id()
                                            "
                                        >
                                            {{ zoneName(zone) }}
                                        </option>
                                    }
                                </optgroup>
                            }
                            @if (levels().length) {
                                <optgroup [label]="'REPORTS.LEVELS' | translate">
                                    @for (zone of levels(); track zone.id) {
                                        <option
                                            [value]="zone.id"
                                            [selected]="
                                                zone.id === selected_zone_id()
                                            "
                                        >
                                            {{ zoneName(zone) }}
                                        </option>
                                    }
                                </optgroup>
                            }
                            @if (other_zones().length) {
                                <optgroup [label]="'REPORTS.OTHER' | translate">
                                    @for (
                                        zone of other_zones();
                                        track zone.id
                                    ) {
                                        <option
                                            [value]="zone.id"
                                            [selected]="
                                                zone.id === selected_zone_id()
                                            "
                                        >
                                            {{ zoneName(zone) }}
                                        </option>
                                    }
                                </optgroup>
                            }
                        </select>
                        @if (selected_zone(); as zone) {
                            <span
                                class="bg-base-200 text-base-content/60 rounded-full px-2.5 py-0.5 text-xs font-medium"
                            >
                                {{ zoneType(zone) }}
                            </span>
                        }
                    </div>

                    <!-- Report content is generated sample data until wired
                         to real analytics sources -->
                    <span
                        class="flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-700"
                        [matTooltip]="'REPORTS.SAMPLE_DATA_HINT' | translate"
                    >
                        <icon class="!text-sm">science</icon>
                        {{ 'REPORTS.SAMPLE_DATA' | translate }}
                    </span>

                    <!-- Report Type Toggle -->
                    @if (selected_zone()) {
                        <div
                            class="bg-base-200 ml-auto flex items-center gap-1 rounded-lg p-1"
                        >
                            <button
                                [class]="tabClass('analytics')"
                                (click)="setReport('analytics')"
                            >
                                <icon class="text-lg">insights</icon>
                                {{ 'REPORTS.AI_ANALYTICS' | translate }}
                            </button>
                            <button
                                [class]="tabClass('benchmarking')"
                                (click)="setReport('benchmarking')"
                            >
                                <icon class="text-lg">leaderboard</icon>
                                {{ 'REPORTS.BENCHMARKING' | translate }}
                            </button>
                        </div>
                    }
                </header>

                <!-- Content -->
                <main class="bg-base-100 flex-1 overflow-hidden">
                    @if (!selected_zone()) {
                        <div class="flex h-full items-center justify-center">
                            <div class="max-w-md p-8 text-center">
                                <div
                                    class="bg-base-200 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                                >
                                    <icon class="text-base-content/40 text-4xl"
                                        >monitoring</icon
                                    >
                                </div>
                                <h2
                                    class="text-base-content mb-2 text-lg font-medium"
                                >
                                    {{ 'REPORTS.NO_ZONE_SELECTED' | translate }}
                                </h2>
                                <p class="text-base-content/60 text-sm">
                                    {{
                                        'REPORTS.SELECT_ZONE_PROMPT' | translate
                                    }}
                                </p>
                            </div>
                        </div>
                    } @else {
                        <router-outlet></router-outlet>
                    }
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
        RouterModule,
        MatTooltipModule,
        IconComponent,
        TranslatePipe,
        SidebarMenuComponent,
    ],
})
export class ReportsComponent extends AsyncHandler implements OnInit {
    private _state = inject(ReportsStateService);
    private _router = inject(Router);
    private _route = inject(ActivatedRoute);

    public open_menu = false;
    public readonly active_report = signal<'analytics' | 'benchmarking'>(
        'analytics',
    );

    public readonly selected_zone_id = this._state.selected_zone_id;
    public readonly selected_zone = this._state.selected_zone;
    public readonly demo_data = this._state.demo_data;
    public readonly organisations = this._state.organisations;
    public readonly buildings = this._state.buildings;
    public readonly levels = this._state.levels;
    public readonly other_zones = this._state.other_zones;

    public readonly zoneName = (zone: any) =>
        this._state.zoneDisplayName(zone);
    public readonly zoneType = (zone: any) => this._state.zoneTypeLabel(zone);

    public ngOnInit(): void {
        this._state.loadZones();
        // Restore selection from the URL (deep-links, refresh)
        const zone_id = this._route.snapshot.queryParams['zone_id'];
        if (zone_id) this._state.selectZone(zone_id);
        this._syncReportFromUrl(this._router.url);
        this.subscription(
            'route',
            this._router.events.subscribe((event) => {
                if (event instanceof NavigationEnd) {
                    this._syncReportFromUrl(event.urlAfterRedirects);
                }
            }),
        );
    }

    private _syncReportFromUrl(url: string): void {
        if (url.includes('/reports/benchmarking')) {
            this.active_report.set('benchmarking');
        } else if (url.includes('/reports/analytics')) {
            this.active_report.set('analytics');
        }
    }

    public selectZone(event: Event): void {
        const zone_id = (event.target as HTMLSelectElement).value;
        this._state.selectZone(zone_id);
        if (zone_id) {
            this._router.navigate(['/reports', this.active_report()], {
                queryParams: { zone_id },
            });
        } else {
            this._router.navigate(['/reports']);
        }
    }

    public setReport(report: 'analytics' | 'benchmarking'): void {
        this.active_report.set(report);
        this._router.navigate(['/reports', report], {
            queryParams: { zone_id: this.selected_zone_id() },
        });
    }

    public tabClass(report: 'analytics' | 'benchmarking'): string {
        const base =
            'flex items-center gap-1.5 rounded px-3 py-1 text-sm font-medium transition-colors';
        return this.active_report() === report
            ? `${base} bg-secondary text-secondary-content`
            : `${base} text-base-content/60 hover:text-base-content`;
    }
}
