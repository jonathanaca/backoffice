import { Component, inject, OnInit, signal } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { AsyncHandler } from '../common/async-handler.class';
import { PlaceDebugService } from '../common/debug.service';
import { ActiveItemService } from '../common/item.service';
import { i18n } from '../common/locale.service';
import { DebugOutputComponent } from '../ui/debug-output.component';
import { IconComponent } from '../ui/icon.component';
import { ItemDetailsSkeletonComponent } from '../ui/item-details-skeleton.component';
import { ItemDetailsComponent } from '../ui/item-details.component';
import { ItemSelectionComponent } from '../ui/item-selection.component';
import { ItemSidebarComponent } from '../ui/item-sidebar.component';
import { ItemTablistComponent } from '../ui/item-tablist.component';
import { SidebarMenuComponent } from '../ui/sidebar-menu.component';
import { TranslatePipe } from '../ui/translate.pipe';

@Component({
    selector: 'skills-view',
    template: `
        <div
            class="divide-base-200 bg-base-100 absolute inset-0 flex items-center divide-y sm:divide-x sm:divide-y-0"
        >
            <sidebar-menu [(open)]="open_menu" class="sm:h-full"></sidebar-menu>
            <div class="flex h-full w-px flex-1 flex-col overflow-hidden">
                <div class="flex h-px flex-1">
                    <item-sidebar
                        class="hidden sm:block"
                        [route]="name"
                        [title]="'SKILLS.PLURAL' | translate"
                    ></item-sidebar>
                    <div class="relative z-0 flex h-full w-1/2 flex-1 flex-col">
                        <item-selection
                            class="z-20 sm:hidden"
                            [route]="name"
                            [title]="'SKILLS.PLURAL' | translate"
                        >
                            <button
                                btn
                                icon
                                class="mr-2 sm:hidden"
                                (click)="open_menu = true"
                            >
                                <icon>menu</icon>
                            </button>
                        </item-selection>
                        <div class="flex h-1/2 flex-1 flex-col">
                            @if (loading()) {
                                <item-details-skeleton></item-details-skeleton>
                            } @else if (item()?.id) {
                                <item-details
                                    [can_edit]="true"
                                    [item]="item()"
                                    [type]="'SKILLS.SINGULAR' | translate"
                                ></item-details>
                                <item-tablist
                                    [base]="name"
                                    [tabs]="tab_list"
                                    [scrolled]="scroll() > 0"
                                    class="z-10"
                                ></item-tablist>
                                <div
                                    #el
                                    class="relative z-0 h-1/2 w-full flex-1 overflow-auto"
                                    (scroll)="scroll.set(el.scrollTop)"
                                >
                                    <router-outlet></router-outlet>
                                </div>
                            }
                        </div>
                        <button
                            class="border-base-200 bg-secondary text-secondary-content absolute bottom-2 left-2 z-30 flex h-12 w-12 items-center justify-center rounded-lg border shadow-sm sm:-left-9"
                            [matTooltip]="'SKILLS.NEW' | translate"
                            matTooltipPosition="right"
                            matRipple
                            (click)="newItem()"
                        >
                            <icon class="text-3xl">add</icon>
                        </button>
                    </div>
                </div>
                @if (debug_position() === 'below') {
                    <app-debug-output below></app-debug-output>
                }
            </div>
            @if (debug_position() === 'side') {
                <app-debug-output
                    side
                    class="h-full max-w-120"
                ></app-debug-output>
            }
        </div>
    `,
    styles: [``],
    imports: [
        DebugOutputComponent,
        IconComponent,
        TranslatePipe,
        RouterModule,
        MatRippleModule,
        MatTooltipModule,
        ItemTablistComponent,
        ItemDetailsComponent,
        ItemDetailsSkeletonComponent,
        ItemSelectionComponent,
        ItemSidebarComponent,
        SidebarMenuComponent,
    ],
})
export class SkillsComponent extends AsyncHandler implements OnInit {
    protected _service = inject(ActiveItemService);
    private _debug = inject(PlaceDebugService);

    public readonly name = 'skills';

    public open_menu = false;
    public tab_list = [];
    public readonly loading = signal(false);
    public readonly debug_position = this._debug.position;
    public readonly item = signal<any>(null);
    public readonly newItem = () => this._service.create();
    public readonly scroll = signal(0);

    public updateTabList() {
        this.tab_list = [
            {
                id: 'about',
                name: i18n('SKILLS.TAB_ABOUT'),
                icon: { content: 'info' },
            },
        ];
    }

    public ngOnInit(): void {
        this.subscription(
            'loading',
            this._service.loading.subscribe((l) => this.loading.set(l)),
        );
        this.subscription(
            'item',
            this._service.item.subscribe((item) => {
                this.item.set(item);
            }),
        );
        this.updateTabList();
    }
}
