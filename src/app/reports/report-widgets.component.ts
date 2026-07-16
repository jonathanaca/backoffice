import { Component, computed, input } from '@angular/core';
import { IconComponent } from '../ui/icon.component';

export type ReportStatus = 'good' | 'info' | 'warning' | 'critical' | 'neutral';

const STATUS_TEXT: Record<ReportStatus, string> = {
    good: 'text-green-700',
    info: 'text-blue-700',
    warning: 'text-amber-700',
    critical: 'text-red-700',
    neutral: 'text-base-content/70',
};

const STATUS_TINT: Record<ReportStatus, string> = {
    good: 'bg-green-500/15',
    info: 'bg-blue-500/15',
    warning: 'bg-amber-500/15',
    critical: 'bg-red-500/15',
    neutral: 'bg-base-200',
};

const STATUS_FILL: Record<ReportStatus, string> = {
    good: 'bg-green-500',
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    neutral: 'bg-base-content/30',
};

const STATUS_ICON: Record<ReportStatus, string> = {
    good: 'check_circle',
    info: 'info',
    warning: 'warning',
    critical: 'error',
    neutral: 'circle',
};

/** Standard bordered card with an icon + title header, matching app cards */
@Component({
    selector: 'report-card',
    template: `
        <div
            class="border-base-200 bg-base-100 flex h-full flex-col rounded-lg border"
        >
            <div
                class="border-base-200 flex items-center justify-between gap-2 border-b px-4 py-3"
            >
                <div class="flex min-w-0 items-center gap-2.5">
                    @if (icon()) {
                        <div
                            class="bg-base-200 text-base-content/70 flex h-7 w-7 flex-none items-center justify-center rounded-md"
                        >
                            <icon class="text-lg">{{ icon() }}</icon>
                        </div>
                    }
                    <h3 class="text-base-content truncate font-medium">
                        {{ title() }}
                    </h3>
                </div>
                <ng-content select="[actions]"></ng-content>
            </div>
            <div class="flex-1 p-4">
                <ng-content></ng-content>
            </div>
        </div>
    `,
    imports: [IconComponent],
})
export class ReportCardComponent {
    public readonly icon = input<string>('');
    public readonly title = input.required<string>();
}

/** Stat tile: quiet label, ink value, optional signed delta with direction */
@Component({
    selector: 'report-stat',
    template: `
        <div>
            <div class="text-base-content/60 text-xs font-medium">
                {{ label() }}
            </div>
            <div class="mt-0.5 flex items-baseline gap-1">
                <span class="text-base-content text-2xl font-semibold">{{
                    value()
                }}</span>
                @if (unit()) {
                    <span class="text-base-content/50 text-sm">{{
                        unit()
                    }}</span>
                }
                @if (delta()) {
                    <span
                        class="ml-1.5 flex items-center gap-0.5 text-xs font-medium"
                        [class]="delta_class()"
                    >
                        <icon class="!text-sm">{{ delta_icon() }}</icon>
                        {{ delta() }}
                    </span>
                }
            </div>
            @if (hint()) {
                <div class="text-base-content/50 mt-0.5 text-xs">
                    {{ hint() }}
                </div>
            }
        </div>
    `,
    imports: [IconComponent],
})
export class ReportStatComponent {
    public readonly label = input.required<string>();
    public readonly value = input.required<string | number>();
    public readonly unit = input<string>('');
    /** e.g. "+12% vs last month" */
    public readonly delta = input<string>('');
    public readonly direction = input<'up' | 'down' | 'flat'>('flat');
    /** Whether an upward move is good (colours the delta) */
    public readonly up_is_good = input<boolean>(true);
    public readonly hint = input<string>('');

    public readonly delta_icon = computed(() =>
        this.direction() === 'up'
            ? 'trending_up'
            : this.direction() === 'down'
              ? 'trending_down'
              : 'trending_flat',
    );

    public readonly delta_class = computed(() => {
        if (this.direction() === 'flat') return 'text-base-content/50';
        const good =
            (this.direction() === 'up') === this.up_is_good();
        return good ? 'text-green-700' : 'text-red-700';
    });
}

/** Thin severity meter: status-coloured fill on a quiet track */
@Component({
    selector: 'report-meter',
    template: `
        <div
            class="bg-base-200 h-1.5 w-full overflow-hidden rounded-full"
            role="progressbar"
            [attr.aria-valuenow]="value()"
            [attr.aria-valuemax]="max()"
        >
            <div
                class="h-full rounded-full transition-all"
                [class]="fill_class()"
                [style.width.%]="percent()"
            ></div>
        </div>
    `,
})
export class ReportMeterComponent {
    public readonly value = input.required<number>();
    public readonly max = input<number>(100);
    public readonly status = input<ReportStatus>('neutral');

    public readonly percent = computed(() =>
        Math.max(0, Math.min(100, (this.value() / (this.max() || 1)) * 100)),
    );
    public readonly fill_class = computed(() => STATUS_FILL[this.status()]);
}

/** Status pill: icon + label, never colour alone */
@Component({
    selector: 'report-chip',
    template: `
        <span
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
            [class]="chip_class()"
        >
            <icon class="!text-sm">{{ icon() || default_icon() }}</icon>
            <ng-content></ng-content>
        </span>
    `,
    imports: [IconComponent],
})
export class ReportChipComponent {
    public readonly status = input<ReportStatus>('neutral');
    public readonly icon = input<string>('');

    public readonly default_icon = computed(() => STATUS_ICON[this.status()]);
    public readonly chip_class = computed(
        () => `${STATUS_TINT[this.status()]} ${STATUS_TEXT[this.status()]}`,
    );
}

/** 2px sparkline in the de-emphasis ink with a status-coloured end dot */
@Component({
    selector: 'report-sparkline',
    template: `
        <svg
            [attr.viewBox]="'0 0 ' + WIDTH + ' ' + HEIGHT"
            class="block h-8 w-20"
            aria-hidden="true"
        >
            <polyline
                [attr.points]="points()"
                fill="none"
                class="stroke-current text-base-content/30"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            @if (end_point(); as end) {
                <circle
                    [attr.cx]="end.x"
                    [attr.cy]="end.y"
                    r="4"
                    [class]="'fill-current ' + dot_class()"
                    stroke="var(--base-100)"
                    stroke-width="2"
                />
            }
        </svg>
    `,
})
export class ReportSparklineComponent {
    public readonly WIDTH = 80;
    public readonly HEIGHT = 32;
    public readonly values = input.required<number[]>();
    public readonly status = input<ReportStatus>('neutral');

    private readonly PAD = 5;

    private readonly coords = computed(() => {
        const values = this.values();
        if (!values.length) return [];
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min || 1;
        const w = this.WIDTH - this.PAD * 2;
        const h = this.HEIGHT - this.PAD * 2;
        return values.map((value, index) => ({
            x: this.PAD + (index / (values.length - 1 || 1)) * w,
            y: this.PAD + (h - ((value - min) / range) * h),
        }));
    });

    public readonly points = computed(() =>
        this.coords()
            .map((p) => `${p.x},${p.y}`)
            .join(' '),
    );

    public readonly end_point = computed(
        () => this.coords()[this.coords().length - 1] || null,
    );

    public readonly dot_class = computed(() => STATUS_TEXT[this.status()]);
}

export const REPORT_WIDGETS = [
    ReportCardComponent,
    ReportStatComponent,
    ReportMeterComponent,
    ReportChipComponent,
    ReportSparklineComponent,
] as const;
