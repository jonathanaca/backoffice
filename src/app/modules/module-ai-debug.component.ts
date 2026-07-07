import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PlaceModule } from '@placeos/ts-client';
import { AsyncHandler } from '../common/async-handler.class';
import { ActiveItemService } from '../common/item.service';
import { IconComponent } from '../ui/icon.component';
import { TranslatePipe } from '../ui/translate.pipe';

interface DebugMessage {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
}

interface DebugIssue {
    severity: 'critical' | 'warning' | 'info';
    category: string;
    title: string;
    description: string;
    suggested_fix: string;
    code_reference?: string;
}

@Component({
    selector: 'module-ai-debug',
    template: `
        <div class="flex h-full flex-col overflow-hidden p-4">
            <div class="mb-4">
                <h2 class="text-2xl font-semibold">AI Debugging Assistant</h2>
                <p class="text-base-content/70 mt-1 text-sm">
                    Analyze module messages and troubleshoot issues with AI
                    assistance
                </p>
            </div>

            @if (item()) {
                <div class="bg-base-200/50 mb-4 rounded-lg p-3">
                    <div class="flex items-center gap-2">
                        <icon>extension</icon>
                        <span class="font-medium">{{ item().name }}</span>
                        <span class="text-base-content/60 text-sm"
                            >({{ item().driver?.name }})</span
                        >
                    </div>
                </div>
            }

            @if (!analyzing() && !analysis_result()) {
                <div class="flex flex-1 flex-col gap-4 overflow-auto">
                    <!-- Recent Messages Display -->
                    <div class="border-base-200 rounded-lg border">
                        <div class="border-base-200 flex items-center justify-between border-b bg-base-200/50 px-4 py-3">
                            <h3 class="flex items-center gap-2 font-semibold">
                                <icon>bug_report</icon>
                                <span>Recent Module Messages</span>
                            </h3>
                            <button
                                class="hover:bg-base-300 rounded px-3 py-1 text-sm"
                                (click)="refreshMessages()"
                            >
                                <icon class="text-lg">refresh</icon>
                            </button>
                        </div>
                        <div class="max-h-96 divide-base-200 divide-y overflow-auto">
                            @for (msg of recent_messages(); track $index) {
                                <div
                                    class="px-4 py-2"
                                    [class.bg-error/10]="msg.level === 'error'"
                                    [class.bg-warning/10]="msg.level === 'warn'"
                                >
                                    <div class="flex items-start gap-2">
                                        <icon
                                            class="mt-0.5 text-lg"
                                            [class.text-error]="
                                                msg.level === 'error'
                                            "
                                            [class.text-warning]="
                                                msg.level === 'warn'
                                            "
                                            [class.text-info]="
                                                msg.level === 'info'
                                            "
                                            [class.text-base-content/40]="
                                                msg.level === 'debug'
                                            "
                                        >
                                            {{
                                                msg.level === 'error'
                                                    ? 'error'
                                                    : msg.level === 'warn'
                                                      ? 'warning'
                                                      : msg.level === 'info'
                                                        ? 'info'
                                                        : 'code'
                                            }}
                                        </icon>
                                        <div class="flex-1">
                                            <p class="font-mono text-sm">
                                                {{ msg.message }}
                                            </p>
                                            <p class="text-base-content/60 mt-1 text-xs">
                                                {{ msg.timestamp }}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            }
                        </div>
                    </div>

                    <!-- Analysis Button -->
                    <div class="flex justify-end gap-3 pt-4">
                        <button
                            class="bg-primary text-primary-content hover:bg-primary/90 disabled:bg-base-300 disabled:text-base-content/50 flex items-center gap-2 rounded-lg px-4 py-2"
                            [disabled]="recent_messages().length === 0"
                            (click)="analyzeWithAI()"
                        >
                            <icon>auto_awesome</icon>
                            <span>Analyze with Claude</span>
                        </button>
                    </div>
                </div>
            } @else if (analyzing()) {
                <!-- Analyzing Progress -->
                <div class="flex flex-1 flex-col items-center justify-center">
                    <mat-spinner diameter="64"></mat-spinner>
                    <p class="mt-6 text-lg font-medium">{{ analysis_status() }}</p>
                    <p class="text-base-content/70 mt-2 text-sm">
                        Claude is analyzing module behavior...
                    </p>

                    @if (analysis_progress().length > 0) {
                        <div class="mt-8 w-full max-w-md">
                            @for (step of analysis_progress(); track $index) {
                                <div
                                    class="border-base-200 mb-2 flex items-start gap-3 border-l-2 py-2 pl-4"
                                >
                                    <icon
                                        class="text-success mt-0.5 text-xl"
                                        >check_circle</icon
                                    >
                                    <span class="text-sm">{{ step }}</span>
                                </div>
                            }
                        </div>
                    }
                </div>
            } @else if (analysis_result()) {
                <!-- Analysis Results -->
                <div class="flex flex-1 flex-col gap-4 overflow-auto">
                    <!-- Summary -->
                    <div
                        class="rounded-lg border p-4"
                        [class.border-success]="
                            analysis_result().status === 'healthy'
                        "
                        [class.bg-success/10]="
                            analysis_result().status === 'healthy'
                        "
                        [class.border-warning]="
                            analysis_result().status === 'warning'
                        "
                        [class.bg-warning/10]="
                            analysis_result().status === 'warning'
                        "
                        [class.border-error]="
                            analysis_result().status === 'critical'
                        "
                        [class.bg-error/10]="
                            analysis_result().status === 'critical'
                        "
                    >
                        <div class="flex items-center gap-2">
                            <icon class="text-2xl">
                                {{
                                    analysis_result().status === 'healthy'
                                        ? 'check_circle'
                                        : analysis_result().status === 'warning'
                                          ? 'warning'
                                          : 'error'
                                }}
                            </icon>
                            <div>
                                <h3 class="font-semibold">
                                    {{
                                        analysis_result().status === 'healthy'
                                            ? 'Module is Operating Normally'
                                            : analysis_result().status ===
                                                'warning'
                                              ? 'Potential Issues Detected'
                                              : 'Critical Issues Found'
                                    }}
                                </h3>
                                <p class="text-sm">
                                    {{ analysis_result().summary }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Issues Found -->
                    @if (analysis_result().issues.length > 0) {
                        <div class="border-base-200 rounded-lg border">
                            <div class="border-base-200 border-b bg-base-200/50 px-4 py-3">
                                <h3 class="flex items-center gap-2 font-semibold">
                                    <icon>troubleshoot</icon>
                                    <span>Issues & Recommendations ({{
                                        analysis_result().issues.length
                                    }})</span>
                                </h3>
                            </div>
                            <div class="divide-base-200 divide-y">
                                @for (
                                    issue of analysis_result().issues;
                                    track $index
                                ) {
                                    <div class="p-4">
                                        <div class="mb-2 flex items-start justify-between">
                                            <div class="flex-1">
                                                <div class="mb-1 flex items-center gap-2">
                                                    <span
                                                        class="rounded px-2 py-0.5 text-xs font-medium uppercase"
                                                        [class.bg-error]="
                                                            issue.severity ===
                                                            'critical'
                                                        "
                                                        [class.text-error-content]="
                                                            issue.severity ===
                                                            'critical'
                                                        "
                                                        [class.bg-warning]="
                                                            issue.severity ===
                                                            'warning'
                                                        "
                                                        [class.text-warning-content]="
                                                            issue.severity ===
                                                            'warning'
                                                        "
                                                        [class.bg-info]="
                                                            issue.severity ===
                                                            'info'
                                                        "
                                                        [class.text-info-content]="
                                                            issue.severity ===
                                                            'info'
                                                        "
                                                        >{{
                                                            issue.severity
                                                        }}</span
                                                    >
                                                    <span
                                                        class="text-base-content/60 text-xs"
                                                        >{{ issue.category }}</span
                                                    >
                                                </div>
                                                <h4 class="font-medium">
                                                    {{ issue.title }}
                                                </h4>
                                                <p class="text-base-content/70 mt-1 text-sm">
                                                    {{ issue.description }}
                                                </p>
                                            </div>
                                        </div>
                                        <div class="bg-primary/5 border-primary/20 mt-3 rounded-lg border p-3">
                                            <div class="mb-1 flex items-center gap-1 text-sm font-medium">
                                                <icon class="text-primary text-lg"
                                                    >lightbulb</icon
                                                >
                                                <span>Suggested Fix:</span>
                                            </div>
                                            <p class="text-sm">
                                                {{ issue.suggested_fix }}
                                            </p>
                                            @if (issue.code_reference) {
                                                <pre
                                                    class="bg-base-200 mt-2 overflow-auto rounded p-2 text-xs"><code>{{ issue.code_reference }}</code></pre>
                                            }
                                        </div>
                                    </div>
                                }
                            </div>
                        </div>
                    }

                    <!-- Action Buttons -->
                    <div class="flex justify-end gap-3 pt-4">
                        <button
                            class="border-base-300 hover:bg-base-200 rounded-lg border px-4 py-2"
                            (click)="reset()"
                        >
                            Analyze Again
                        </button>
                        <button
                            class="border-primary text-primary hover:bg-primary/10 rounded-lg border px-4 py-2"
                            (click)="exportReport()"
                        >
                            Export Report
                        </button>
                    </div>
                </div>
            }
        </div>
    `,
    styles: [``],
    imports: [
        CommonModule,
        IconComponent,
        TranslatePipe,
        MatProgressSpinnerModule,
    ],
})
export class ModuleAIDebugComponent extends AsyncHandler implements OnInit {
    private _service = inject(ActiveItemService);

