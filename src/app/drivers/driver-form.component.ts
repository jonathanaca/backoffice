import { CommonModule, DatePipe } from '@angular/common';
import {
    Component,
    EventEmitter,
    OnInit,
    Output,
    computed,
    inject,
    signal,
} from '@angular/core';
import {
    FormsModule,
    ReactiveFormsModule,
    UntypedFormGroup,
} from '@angular/forms';
import {
    EncryptionLevel,
    GitCommitDetails,
    PlaceDriver,
    PlaceDriverDetails,
    PlaceDriverRole,
    PlaceRepositoryType,
    PlaceSettings,
    addDriver,
    addSettings,
    cleanObject,
    listRepositoryCommits,
    listRepositoryDriverDetails,
    listRepositoryDrivers,
    queryRepositories,
    showRepository,
    updateDriver,
} from '@placeos/ts-client';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { format, isAfter, subMinutes } from 'date-fns';
import { BehaviorSubject, combineLatest, lastValueFrom, of } from 'rxjs';
import {
    catchError,
    distinctUntilChanged,
    distinctUntilKeyChanged,
    filter,
    map,
    shareReplay,
    switchMap,
    tap,
} from 'rxjs/operators';
import { AsyncHandler } from '../common/async-handler.class';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import * as yaml from 'js-yaml';
import { getInvalidFields, nextValueFrom } from '../common/general';
import { HotkeysService } from '../common/hotkeys.service';
import { i18n } from '../common/locale.service';
import { notifyError, notifySuccess } from '../common/notifications';
import { DialogEvent, Identity } from '../common/types';

import { ItemSearchFieldComponent } from '../ui/custom-fields/item-search-field.component';
import { FullscreenModalShellComponent } from '../ui/fullscreen-modal-shell.component';
import { SettingsToggleComponent } from '../ui/settings-toggle.component';
import { TranslatePipe } from '../ui/translate.pipe';
import { generateDriverFormFields } from './drivers.utilities';

