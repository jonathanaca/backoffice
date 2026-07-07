import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AsyncHandler } from '../common/async-handler.class';
import { ActiveItemService } from '../common/item.service';
import { IconComponent } from '../ui/icon.component';
import { TranslatePipe } from '../ui/translate.pipe';

@Component({
    selector: 'driver-ai-builder',
    template: `
        <div class="flex h-full flex-col overflow-hidden p-4">
            <div class="mb-4">
                <h2 class="text-2xl font-semibold">Build Driver with Claude</h2>
                <p class="text-base-content/70 mt-1 text-sm">
                    Upload API documentation or provide context to build a new
                    PlaceOS driver with AI assistance
                </p>
            </div>

            @if (!building()) {
                <div class="flex flex-1 flex-col gap-4 overflow-auto">
                    <!-- Driver Name Input -->
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Driver Name</label
                        >
                        <input
                            type="text"
                            [(ngModel)]="driver_name"
                            placeholder="e.g., Cisco Webex Controller"
                            class="border-base-300 bg-base-100 w-full rounded-lg border px-3 py-2"
                        />
                    </div>

                    <!-- Description Input -->
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Description</label
                        >
                        <textarea
                            [(ngModel)]="description"
                            placeholder="Describe what this driver should do..."
                            rows="3"
                            class="border-base-300 bg-base-100 w-full rounded-lg border px-3 py-2"
                        ></textarea>
                    </div>

                    <!-- File Upload Section -->
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Upload Documentation</label
                        >
                        <div
                            class="border-base-300 hover:bg-base-200/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
                            (click)="file_input.click()"
                        >
                            <icon class="text-base-content/40 mb-2 text-4xl"
                                >upload_file</icon
                            >
                            <p class="text-base-content/70 text-sm">
                                Click to upload API docs, PDFs, or text files
                            </p>
                            @if (uploaded_files().length > 0) {
                                <div class="mt-3 flex flex-col gap-1">
                                    @for (
                                        file of uploaded_files();
                                        track file.name
                                    ) {
                                        <div
                                            class="bg-primary/10 text-primary flex items-center gap-2 rounded px-3 py-1 text-sm"
                                        >
                                            <icon class="text-lg">description</icon>
                                            <span>{{ file.name }}</span>
                                            <button
                                                (click)="
                                                    removeFile(file);
                                                    $event.stopPropagation()
                                                "
                                            >
                                                <icon class="text-lg">close</icon>
                                            </button>
                                        </div>
                                    }
                                </div>
                            }
                        </div>
                        <input
                            #file_input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.txt,.md,.json,.yaml,.yml"
                            class="hidden"
                            (change)="onFileSelected($event)"
                        />
                    </div>

                    <!-- Additional Context -->
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Additional Context</label
                        >
                        <textarea
                            [(ngModel)]="context"
                            placeholder="Provide any additional information: API endpoints, authentication methods, protocols, etc."
                            rows="5"
                            class="border-base-300 bg-base-100 w-full rounded-lg border px-3 py-2"
                        ></textarea>
                    </div>

                    <!-- Example Requests -->
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Example API Requests (Optional)</label
                        >
                        <textarea
                            [(ngModel)]="example_requests"
                            placeholder="Paste example API requests or sample responses..."
                            rows="4"
                            class="border-base-300 bg-base-100 font-mono text-xs w-full rounded-lg border px-3 py-2"
                        ></textarea>
                    </div>

                    <!-- Build Button -->
                    <div class="flex justify-end gap-3 pt-4">
                        <button
                            class="border-base-300 hover:bg-base-200 rounded-lg border px-4 py-2"
                            (click)="reset()"
                        >
                            Reset
                        </button>
                        <button
                            class="bg-primary text-primary-content hover:bg-primary/90 disabled:bg-base-300 disabled:text-base-content/50 flex items-center gap-2 rounded-lg px-4 py-2"
                            [disabled]="!canBuild()"
                            (click)="buildDriver()"
                        >
                            <icon>auto_awesome</icon>
                            <span>Build Driver with Claude</span>
                        </button>
                    </div>
                </div>
            } @else {
                <!-- Building Progress -->
                <div class="flex flex-1 flex-col items-center justify-center">
                    <mat-spinner diameter="64"></mat-spinner>
                    <p class="mt-6 text-lg font-medium">{{ build_status() }}</p>
                    <p class="text-base-content/70 mt-2 text-sm">
                        This may take a few moments...
                    </p>

                    @if (build_progress().length > 0) {
                        <div class="mt-8 w-full max-w-md">
                            @for (step of build_progress(); track $index) {
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
            }

            @if (generated_code()) {
                <!-- Generated Code Display -->
                <div
                    class="border-base-200 bg-base-200/50 mt-4 flex flex-col overflow-hidden rounded-lg border"
                >
                    <div class="border-base-200 flex items-center justify-between border-b px-4 py-2">
                        <span class="font-medium">Generated Driver Code</span>
                        <div class="flex gap-2">
                            <button
                                class="hover:bg-base-300 rounded px-3 py-1 text-sm"
                                (click)="copyCode()"
                            >
                                <icon class="text-lg">content_copy</icon>
                            </button>
                            <button
                                class="bg-primary text-primary-content hover:bg-primary/90 rounded px-3 py-1 text-sm"
                                (click)="saveDriver()"
                            >
                                Save Driver
                            </button>
                        </div>
                    </div>
                    <pre
                        class="overflow-auto p-4 text-xs"><code>{{ generated_code() }}</code></pre>
                </div>
            }
        </div>
    `,
    styles: [``],
    imports: [
        CommonModule,
        FormsModule,
        IconComponent,
        TranslatePipe,
        MatProgressSpinnerModule,
    ],
})
export class DriverAIBuilderComponent extends AsyncHandler {
    private _service = inject(ActiveItemService);