    public readonly item = signal<PlaceModule>(null);
    public readonly recent_messages = signal<DebugMessage[]>([]);
    public readonly analyzing = signal(false);
    public readonly analysis_status = signal('');
    public readonly analysis_progress = signal<string[]>([]);
    public readonly analysis_result = signal<{
        status: 'healthy' | 'warning' | 'critical';
        summary: string;
        issues: DebugIssue[];
    } | null>(null);

    public ngOnInit(): void {
        this.subscription(
            'item',
            this._service.item.subscribe((item) => {
                this.item.set(item as PlaceModule);
                this.loadMessages();
            }),
        );
    }

    public loadMessages(): void {
        // Mock loading recent module messages
        this.recent_messages.set([
            {
                level: 'error',
                message: 'Connection timeout to device at 192.168.1.100',
                timestamp: new Date(Date.now() - 300000).toLocaleString(),
            },
            {
                level: 'warn',
                message: 'Retrying connection (attempt 3 of 5)',
                timestamp: new Date(Date.now() - 240000).toLocaleString(),
            },
            {
                level: 'error',
                message: 'Authentication failed: Invalid credentials',
                timestamp: new Date(Date.now() - 180000).toLocaleString(),
            },
            {
                level: 'info',
                message: 'Module started successfully',
                timestamp: new Date(Date.now() - 600000).toLocaleString(),
            },
            {
                level: 'debug',
                message: 'Loading settings from database',
                timestamp: new Date(Date.now() - 590000).toLocaleString(),
            },
        ]);
    }