@Component({
    selector: 'driver-form',
    template: `
        <fullscreen-modal-shell
            [heading]="heading"
            [loading]="saving"
            (save)="submit()"
        >
            @if (!is_editing()) {
                <label for="repos">{{ 'REPOS.SINGULAR' | translate }}</label>
                <item-search-field
                    [placeholder]="'REPOS.SEARCH' | translate"
                    [options]="repo_list | async"
                    [loading]="loading_type().includes('repository')"
                    [ngModel]="repo.getValue()"
                    (ngModelChange)="
                        repo.next($event); driver.next(null); commit.next(null)
                    "
                />
                @if (repo | async) {
                    <div class="mb-4">
                        <label class="mb-2 block font-medium">Driver Source</label>
                        <div class="flex gap-4">
                            <button
                                type="button"
                                class="flex-1 rounded-lg border-2 p-4 text-left transition-all"
                                [class.border-primary]="!use_ai_builder()"
                                [class.bg-primary/10]="!use_ai_builder()"
                                [class.border-base-300]="use_ai_builder()"
                                (click)="use_ai_builder.set(false); ai_driver_data.set(null)"
                            >
                                <div class="flex items-start gap-3">
                                    <div class="text-2xl">📦</div>
                                    <div>
                                        <div class="font-semibold">Select Base Driver</div>
                                        <div class="text-sm text-base-content/70">
                                            Choose an existing driver from the repository
                                        </div>
                                    </div>
                                </div>
                            </button>
                            <button
                                type="button"
                                class="flex-1 rounded-lg border-2 p-4 text-left transition-all"
                                [class.border-primary]="use_ai_builder()"
                                [class.bg-primary/10]="use_ai_builder()"
                                [class.border-base-300]="!use_ai_builder()"
                                (click)="use_ai_builder.set(true); driver.next(null); commit.next(null)"
                            >
                                <div class="flex items-start gap-3">
                                    <div class="text-2xl">✨</div>
                                    <div>
                                        <div class="font-semibold">Build with AI</div>
                                        <div class="text-sm text-base-content/70">
                                            Generate a new driver using Claude
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    @if (!use_ai_builder()) {
                        <label for="driver">{{ 'DRIVERS.BASE' | translate }}</label>
                        <item-search-field
                            [placeholder]="'DRIVERS.SEARCH' | translate"
                            [options]="driver_list | async"
                            [loading]="loading_type().includes('drivers')"
                            [ngModel]="driver.getValue()"
                            (ngModelChange)="driver.next($event); commit.next(null)"
                        />
                    }
                }
            }
            @if (driver | async) {
                <label for="commit" [class.error]="commit_error()">
                    {{ 'DRIVERS.COMMIT' | translate }}
                </label>
                <item-search-field
                    [placeholder]="'DRIVERS.COMMIT_SEARCH' | translate"
                    [options]="commit_list | async"
                    [loading]="loading_type().includes('commits')"
                    [ngModel]="commit.getValue()"
                    (ngModelChange)="
                        commit.next($event); applyDriverCommit($event)
                    "
                />
                @if (commit_error()) {
                    <div class="text-error text-xs">
                        {{ 'DRIVERS.DETAILS_ERROR_1' | translate }}
                        {{ 'DRIVERS.DETAILS_ERROR_2' | translate }}
                    </div>
                }
            }

            @if (use_ai_builder() && (repo | async)) {
                <div class="border-base-200 rounded-lg border bg-base-100 p-6">
                    <h3 class="mb-4 text-lg font-semibold">Build Driver with Claude</h3>

                    @if (!ai_building() && !ai_driver_data()) {
                        <!-- AI Builder Inputs -->
                        <div class="space-y-4">
                            <div>
                                <label class="mb-1 block text-sm font-medium">Driver Name</label>
                                <mat-form-field appearance="outline" class="w-full">
                                    <input
                                        matInput
                                        [(ngModel)]="ai_driver_name"
                                        placeholder="e.g., Cisco Webex Controller"
                                    />
                                </mat-form-field>
                            </div>

                            <div>
                                <label class="mb-1 block text-sm font-medium">Device/System Type</label>
                                <mat-form-field appearance="outline" class="w-full">
                                    <input
                                        matInput
                                        [(ngModel)]="ai_device_type"
                                        placeholder="e.g., Video Conferencing Codec, Lighting Processor"
                                    />
                                </mat-form-field>
                            </div>

                            <div>
                                <label class="mb-1 block text-sm font-medium">What should this driver control?</label>
                                <mat-form-field appearance="outline" class="w-full">
                                    <textarea
                                        matInput
                                        [(ngModel)]="ai_driver_requirements"
                                        placeholder="e.g., Control power, volume, input switching, camera presets. Receive call status updates."
                                        rows="3"
                                    ></textarea>
                                </mat-form-field>
                            </div>

                            <div>
                                <label class="mb-1 block text-sm font-medium">Communication Protocol</label>
                                <mat-form-field appearance="outline" class="w-full">
                                    <mat-select [(ngModel)]="ai_protocol">
                                        <mat-option value="http">HTTP/REST API</mat-option>
                                        <mat-option value="websocket">WebSocket</mat-option>
                                        <mat-option value="tcp">TCP Socket</mat-option>
                                        <mat-option value="ssh">SSH</mat-option>
                                        <mat-option value="telnet">Telnet</mat-option>
                                        <mat-option value="mqtt">MQTT</mat-option>
                                        <mat-option value="other">Other</mat-option>
                                    </mat-select>
                                </mat-form-field>
                            </div>

                            <div>
                                <label class="mb-1 block text-sm font-medium">Upload API Documentation (Optional)</label>
                                <div
                                    class="border-base-300 hover:bg-base-200/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors"
                                    (click)="ai_file_input.click()"
                                >
                                    <div class="text-base-content/40 mb-2 text-3xl">📄</div>
                                    <p class="text-base-content/70 text-sm">
                                        Click to upload API docs, PDFs, or manuals
                                    </p>
                                    @if (ai_uploaded_files().length > 0) {
                                        <div class="mt-3 flex flex-wrap gap-2">
                                            @for (file of ai_uploaded_files(); track file.name) {
                                                <div class="bg-primary/10 text-primary flex items-center gap-2 rounded px-3 py-1 text-sm">
                                                    <span>{{ file.name }}</span>
                                                    <button
                                                        type="button"
                                                        (click)="removeAiFile(file); $event.stopPropagation()"
                                                        class="hover:text-error"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            }
                                        </div>
                                    }
                                </div>
                                <input
                                    #ai_file_input
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx,.txt,.md,.json,.yaml,.yml"
                                    class="hidden"
                                    (change)="onAiFileSelected($event)"
                                />
                            </div>

                            <div>
                                <label class="mb-1 block text-sm font-medium">Additional Context (Optional)</label>
                                <mat-form-field appearance="outline" class="w-full">
                                    <textarea
                                        matInput
                                        [(ngModel)]="ai_additional_context"
                                        placeholder="API endpoints, authentication methods, example commands, etc."
                                        rows="4"
                                    ></textarea>
                                </mat-form-field>
                            </div>

                            <div class="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    class="bg-primary text-primary-content hover:bg-primary/90 disabled:bg-base-300 disabled:text-base-content/50 flex items-center gap-2 rounded-lg px-4 py-2"
                                    [disabled]="!canBuildAiDriver()"
                                    (click)="buildAiDriver()"
                                >
                                    <span class="text-xl">✨</span>
                                    <span>Generate Driver</span>
                                </button>
                            </div>
                        </div>
                    }

                    @if (ai_building()) {
                        <!-- Building Progress -->
                        <div class="flex flex-col items-center justify-center py-8">
                            <mat-spinner [diameter]="64"></mat-spinner>
                            <p class="mt-6 text-lg font-medium">{{ ai_build_status() }}</p>
                            <p class="text-base-content/70 mt-2 text-sm">
                                Claude is generating your driver...
                            </p>

                            @if (ai_build_progress().length > 0) {
                                <div class="mt-8 w-full max-w-md">
                                    @for (step of ai_build_progress(); track $index) {
                                        <div class="border-base-200 mb-2 flex items-start gap-3 border-l-2 py-2 pl-4">
                                            <span class="text-success mt-0.5 text-xl">✓</span>
                                            <span class="text-sm">{{ step }}</span>
                                        </div>
                                    }
                                </div>
                            }
                        </div>
                    }

                    @if (ai_driver_data()) {
                        <!-- Generated Driver -->
                        <div class="space-y-4">
                            <div class="bg-success/10 text-success rounded-lg border border-current p-4">
                                <div class="flex items-center gap-2">
                                    <span class="text-2xl">✓</span>
                                    <span class="font-medium">Driver generated successfully!</span>
                                </div>
                            </div>

                            <!-- Driver Preview -->
                            <div class="border-base-200 rounded-lg border">
                                <div class="border-base-200 border-b bg-base-200/50 px-4 py-3">
                                    <h4 class="font-semibold">Generated Driver: {{ ai_driver_data().name }}</h4>
                                </div>
                                <div class="p-4">
                                    <pre class="bg-base-200 max-h-96 overflow-auto rounded p-4 text-xs">{{ ai_driver_data().code }}</pre>
                                </div>
                            </div>

                            <!-- Test Driver Section -->
                            <div class="border-base-200 rounded-lg border">
                                <div class="border-base-200 border-b bg-base-200/50 px-4 py-3">
                                    <h4 class="font-semibold">Test Driver</h4>
                                </div>
                                <div class="p-4 space-y-4">
                                    <div>
                                        <label class="mb-1 block text-sm font-medium">Device IP/Hostname</label>
                                        <mat-form-field appearance="outline" class="w-full">
                                            <input
                                                matInput
                                                [(ngModel)]="test_host"
                                                placeholder="e.g., 192.168.1.100"
                                            />
                                        </mat-form-field>
                                    </div>

                                    <div class="flex gap-3">
                                        <button
                                            type="button"
                                            class="border-primary text-primary hover:bg-primary/10 flex items-center gap-2 rounded-lg border px-4 py-2"
                                            [disabled]="!test_host || ai_testing()"
                                            (click)="testAiDriver()"
                                        >
                                            @if (ai_testing()) {
                                                <mat-spinner [diameter]="16"></mat-spinner>
                                            } @else {
                                                <span>🧪</span>
                                            }
                                            <span>Test Connection</span>
                                        </button>
                                    </div>

                                    @if (test_result()) {
                                        <div class="rounded-lg p-4" [class.bg-success/10]="test_result().success" [class.bg-error/10]="!test_result().success">
                                            <div class="flex items-start gap-2">
                                                <span class="text-xl">{{ test_result().success ? '✓' : '✗' }}</span>
                                                <div>
                                                    <p class="font-medium">{{ test_result().message }}</p>
                                                    @if (test_result().details) {
                                                        <pre class="bg-base-200 mt-2 rounded p-2 text-xs">{{ test_result().details }}</pre>
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    }
                                </div>
                            </div>

                            <div class="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    class="border-base-300 hover:bg-base-200 rounded-lg border px-4 py-2"
                                    (click)="resetAiBuilder()"
                                >
                                    Start Over
                                </button>
                                <button
                                    type="button"
                                    class="bg-primary text-primary-content hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2"
                                    (click)="useAiDriver()"
                                >
                                    <span>✓</span>
                                    <span>Use This Driver</span>
                                </button>
                            </div>
                        </div>
                    }
                </div>
            }

            @if ((commit | async) && !loading() && form.controls.id) {
                <div class="flex flex-col" [formGroup]="form">
                    <label
                        for="driver-name"
                        [class.error]="fieldInvalid('name')"
                    >
                        {{ 'COMMON.FIELD_NAME' | translate }}
                        <span required>*</span>
                    </label>
                    <mat-form-field appearance="outline">
                        <input
                            matInput
                            name="driver-name"
                            [placeholder]="'COMMON.FIELD_NAME' | translate"
                            formControlName="name"
                            required
                        />
                        <mat-error>
                            {{ 'DRIVERS.NAME_REQUIRED' | translate }}
                        </mat-error>
                    </mat-form-field>
                    <div class="flex space-x-4">
                        @if (!is_editing()) {
                            <div class="flex flex-1 flex-col">
                                <label for="role">
                                    {{ 'DRIVERS.ROLE' | translate }}
                                </label>
                                <mat-form-field appearance="outline">
                                    <mat-select
                                        name="role"
                                        formControlName="role"
                                    >
                                        @for (type of role_types; track type) {
                                            <mat-option [value]="type.id">
                                                {{ type.name | translate }}
                                            </mat-option>
                                        }
                                    </mat-select>
                                </mat-form-field>
                            </div>
                        }
                        <div class="flex flex-1 flex-col">
                            <label
                                for="module-name"
                                [class.error]="fieldInvalid('module_name')"
                            >
                                {{ 'DRIVERS.MODULE_NAME' | translate }}
                                <span required>*</span>
                            </label>
                            <mat-form-field appearance="outline">
                                <input
                                    matInput
                                    name="module-name"
                                    [placeholder]="
                                        'DRIVERS.MODULE_NAME' | translate
                                    "
                                    formControlName="module_name"
                                    required
                                />
                                <mat-error>
                                    {{
                                        'DRIVERS.MODULE_NAME_REQUIRED'
                                            | translate
                                    }}
                                </mat-error>
                            </mat-form-field>
                        </div>
                    </div>
                    <label for="description">
                        {{ 'COMMON.FIELD_DESCRIPTION' | translate }}
                    </label>
                    <mat-form-field appearance="outline">
                        <textarea
                            matInput
                            name="description"
                            [placeholder]="
                                'COMMON.FIELD_DESCRIPTION' | translate
                            "
                            formControlName="description"
                        ></textarea>
                    </mat-form-field>
                    <label for="default-uri">{{
                        'DRIVERS.DEFAULT_URI' | translate
                    }}</label>
                    <mat-form-field appearance="outline">
                        <input
                            matInput
                            name="default-uri"
                            [placeholder]="'DRIVERS.DEFAULT_URI' | translate"
                            formControlName="default_uri"
                        />
                    </mat-form-field>
                    <div class="flex items-center space-x-4">
                        <div class="flex flex-1 flex-col">
                            <label
                                for="default-port"
                                [class.error]="fieldInvalid('default_port')"
                            >
                                {{ 'DRIVERS.DEFAULT_PORT' | translate }}
                            </label>
                            <mat-form-field appearance="outline">
                                <input
                                    matInput
                                    name="default-port"
                                    type="number"
                                    [placeholder]="
                                        'DRIVERS.DEFAULT_PORT' | translate
                                    "
                                    formControlName="default_port"
                                />
                                <mat-error>
                                    {{ 'MODULES.PORT_REQUIRED' | translate }}
                                </mat-error>
                            </mat-form-field>
                        </div>
                        <div class="flex flex-1 flex-col">
                            <div class="h-1 w-full"></div>
                            <settings-toggle
                                class="w-full"
                                [name]="'MODULES.IGNORE_CONNECTED' | translate"
                                formControlName="ignore_connected"
                            ></settings-toggle>
                        </div>
                    </div>
                    <label for="alert-level">
                        {{ 'COMMON.ALERT_LEVEL' | translate }}
                    </label>
                    <mat-form-field appearance="outline">
                        <mat-select
                            name="alert-level"
                            formControlName="alert_level"
                        >
                            @for (level of alert_levels; track level.id) {
                                <mat-option [value]="level.id">
                                    {{ level.name | translate }}
                                </mat-option>
                            }
                        </mat-select>
                    </mat-form-field>
                </div>
            }
            <!-- Form fields go here -->
            @if (loading()) {
                <div
                    class="bg-base-200 flex w-full flex-col items-center justify-center space-y-4 rounded-xl px-8 py-16"
                >
                    <mat-spinner [diameter]="32" />
                    <p>{{ loading() | translate }}</p>
                </div>
            }
        </fullscreen-modal-shell>
    `,
    styles: [``],
    imports: [
        CommonModule,
        TranslatePipe,
        MatProgressSpinnerModule,
        SettingsToggleComponent,
        MatFormFieldModule,
        MatInputModule,
        ReactiveFormsModule,
        MatSelectModule,
        ItemSearchFieldComponent,
        FormsModule,
        FullscreenModalShellComponent,
    ],
})
export class DriverFormComponent extends AsyncHandler implements OnInit {
    private _dialog_ref =
        inject<MatDialogRef<DriverFormComponent>>(MatDialogRef);
    private _data = inject<{ item: PlaceDriver; readonly?: string }>(
        MAT_DIALOG_DATA,
    );
    private readonly _name = 'DRIVERS';
    private _hotkey = inject(HotkeysService);
    private _date_pipe = new DatePipe('en');

