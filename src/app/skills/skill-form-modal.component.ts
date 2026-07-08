import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { IconComponent } from '../ui/icon.component';
import { TranslatePipe } from '../ui/translate.pipe';

export interface SkillFormModalData {
    name: string;
    description: string;
}

@Component({
    selector: 'skill-form-modal',
    template: `
        <div class="w-[24rem] max-w-[95vw]">
            <header class="flex items-center justify-between p-4">
                <h2 class="text-lg font-medium">
                    {{ 'SKILLS.SAVE_WORKFLOW' | translate }}
                </h2>
                <button btn icon mat-dialog-close>
                    <icon>close</icon>
                </button>
            </header>
            <main class="flex flex-col space-y-4 px-4 pb-2">
                <div class="flex flex-col">
                    <label
                        for="skill-name"
                        class="text-base-content/60 mb-1 text-xs font-medium"
                    >
                        {{ 'SKILLS.NAME' | translate }}
                    </label>
                    <input
                        id="skill-name"
                        type="text"
                        [(ngModel)]="name"
                        class="bg-base-200 border-base-300 text-base-content w-full rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        [placeholder]="'SKILLS.NAME_PLACEHOLDER' | translate"
                    />
                </div>
                <div class="flex flex-col">
                    <label
                        for="skill-description"
                        class="text-base-content/60 mb-1 text-xs font-medium"
                    >
                        {{ 'SKILLS.DESCRIPTION' | translate }}
                    </label>
                    <textarea
                        id="skill-description"
                        rows="3"
                        [(ngModel)]="description"
                        class="bg-base-200 border-base-300 text-base-content w-full resize-none rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    ></textarea>
                </div>
            </main>
            <footer class="flex items-center justify-end space-x-2 p-4">
                <button
                    matRipple
                    mat-dialog-close
                    class="text-base-content/60 hover:text-base-content px-4 py-2 transition-colors"
                >
                    {{ 'COMMON.CANCEL' | translate }}
                </button>
                <button
                    matRipple
                    [disabled]="!name.trim()"
                    (click)="save()"
                    class="bg-secondary text-secondary-content rounded-lg px-4 py-2 font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {{ 'SKILLS.SAVE' | translate }}
                </button>
            </footer>
        </div>
    `,
    imports: [
        FormsModule,
        MatDialogModule,
        MatRippleModule,
        IconComponent,
        TranslatePipe,
    ],
})
export class SkillFormModalComponent {
    private _data = inject<SkillFormModalData>(MAT_DIALOG_DATA);
    private _dialog_ref = inject(MatDialogRef<SkillFormModalComponent>);

    public name = this._data?.name || '';
    public description = this._data?.description || '';

    public save(): void {
        if (!this.name.trim()) return;
        this._dialog_ref.close({
            name: this.name.trim(),
            description: this.description.trim(),
        });
    }
}