    public refreshMessages(): void {
        this.loadMessages();
    }

    public async analyzeWithAI(): Promise<void> {
        this.analyzing.set(true);
        this.analysis_progress.set([]);
        this.analysis_result.set(null);

        const steps = [
            'Collecting module logs and messages...',
            'Analyzing error patterns...',
            'Checking driver compatibility...',
            'Reviewing configuration settings...',
            'Consulting PlaceOS documentation...',
            'Generating diagnostic report...',
        ];

        for (let i = 0; i < steps.length; i++) {
            this.analysis_status.set(steps[i]);
            await this.delay(600);
            this.analysis_progress.update((p) => [...p, steps[i]]);
        }

        // Generate mock analysis result
        const result = this.generateMockAnalysis();
        this.analysis_result.set(result);
        this.analyzing.set(false);
    }

    private generateMockAnalysis(): {
        status: 'healthy' | 'warning' | 'critical';
        summary: string;
        issues: DebugIssue[];
    } {
        const has_connection_errors = this.recent_messages().some(
            (m) => m.message.includes('Connection') && m.level === 'error',
        );
        const has_auth_errors = this.recent_messages().some(
            (m) => m.message.includes('Authentication') && m.level === 'error',
        );

        const issues: DebugIssue[] = [];

        if (has_connection_errors) {
            issues.push({
                severity: 'critical',
                category: 'Network',
                title: 'Connection Timeout Issues',
                description:
                    'The module is unable to establish a connection to the device. This is preventing normal operation.',
                suggested_fix:
                    'Verify that the device is powered on and connected to the network. Check that the IP address (192.168.1.100) is correct in the module settings. Ensure there are no firewall rules blocking communication.',
                code_reference: 'ip_address: "192.168.1.100"\nport: 23',
            });
        }

        if (has_auth_errors) {
            issues.push({
                severity: 'critical',
                category: 'Authentication',
                title: 'Invalid Credentials',
                description:
                    'The module is unable to authenticate with the device. This suggests incorrect username or password.',
                suggested_fix:
                    'Update the module settings with the correct credentials. Check the device documentation for default credentials. Ensure the device account has not been locked due to multiple failed login attempts.',
                code_reference:
                    'username: "admin"\npassword: "YOUR_PASSWORD_HERE"',
            });
        }

        issues.push({
            severity: 'warning',
            category: 'Performance',
            title: 'Frequent Retry Attempts',
            description:
                'The module is making frequent retry attempts, which may indicate an unstable connection.',
            suggested_fix:
                'Once the connection and authentication issues are resolved, monitor the module to ensure stable operation. Consider increasing the connection timeout if the device is slow to respond.',
        });

        const status: 'healthy' | 'warning' | 'critical' =
            issues.some((i) => i.severity === 'critical')
                ? 'critical'
                : issues.some((i) => i.severity === 'warning')
                  ? 'warning'
                  : 'healthy';

        return {
            status,
            summary:
                status === 'critical'
                    ? 'The module has critical connection and authentication failures preventing normal operation.'
                    : status === 'warning'
                      ? 'The module is operating but has some performance concerns that should be addressed.'
                      : 'The module is operating normally with no significant issues detected.',
            issues,
        };
    }

    public reset(): void {
        this.analysis_result.set(null);
        this.analysis_progress.set([]);
        this.loadMessages();
    }

    public exportReport(): void {
        const report = {
            module: this.item()?.name,
            driver: this.item()?.driver?.name,
            analysis_date: new Date().toISOString(),
            status: this.analysis_result().status,
            summary: this.analysis_result().summary,
            issues: this.analysis_result().issues,
            recent_messages: this.recent_messages(),
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `module-debug-report-${this.item()?.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