    @Output() public event = new EventEmitter<DialogEvent>();

    public form: UntypedFormGroup;
    public saving: string;
    public heading: string;

    public readonly is_editing = computed(() => !!this.form?.value?.id);
    public readonly loading = signal('');
    public readonly loading_type = signal([]);
    public readonly commit_error = signal(false);
    public readonly role_types = [
        { id: PlaceDriverRole.SSH, name: 'DRIVERS.SSH' },
        { id: PlaceDriverRole.Device, name: 'DRIVERS.DEVICE' },
        { id: PlaceDriverRole.Service, name: 'DRIVERS.SERVICE' },
        { id: PlaceDriverRole.Websocket, name: 'DRIVERS.WEBSOCKET' },
        { id: PlaceDriverRole.Logic, name: 'DRIVERS.LOGIC' },
    ];
    public readonly alert_levels = [
        { id: 'low', name: 'COMMON.ALERT_LOW' },
        { id: 'medium', name: 'COMMON.ALERT_MEDIUM' },
        { id: 'high', name: 'COMMON.ALERT_HIGH' },
        { id: 'critical', name: 'COMMON.ALERT_CRITICAL' },
    ];

    public readonly repo = new BehaviorSubject(null);
    public readonly driver = new BehaviorSubject(null);
    public readonly commit = new BehaviorSubject(null);

