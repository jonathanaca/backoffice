import { Injectable } from '@angular/core';
import {
    PlaceZone,
    queryZones,
    showMetadata,
    updateMetadata,
} from '@placeos/ts-client';
import { firstValueFrom } from 'rxjs';
import { SkillData } from './skills.types';

const MIRROR_KEY = 'BACKOFFICE.SKILLS';
const METADATA_NAME = 'skills';
const INDEX_METADATA_NAME = 'skills-index';

/**
 * Persists skills to the PlaceOS backend as metadata:
 * - Each system holds its own skills in a `skills` metadata entry (canonical,
 *   so skills travel with the system and are shared across users).
 * - The org zone holds a denormalised `skills-index` used by the global
 *   skills list, so listing does not require a request per system.
 * - localStorage mirrors everything as a read cache and as the fallback
 *   store when the backend is unavailable (e.g. mock mode).
 */
@Injectable({ providedIn: 'root' })
export class SkillsPersistenceService {
    private _org_zone: PlaceZone | null | undefined;

    /** All skills, for the global list */
    public async loadAllSkills(): Promise<SkillData[]> {
        const zone = await this._orgZone();
        if (zone) {
            try {
                const metadata = await firstValueFrom(
                    showMetadata(zone.id, INDEX_METADATA_NAME),
                );
                const skills = this._asSkillList(metadata?.details);
                this._writeMirror(skills);
                return skills;
            } catch {
                /* fall through to the mirror */
            }
        }
        return this._readMirror();
    }

    /** Skills belonging to a single system (canonical source) */
    public async loadSystemSkills(system_id: string): Promise<SkillData[]> {
        try {
            const metadata = await firstValueFrom(
                showMetadata(system_id, METADATA_NAME),
            );
            const skills = this._asSkillList(metadata?.details);
            this._mergeIntoMirror(system_id, skills);
            return skills;
        } catch {
            return this._readMirror().filter(
                (s) => s.system_id === system_id,
            );
        }
    }

    /** Find a single skill by its id (createdAt) */
    public async loadSkill(
        created_at: string,
        system_id?: string,
    ): Promise<SkillData | null> {
        if (system_id) {
            const skills = await this.loadSystemSkills(system_id);
            const skill = skills.find((s) => s.createdAt === created_at);
            if (skill) return skill;
        }
        const all = await this.loadAllSkills();
        return all.find((s) => s.createdAt === created_at) || null;
    }

    /** Insert or update a skill */
    public async saveSkill(skill: SkillData): Promise<void> {
        const skills = await this.loadSystemSkills(skill.system_id);
        const index = skills.findIndex((s) => s.createdAt === skill.createdAt);
        if (index >= 0) skills[index] = skill;
        else skills.push(skill);
        await this._writeSystemSkills(skill.system_id, skills);
    }

    public async deleteSkill(skill: SkillData): Promise<void> {
        const skills = (await this.loadSystemSkills(skill.system_id)).filter(
            (s) => s.createdAt !== skill.createdAt,
        );
        await this._writeSystemSkills(skill.system_id, skills);
    }

    public async duplicateSkill(skill: SkillData): Promise<SkillData> {
        const copy: SkillData = {
            ...structuredClone(skill),
            name: `${skill.name} (copy)`,
            trigger_id: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await this.saveSkill(copy);
        return copy;
    }

    /** Write a system's skills to its metadata + the org index + the mirror */
    private async _writeSystemSkills(
        system_id: string,
        skills: SkillData[],
    ): Promise<void> {
        this._mergeIntoMirror(system_id, skills);
        let persisted = false;
        try {
            await firstValueFrom(
                updateMetadata(system_id, {
                    id: system_id,
                    name: METADATA_NAME,
                    description: 'Automation skills for this system',
                    details: skills,
                } as any),
            );
            persisted = true;
        } catch (e) {
            console.warn(
                'Failed to persist skills to system metadata, using local storage',
                e,
            );
        }
        await this._updateIndex(system_id, skills);
        if (!persisted) return;
    }

    /** Replace a system's entries in the org-zone skills index */
    private async _updateIndex(
        system_id: string,
        skills: SkillData[],
    ): Promise<void> {
        const zone = await this._orgZone();
        if (!zone) return;
        try {
            let existing: SkillData[] = [];
            try {
                const metadata = await firstValueFrom(
                    showMetadata(zone.id, INDEX_METADATA_NAME),
                );
                existing = this._asSkillList(metadata?.details);
            } catch {
                /* no index yet */
            }
            const updated = [
                ...existing.filter((s) => s.system_id !== system_id),
                ...skills,
            ];
            await firstValueFrom(
                updateMetadata(zone.id, {
                    id: zone.id,
                    name: INDEX_METADATA_NAME,
                    description: 'Index of automation skills across systems',
                    details: updated,
                } as any),
            );
        } catch (e) {
            console.warn('Failed to update the skills index', e);
        }
    }

    private async _orgZone(): Promise<PlaceZone | null> {
        if (this._org_zone !== undefined) return this._org_zone;
        try {
            const resp = await firstValueFrom(
                queryZones({ tags: 'org', limit: 1 }),
            );
            this._org_zone = resp.data[0] || null;
        } catch {
            this._org_zone = null;
        }
        return this._org_zone;
    }

    private _asSkillList(details: unknown): SkillData[] {
        return Array.isArray(details) ? (details as SkillData[]) : [];
    }

    private _readMirror(): SkillData[] {
        try {
            return JSON.parse(localStorage.getItem(MIRROR_KEY) || '[]');
        } catch {
            return [];
        }
    }

    private _writeMirror(skills: SkillData[]): void {
        localStorage.setItem(MIRROR_KEY, JSON.stringify(skills));
    }

    private _mergeIntoMirror(system_id: string, skills: SkillData[]): void {
        const others = this._readMirror().filter(
            (s) => s.system_id !== system_id,
        );
        this._writeMirror([...others, ...skills]);
    }
}