    public driver_name = '';
    public description = '';
    public context = '';
    public example_requests = '';
    public readonly uploaded_files = signal<File[]>([]);
    public readonly building = signal(false);
    public readonly build_status = signal('');
    public readonly build_progress = signal<string[]>([]);
    public readonly generated_code = signal('');

    public canBuild(): boolean {
        return !!(this.driver_name && this.description);
    }

    public onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            const new_files = Array.from(input.files);
            this.uploaded_files.update((files) => [...files, ...new_files]);
        }
    }

    public removeFile(file: File): void {
        this.uploaded_files.update((files) =>
            files.filter((f) => f !== file),
        );
    }

    public reset(): void {
        this.driver_name = '';
        this.description = '';
        this.context = '';
        this.example_requests = '';
        this.uploaded_files.set([]);
        this.generated_code.set('');
        this.build_progress.set([]);
    }

    public async buildDriver(): Promise<void> {
        this.building.set(true);
        this.build_progress.set([]);
        this.generated_code.set('');

        // Simulate AI building process with mockup data
        const steps = [
            'Analyzing uploaded documentation...',
            'Understanding API structure...',
            'Generating driver class skeleton...',
            'Implementing commands and methods...',
            'Adding error handling...',
            'Generating documentation...',
            'Finalizing driver code...',
        ];

        for (let i = 0; i < steps.length; i++) {
            this.build_status.set(steps[i]);
            await this.delay(800);
            this.build_progress.update((p) => [...p, steps[i]]);
        }

        // Mock generated driver code
        const code = this.generateMockDriverCode();
        this.generated_code.set(code);
        this.building.set(false);
        this.build_status.set('Driver built successfully!');
    }

    private generateMockDriverCode(): string {
        return `# frozen_string_literal: true

# PlaceOS Driver for ${this.driver_name}
# ${this.description}
#
# Auto-generated by Claude Code
# Date: ${new Date().toISOString()}

module ${this.toPascalCase(this.driver_name)}
  class Driver < PlaceOS::Driver
    # Discovery Information
    descriptive_name "${this.driver_name}"
    generic_name "${this.driver_name.split(' ')[0]}"
    description "${this.description}"

    default_settings({
      base_url: "https://api.example.com",
      api_key: "your-api-key-here"
    })

    def on_load
      on_update
    end

    def on_update
      @base_url = setting?(String, :base_url) || "https://api.example.com"
      @api_key = setting?(String, :api_key)
    end

    def connected
      schedule.every("30s") { query_status }
    end

    # Main driver commands
    def power(state : Bool)
      logger.debug { "Setting power state to: #{state}" }
      # Implementation here
      self[:power] = state
    end

    def query_status
      logger.debug { "Querying device status" }
      # Implementation here
      {
        power: self[:power],
        connected: true,
        timestamp: Time.utc.to_unix
      }
    end

    # Helper methods
    private def make_request(endpoint : String, method = "GET", body = nil)
      headers = {
        "Authorization" => "Bearer #{@api_key}",
        "Content-Type" => "application/json"
      }

      # HTTP request implementation
      # ...
    end
  end
end`;
    }

    private toPascalCase(str: string): string {
        return str
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }

    public copyCode(): void {
        navigator.clipboard.writeText(this.generated_code());
        // Could show a toast notification here
    }

    public saveDriver(): void {
        // In a real implementation, this would save the driver
        // For now, just reset the form
        alert(
            'Driver code saved! In a real implementation, this would create a new driver in PlaceOS.',
        );
        this.reset();
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