    // AI Builder signals and properties
    public readonly use_ai_builder = signal(false);
    public readonly ai_building = signal(false);
    public readonly ai_testing = signal(false);
    public readonly ai_build_status = signal('');
    public readonly ai_build_progress = signal<string[]>([]);
    public readonly ai_driver_data = signal<{ name: string; code: string; file_name: string } | null>(null);
    public readonly ai_uploaded_files = signal<File[]>([]);
    public readonly test_result = signal<{ success: boolean; message: string; details?: string } | null>(null);

    public ai_driver_name = '';
    public ai_device_type = '';
    public ai_driver_requirements = '';
    public ai_protocol = 'http';
    public ai_additional_context = '';
    public test_host = '';

    public readonly repo_list = queryRepositories({ limit: 1000 }).pipe(
        map(({ data }) =>
            data.filter((repo) => repo.type === PlaceRepositoryType.Driver),
        ),
        shareReplay(1),
    );

    public readonly driver_list = this.repo.pipe(
        filter((item) => !!item?.id),
        distinctUntilKeyChanged('id'),
        tap(() => this.loading_type.update((types) => [...types, 'drivers'])),
        switchMap(({ id }) =>
            listRepositoryDrivers(id, { limit: 1000 }).pipe(
                catchError(() => of([] as string[])),
            ),
        ),
        map((list) =>
            list.map((_) => ({
                id: _,
                name: _.replace(/\//g, ' > '),
            })),
        ),
        tap(() =>
            this.loading_type.update((types) =>
                types.filter((_) => _ !== 'drivers'),
            ),
        ),
        shareReplay(1),
    );

    public readonly commit_list = combineLatest([this.repo, this.driver]).pipe(
        filter(([repo, driver]) => !!repo?.id && !!driver?.id),
        distinctUntilChanged(
            ([prev_repo, prev_driver], [curr_repo, curr_driver]) =>
                prev_repo?.id === curr_repo?.id &&
                prev_driver?.id === curr_driver?.id,
        ),
        tap(() => this.loading_type.update((types) => [...types, 'commits'])),
        switchMap(([{ id }, driver]) =>
            listRepositoryCommits(id, {
                driver: driver.id,
                limit: 1000,
            }).pipe(catchError(() => of([] as GitCommitDetails[]))),
        ),
        map((list) =>
            list.map((item) => ({
                id: item.commit,
                name: `${item.subject}`,
                extra: isAfter(item.date, subMinutes(item.date, 1))
                    ? this._date_pipe.transform(item.date.valueOf())
                    : format(item.date, 'dd MMM yyyy'),
            })),
        ),
        tap(() =>
            this.loading_type.update((types) =>
                types.filter((_) => _ !== 'commits'),
            ),
        ),
        shareReplay(1),
    );

    public ngOnInit(): void {
        const item = this._data.item;
        const edit = !!item.id;
        this.heading = i18n(`${this._name}.${edit ? 'EDIT' : 'NEW'}`);
        this.form = generateDriverFormFields(item);
        this._loadDetailsFromForm();
        this.subscription(
            'save_item_key',
            this._hotkey.listen(['KeyS'], () => this.submit()),
        );
    }

    public fieldInvalid(field: string) {
        return (
            this.form.controls[field].invalid &&
            this.form.controls[field].touched
        );
    }

    public async applyDriverCommit(commit: {
        id: string;
        name: string;
        extra: string;
    }) {
        const old_commit = this.commit.getValue();
        this.form.patchValue({ commit: commit.id });
        this.commit.next(commit);
        this.commit_error.set(false);
        const repo = this.repo.getValue();
        const driver = this.driver.getValue();
        if (!driver.id) return;
        this.loading.set('DRIVERS.DETAILS_LOADING');
        this.form.patchValue({
            repository_id: repo.id,
            file_name: driver.id,
        });
        this.subscription(
            'driver_details',
            listRepositoryDriverDetails(repo.id, {
                driver: `${driver.id}`,
                commit: `${commit.id}`,
            })
                .pipe(catchError(() => of(null)))
                .subscribe((details) => {
                    if (!details) {
                        this.form.patchValue({ commit: old_commit.id });
                        this.commit.next(old_commit);
                        this.loading.set('');
                        this.commit_error.set(true);
                        notifyError(
                            `Failed to get driver details for commit "${commit.id}"`,
                        );
                        return;
                    }
                    if (this.form.value.id) {
                        this.loading.set('');
                        return;
                    }
                    this._applyDriverDetails(details);
                }),
        );
    }

    public submit(): void {
        this.form.markAllAsTouched();
        if (!this.form.valid) {
            return notifyError(
                i18n('COMMON.INVALID_FIELDS', {
                    field_list: getInvalidFields(this.form).join(', '),
                }),
            );
        }
        const item = this._data.item;
        this.saving = i18n(`${this._name}.SAVING`);
        this._dialog_ref.disableClose = true;
        const item_json = item.toJSON ? item.toJSON() : item;
        const form_item = (
            item.id
                ? cleanObject({ ...item_json, ...this.form.value }, [undefined])
                : { ...item_json, ...this.form.value }
        ) as Identity;
        (form_item.id
            ? updateDriver(
                  form_item.id as string,
                  form_item as unknown as PlaceDriver,
              )
            : addDriver(form_item as unknown as PlaceDriver)
        ).subscribe(
            (_item) => {
                this._dialog_ref.disableClose = false;
                this.event.emit({
                    reason: 'done',
                    metadata: { item: _item as unknown as Identity },
                });
                notifySuccess(i18n(`${this._name}.SAVE_SUCCESS`));
                if (!this.form.value.id && this.form.controls.settings) {
                    this.newSettings(
                        _item as unknown as Identity,
                        this.form.controls.settings.value,
                    ).then(() => this._dialog_ref.close());
                } else {
                    this._dialog_ref.close();
                }
            },
            async (err) => {
                this.saving = null;
                this._dialog_ref.disableClose = false;
                notifyError(
                    i18n(`${this._name}.SAVE_ERROR`, {
                        error: JSON.stringify(
                            (await err.text?.()) || err.message || err,
                        ),
                    }),
                );
            },
        );
    }

    private _applyDriverDetails(details: PlaceDriverDetails) {
        if (details == null) {
            this.loading.set('');
            return;
        }
        const driver = this.driver.getValue();
        const details_any = details;
        let settings = details_any.default_settings || '';
        try {
            JSON.parse(details_any.default_settings);
            const doc = yaml.load(details_any.default_settings);
            settings = yaml.dump(doc);
        } catch (error) {
            console.error(
                'Error parsing settings:',
                error,
                driver.default_settings,
            );
        }
        const port_number =
            details_any.tcp_port || details_any.udp_port || null;
        this.form.patchValue({
            name: details_any.descriptive_name || '',
            module_name: details_any.generic_name || '',
            class_name: driver.id || '',
            settings,
            default_port: port_number,
            default_uri: details_any.uri_base || '',
            role: port_number
                ? port_number === 22
                    ? PlaceDriverRole.SSH
                    : PlaceDriverRole.Device
                : details_any.uri_base
                  ? details_any.uri_base.startsWith('ws')
                      ? PlaceDriverRole.Websocket
                      : PlaceDriverRole.Service
                  : PlaceDriverRole.Logic,
            description: details_any.description || '',
        });
        this.loading.set('');
    }

    private async _loadDetailsFromForm() {
        const { id, commit, file_name, repository_id } = this.form.value;
        if (!id) return;
        this.loading.set('DRIVERS.DETAILS_LOADING');
        const repo = await lastValueFrom(showRepository(repository_id));
        const driver = {
            id: file_name,
            name: file_name.replace(/\//g, ' > '),
        };
        this.repo.next(repo);
        this.driver.next(driver);
        const commit_list = await nextValueFrom(this.commit_list);
        const active_commit = commit_list.find((c) => c.id === commit);
        if (active_commit) this.commit.next(active_commit);
        this.loading.set('');
    }

    private async newSettings(item: Identity, settings_string: string) {
        const new_settings = new PlaceSettings({
            parent_id: item.id as string,
            settings_string,
            encryption_level: EncryptionLevel.Support,
        });
        await addSettings(new_settings)
            .toPromise()
            .catch((err) => {
                this.saving = null;
                notifyError(
                    `Error saving settings for ${
                        item.name || item.id
                    }. Error: ${JSON.stringify(
                        err.response || err.message || err,
                    )}`,
                );
            });
    }

    // AI Builder Methods
    public canBuildAiDriver(): boolean {
        return !!(this.ai_driver_name && this.ai_driver_requirements);
    }

    public onAiFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            const new_files = Array.from(input.files);
            this.ai_uploaded_files.update((files) => [...files, ...new_files]);
        }
    }

