import { ItemView, WorkspaceLeaf, EventRef, TFile, Platform } from "obsidian";
import type FriendTracker from "@/main";
import { TableView } from "./TableView";
import { ContactOperations } from "@/services/ContactOperations";
import { VIEW_TYPE_CONTACT_PAGE } from "@/views/ContactPageView";
import type { SortConfig, ContactWithCountdown } from "@/types";
import { AddContactModal } from "@/modals/AddContactModal";
import { DeleteContactModal } from "@/modals/DeleteContactModal";

export const VIEW_TYPE_FRIEND_TRACKER = "friend-tracker-view";

export class FriendTrackerView extends ItemView {
	currentSort: SortConfig = {
		column: "age",
		direction: "asc",
	};
	private tableView: TableView;
	private contactOps: ContactOperations;
	private fileChangeHandler: EventRef | null = null;
	private isRefreshing = false;

	constructor(leaf: WorkspaceLeaf, private plugin: FriendTracker) {
		super(leaf);
		this.tableView = new TableView(this);
		this.contactOps = new ContactOperations(this.plugin);
	}

	// ... rest of the implementation from earlier

	public async openAddContactModal() {
		const modal = new AddContactModal(this.app, this.plugin);
		modal.open();
	}

	public handleSort(column: keyof Omit<ContactWithCountdown, "file">) {
		if (this.currentSort.column === column) {
			this.currentSort.direction =
				this.currentSort.direction === "asc" ? "desc" : "asc";
		} else {
			this.currentSort = { column, direction: "asc" };
		}
		this.refresh();
	}

	public async openContact(file: TFile) {
		// Try to find existing contact page view
		const leaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_CONTACT_PAGE
		);
		const leaf =
			leaves.length > 0 ? leaves[0] : this.app.workspace.getLeaf("tab");

		await leaf.setViewState({
			type: VIEW_TYPE_CONTACT_PAGE,
			state: { filePath: file.path },
		});
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
		this.app.workspace.revealLeaf(leaf);

		// On mobile, collapse the main view after opening contact
		if (Platform.isMobile) {
			this.app.workspace.rightSplit.collapse();
		}
	}

	public async openDeleteModal(file: TFile) {
		const modal = new DeleteContactModal(this.app, file, async () => {
			await this.app.fileManager.trashFile(file);
			await this.refresh();
		});
		modal.open();
	}

	getViewType(): string {
		return VIEW_TYPE_FRIEND_TRACKER;
	}

	getDisplayText(): string {
		return "Friend tracker";
	}

	async onOpen() {
		if (this.fileChangeHandler) {
			this.app.vault.offref(this.fileChangeHandler);
			this.fileChangeHandler = null;
		}

		this.fileChangeHandler = this.app.vault.on("modify", (file) => {
			if (file instanceof TFile && this.isContactFile(file)) {
				setTimeout(() => this.refresh(), 100);
			}
		});

		await this.refresh();
	}

	async refresh() {
		if (this.isRefreshing) return;
		this.isRefreshing = true;

		try {
			const contacts = await this.contactOps.getContacts();
			const container = this.containerEl.children[1];
			container.empty();
			await this.tableView.render(
				container as HTMLElement,
				contacts,
				this.currentSort
			);
		} finally {
			this.isRefreshing = false;
		}
	}

	private isContactFile(file: TFile): boolean {
		const contactFolder = this.plugin.settings.contactsFolder;
		return file.path.startsWith(contactFolder + "/");
	}
}
