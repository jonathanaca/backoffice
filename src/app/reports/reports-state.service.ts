import { computed, Injectable, signal } from '@angular/core';
import { PlaceZone, queryZones } from '@placeos/ts-client';
import { firstValueFrom } from 'rxjs';

export type ReportPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

/** Demo zones shown when the backend has none tagged for reporting */
const DEMO_ZONES: Partial<PlaceZone>[] = [
    { id: 'org-1', name: 'ACME Corporation', display_name: 'ACME Corporation', tags: ['org'] },
    { id: 'bld-1', name: 'Tower A', display_name: 'Tower A - Sydney', tags: ['building'], parent_id: 'org-1' },
    { id: 'bld-2', name: 'Tower B', display_name: 'Tower B - Melbourne', tags: ['building'], parent_id: 'org-1' },
    { id: 'lvl-1', name: 'Level 1', display_name: 'Ground Floor', tags: ['level'], parent_id: 'bld-1' },
    { id: 'lvl-2', name: 'Level 2', display_name: 'Level 2', tags: ['level'], parent_id: 'bld-1' },
];

@Injectable({ providedIn: 'root' })
export class ReportsStateService {
    public readonly loading = signal(false);
    public readonly zones = signal<PlaceZone[]>([]);
    /** Whether the zone list came from demo data rather than the backend */
    public readonly demo_data = signal(false);
    public readonly selected_zone_id = signal<string>('');
    public readonly period = signal<ReportPeriod>('month');

    public readonly selected_zone = computed(() => {
        const id = this.selected_zone_id();
        return this.zones().find((z) => z.id === id) || null;
    });

    public readonly organisations = computed(() =>
        this.zones().filter((z) => z.tags?.includes('org')),
    );
    public readonly buildings = computed(() =>
        this.zones().filter((z) => z.tags?.includes('building')),
    );
    public readonly levels = computed(() =>
        this.zones().filter((z) => z.tags?.includes('level')),
    );
    public readonly other_zones = computed(() =>
        this.zones().filter(
            (z) =>
                !z.tags?.includes('org') &&
                !z.tags?.includes('building') &&
                !z.tags?.includes('level'),
        ),
    );

    private _loaded = false;

    public async loadZones(): Promise<void> {
        if (this._loaded) return;
        this._loaded = true;
        this.loading.set(true);
        try {
            const resp = await firstValueFrom(queryZones({ limit: 500 }));
            if (resp.data?.length) {
                this.zones.set(resp.data);
                this.demo_data.set(false);
            } else {
                this.zones.set(DEMO_ZONES as PlaceZone[]);
                this.demo_data.set(true);
            }
        } catch {
            this.zones.set(DEMO_ZONES as PlaceZone[]);
            this.demo_data.set(true);
        } finally {
            this.loading.set(false);
        }
    }

    public selectZone(zone_id: string): void {
        this.selected_zone_id.set(zone_id);
    }

    public zoneDisplayName(zone: PlaceZone): string {
        if (zone.tags?.includes('level') && zone.parent_id) {
            const parent = this.zones().find((z) => z.id === zone.parent_id);
            if (parent) {
                return `${parent.display_name || parent.name} · ${zone.display_name || zone.name}`;
            }
        }
        return zone.display_name || zone.name;
    }

    public zoneTypeLabel(zone: PlaceZone): string {
        if (zone.tags?.includes('org')) return 'Organisation';
        if (zone.tags?.includes('building')) return 'Building';
        if (zone.tags?.includes('level')) return 'Level';
        return 'Zone';
    }
}