    public removeAiFile(file: File): void {
        this.ai_uploaded_files.update((files) =>
            files.filter((f) => f !== file),
        );
    }

    public async buildAiDriver(): Promise<void> {
        this.ai_building.set(true);
        this.ai_build_progress.set([]);
        this.test_result.set(null);

        const steps = [
            'Analyzing requirements and protocol...',
            'Processing uploaded documentation...',
            'Understanding PlaceOS Driver API...',
            'Generating driver class structure...',
            'Implementing connection handlers...',
            'Creating command methods...',
            'Adding status monitoring...',
            'Generating settings schema...',
            'Finalizing driver code...',
        ];

        for (let i = 0; i < steps.length; i++) {
            this.ai_build_status.set(steps[i]);
            await this.delay(700);
            this.ai_build_progress.update((p) => [...p, steps[i]]);
        }

        // Generate mock driver
        const driver_data = this.generateMockDriverCode();
        this.ai_driver_data.set(driver_data);
        this.ai_building.set(false);
    }

    public async testAiDriver(): Promise<void> {
        this.ai_testing.set(true);
        this.test_result.set(null);

        await this.delay(2000);

        // Mock test result
        const success = Math.random() > 0.3;
        this.test_result.set({
            success,
            message: success
                ? `Successfully connected to ${this.test_host}`
                : `Failed to connect to ${this.test_host}`,
            details: success
                ? `Connection established via ${this.ai_protocol.toUpperCase()}\nDevice responded successfully\nDriver loaded and initialized`
                : `Connection timeout after 5 seconds\nVerify device IP and network connectivity\nCheck protocol settings`,
        });

        this.ai_testing.set(false);
    }

    public resetAiBuilder(): void {
        this.ai_driver_name = '';
        this.ai_device_type = '';
        this.ai_driver_requirements = '';
        this.ai_protocol = 'http';
        this.ai_additional_context = '';
        this.ai_uploaded_files.set([]);
        this.ai_driver_data.set(null);
        this.ai_build_progress.set([]);
        this.test_result.set(null);
        this.test_host = '';
    }

    public useAiDriver(): void {
        const data = this.ai_driver_data();
        // Create a mock commit for AI-generated driver
        const mock_commit = {
            id: 'ai-generated',
            name: 'AI Generated Driver',
            extra: new Date().toLocaleDateString(),
        };

        // Set the driver and commit
        this.driver.next({
            id: data.file_name,
            name: data.name,
        });
        this.commit.next(mock_commit);

        // Apply the generated code to the form
        this.form.patchValue({
            name: data.name,
            file_name: data.file_name,
            module_name: data.name.replace(/\s+/g, ''),
            commit: 'ai-generated',
            repository_id: this.repo.getValue().id,
            description: `AI-generated driver for ${this.ai_device_type}`,
            role: this.getDriverRole(),
            settings: '{}',
        });

        notifySuccess('AI-generated driver loaded! Review and save when ready.');
    }

    private getDriverRole(): PlaceDriverRole {
        switch (this.ai_protocol) {
            case 'ssh':
                return PlaceDriverRole.SSH;
            case 'websocket':
                return PlaceDriverRole.Websocket;
            case 'tcp':
            case 'telnet':
                return PlaceDriverRole.Device;
            case 'http':
            default:
                return PlaceDriverRole.Service;
        }
    }

    private generateMockDriverCode(): {
        name: string;
        code: string;
        file_name: string;
    } {
        const name = this.ai_driver_name;
        const class_name = name
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join('');
        const file_name = `drivers/${class_name.toLowerCase()}.cr`;

        const code = `# frozen_string_literal: true

# PlaceOS Driver for ${name}
# Device Type: ${this.ai_device_type}
# Protocol: ${this.ai_protocol.toUpperCase()}
# Auto-generated by Claude AI
# Date: ${new Date().toISOString()}

module ${class_name}
  class Driver < PlaceOS::Driver
    # Discovery Information
    descriptive_name "${name}"
    generic_name "${name.split(' ')[0]}"
    description "${this.ai_driver_requirements}"

    # Protocol: ${this.ai_protocol}
    ${this.ai_protocol === 'tcp' || this.ai_protocol === 'telnet' ? 'tcp_port 23' : ''}
    ${this.ai_protocol === 'ssh' ? 'tcp_port 22' : ''}
    ${this.ai_protocol === 'http' ? 'uri_base "http://device"' : ''}
    ${this.ai_protocol === 'websocket' ? 'uri_base "ws://device"' : ''}

    default_settings({
      ${this.ai_protocol === 'http' ? 'base_url: "http://192.168.1.100",' : ''}
      ${this.ai_protocol === 'http' ? 'api_key: "your-api-key",' : ''}
      ${this.ai_protocol === 'tcp' || this.ai_protocol === 'telnet' ? 'host: "192.168.1.100",' : ''}
      ${this.ai_protocol === 'tcp' || this.ai_protocol === 'telnet' ? 'port: 23' : ''}
    })

    def on_load
      on_update
    end

    def on_update
      ${this.ai_protocol === 'http' ? '@base_url = setting?(String, :base_url) || "http://192.168.1.100"' : ''}
      ${this.ai_protocol === 'http' ? '@api_key = setting?(String, :api_key)' : ''}
    end

    def connected
      logger.info { "Connected to ${name}" }
      schedule.every("30s") { query_status }

      # Initial status query
      query_status
    end

    def disconnected
      logger.warn { "Disconnected from ${name}" }
      schedule.clear
    end

    # Main driver commands based on requirements:
    # ${this.ai_driver_requirements}

    def power(state : Bool)
      logger.debug { "Setting power to: #{ state}" }
      ${this.generatePowerCommand()}
      self[:power] = state
    end

    def query_status
      logger.debug { "Querying device status" }
      ${this.generateStatusQuery()}

      self[:status] = {
        power: self[:power],
        connected: true,
        last_update: Time.utc.to_unix
      }
    end

    # Helper methods
    private def send_command(cmd : String)
      logger.debug { "Sending command: #{cmd}" }
      ${this.ai_protocol === 'tcp' || this.ai_protocol === 'telnet' ? 'send(cmd + "\\r\\n")' : '# Implementation here'}
    end

    ${
        this.ai_protocol === 'http'
            ? `
    private def make_request(endpoint : String, method = "GET", body = nil)
      headers = {
        "Authorization" => "Bearer #{@api_key}",
        "Content-Type" => "application/json"
      }

      uri = URI.parse("#{@base_url}#{endpoint}")

      # HTTP request implementation
      # ...
    end`
            : ''
    }

    # Received data handler
    def received(data : Bytes, task : PlaceOS::Driver::Task?)
      logger.debug { "Received: #{String.new(data)}" }

      # Parse and process response
      # Update status variables with self[:key] = value
    end
  end
end`;

        return {
            name,
            code,
            file_name,
        };
    }

    private generatePowerCommand(): string {
        switch (this.ai_protocol) {
            case 'http':
                return 'make_request("/power", "POST", {state: state}.to_json)';
            case 'tcp':
            case 'telnet':
                return 'send_command(state ? "POWER ON" : "POWER OFF")';
            default:
                return '# Power control implementation';
        }
    }

    private generateStatusQuery(): string {
        switch (this.ai_protocol) {
            case 'http':
                return 'make_request("/status", "GET")';
            case 'tcp':
            case 'telnet':
                return 'send_command("STATUS?")';
            default:
                return '# Status query implementation';
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
