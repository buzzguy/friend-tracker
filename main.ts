import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	Notice,
	TFile,
	TFolder,
	ItemView,
	WorkspaceLeaf,
	parseYaml,
	Modal,
} from "obsidian";

const VIEW_TYPE_FRIEND_TRACKER = "friend-tracker-view";

interface FriendTrackerSettings {
	defaultFolder: string;
}

const DEFAULT_SETTINGS: FriendTrackerSettings = {
	defaultFolder: "FriendTracker",
};

interface Contact {
	name: string;
	birthday: string;
	relationship: string;
	age: number | null;
	file: TFile;
}

interface SortConfig {
	column: keyof Omit<Contact, "file">;
	direction: "asc" | "desc";
}

interface ContactWithCountdown extends Contact {
	formattedBirthday: string;
	daysUntilBirthday: number | null;
}

export default class FriendTracker extends Plugin {
	settings: FriendTrackerSettings;

	async onload() {
		await this.loadSettings();

		// Register the custom view
		this.registerView(
			VIEW_TYPE_FRIEND_TRACKER,
			(leaf) => new FriendTrackerView(leaf, this)
		);

		// Add ribbon icon to open the Friend Tracker view
		this.addRibbonIcon("user", "Open Friend Tracker", () => {
			this.activateView();
		});

		// Add settings tab
		this.addSettingTab(new FriendTrackerSettingTab(this.app, this));

		// Ensure the folder exists
		await this.ensureFolderExists();
	}

	async ensureFolderExists() {
		const folder = this.settings.defaultFolder;
		const vault = this.app.vault;

		if (!vault.getAbstractFileByPath(folder)) {
			await vault.createFolder(folder);
		}
	}

	async activateView() {
		const leaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_FRIEND_TRACKER
		);
		if (leaves.length) {
			this.app.workspace.revealLeaf(leaves[0]);
		} else {
			await this.app.workspace.getRightLeaf(false).setViewState({
				type: VIEW_TYPE_FRIEND_TRACKER,
				active: true,
			});
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FriendTrackerSettingTab extends PluginSettingTab {
	plugin: FriendTracker;

	constructor(app: App, plugin: FriendTracker) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Default Folder")
			.setDesc("Folder to store contact files")
			.addText((text) =>
				text
					.setPlaceholder("Enter folder name")
					.setValue(this.plugin.settings.defaultFolder)
					.onChange(async (value) => {
						this.plugin.settings.defaultFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}

class FriendTrackerView extends ItemView {
	plugin: FriendTracker;
	private fileChangeHandler: EventRef | null = null;
	private currentSort: SortConfig = {
		column: "age",
		direction: "asc",
	};
	private isRefreshing = false;

	constructor(leaf: WorkspaceLeaf, plugin: FriendTracker) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_FRIEND_TRACKER;
	}

	getDisplayText() {
		return "Friend Tracker";
	}

	getIcon() {
		return "user"; // Use Obsidian's "user" icon
	}

	async onOpen() {
		// Clear any existing handlers first
		if (this.fileChangeHandler) {
			this.app.vault.offref(this.fileChangeHandler);
			this.fileChangeHandler = null;
		}

		// Register new file change handler
		this.fileChangeHandler = this.app.vault.on("modify", (file) => {
			if (file instanceof TFile && this.isContactFile(file)) {
				// Debounce the refresh call
				setTimeout(() => this.refresh(), 100);
			}
		});

		// Initial refresh
		await this.refresh();
	}

	private isContactFile(file: TFile): boolean {
		const contactFolder = this.plugin.settings.defaultFolder;
		return file.path.startsWith(contactFolder + "/");
	}

	async refresh() {
		if (this.isRefreshing) return;
		this.isRefreshing = true;

		try {
			const container = this.containerEl.children[1];
			container.empty();

			// Create header and add contact button container
			const headerContainer = container.createEl("div", {
				cls: "friend-tracker-header",
			});
			headerContainer.createEl("h2", { text: "Friend Tracker" });

			const addButton = headerContainer.createEl("button", {
				text: "Add Contact",
				cls: "friend-tracker-add-button",
			});
			addButton.addEventListener("click", () =>
				this.openAddContactModal()
			);

			// Fetch and sort contacts
			let contacts = await this.getContacts();
			contacts = this.sortContacts(contacts, this.currentSort);

			if (contacts.length === 0) {
				const emptyState = container.createEl("div", {
					cls: "friend-tracker-empty-state",
				});
				emptyState.createEl("p", {
					text: "No contacts found. Get started by creating your first contact!",
				});
				return;
			}

			// Create table for contacts
			const table = container.createEl("table");
			table.style.width = "100%";

			// Create header row with sort buttons
			const headerRow = table.createEl("tr");
			const columns: Array<{
				key: keyof Omit<ContactWithCountdown, "file">;
				label: string;
			}> = [
				{ key: "name", label: "Name" },
				{ key: "age", label: "Age" },
				{ key: "formattedBirthday", label: "Birthday" },
				{ key: "daysUntilBirthday", label: "Days Until Birthday" },
				{ key: "relationship", label: "Relationship" },
			];

			columns.forEach(({ key, label }) => {
				const th = headerRow.createEl("th");
				const button = th.createEl("button", {
					cls: "friend-tracker-sort-button",
				});

				// Add text span
				button.createEl("span", { text: label });

				// Add sort indicator span
				const indicator = button.createEl("span", {
					cls: "sort-indicator",
					text:
						this.currentSort.column === key
							? this.currentSort.direction === "asc"
								? "↑"
								: "↓"
							: "",
				});

				button.addEventListener("click", () => {
					this.handleSort(key);
				});
			});

			// Create table rows
			contacts.forEach((contact) => {
				const row = table.createEl("tr");
				row.createEl("td", { text: contact.name });
				row.createEl("td", { text: contact.age?.toString() || "N/A" });
				row.createEl("td", {
					text: contact.formattedBirthday || "N/A",
				});
				row.createEl("td", {
					text:
						contact.daysUntilBirthday !== null
							? `${contact.daysUntilBirthday} days`
							: "N/A",
				});
				row.createEl("td", { text: contact.relationship || "N/A" });

				row.addEventListener("click", (e) => {
					if (!(e.target as HTMLElement).closest("button")) {
						this.openContact(contact.file);
					}
				});
			});
		} finally {
			this.isRefreshing = false;
		}
	}

	private handleSort(column: keyof Omit<Contact, "file">) {
		if (this.currentSort.column === column) {
			// Toggle direction if clicking the same column
			this.currentSort.direction =
				this.currentSort.direction === "asc" ? "desc" : "asc";
		} else {
			// New column, default to ascending
			this.currentSort = {
				column,
				direction: "asc",
			};
		}
		this.refresh();
	}

	private sortContacts(contacts: Contact[], sort: SortConfig): Contact[] {
		return [...contacts].sort((a, b) => {
			let valueA = a[sort.column];
			let valueB = b[sort.column];

			// Handle null/undefined values
			if (valueA == null) valueA = "";
			if (valueB == null) valueB = "";

			// Convert to strings for comparison
			const strA = valueA.toString().toLowerCase();
			const strB = valueB.toString().toLowerCase();

			const comparison = strA.localeCompare(strB);
			return sort.direction === "asc" ? comparison : -comparison;
		});
	}

	async getContacts(): Promise<ContactWithCountdown[]> {
		const folder = this.plugin.settings.defaultFolder;
		const vault = this.app.vault;
		const folderPath = vault.getAbstractFileByPath(folder);

		if (!folderPath || !(folderPath instanceof TFolder)) {
			new Notice("Friend Tracker folder not found.");
			return [];
		}

		const files = folderPath.children.filter(
			(file) => file instanceof TFile
		);
		const contacts: ContactWithCountdown[] = [];

		for (const file of files) {
			if (!(file instanceof TFile)) continue;

			const content = await vault.read(file);
			const metadata = this.parseYaml(content);

			if (metadata) {
				const age = this.calculateAge(metadata.birthday);
				const formattedBirthday = this.formatBirthday(
					metadata.birthday
				);
				const daysUntilBirthday = this.calculateDaysUntilBirthday(
					metadata.birthday
				);

				contacts.push({
					name: metadata.name || "Unknown",
					birthday: metadata.birthday || "",
					formattedBirthday,
					relationship: metadata.relationship || "",
					age,
					daysUntilBirthday,
					file,
				});
			}
		}

		return contacts;
	}

	private calculateAge(birthday: string): number | null {
		if (!birthday) return null;

		const birthDate = new Date(birthday);
		if (isNaN(birthDate.getTime())) return null;

		const today = new Date();
		let age = today.getFullYear() - birthDate.getFullYear();
		const monthDiff = today.getMonth() - birthDate.getMonth();

		if (
			monthDiff < 0 ||
			(monthDiff === 0 && today.getDate() < birthDate.getDate())
		) {
			age--;
		}

		return age;
	}

	private formatBirthday(dateStr: string): string {
		if (!dateStr) return "";
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return dateStr;

		return date.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
		});
	}

	private calculateDaysUntilBirthday(birthday: string): number | null {
		if (!birthday) return null;

		const today = new Date();
		const birthDate = new Date(birthday);
		if (isNaN(birthDate.getTime())) return null;

		// Create this year's birthday
		const thisYearBirthday = new Date(
			today.getFullYear(),
			birthDate.getMonth(),
			birthDate.getDate()
		);

		// If this year's birthday has passed, use next year's birthday
		if (thisYearBirthday < today) {
			thisYearBirthday.setFullYear(today.getFullYear() + 1);
		}

		// Calculate days difference
		const diffTime = thisYearBirthday.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		return diffDays;
	}

	parseYaml(content: string): Record<string, any> | null {
		const match = content.match(/^---\n([\s\S]+?)\n---/);
		return match ? parseYaml(match[1]) : null;
	}

	async openContact(file: TFile) {
		const leaf = this.app.workspace.getLeaf();
		await leaf.openFile(file);
	}

	async onClose() {
		if (this.fileChangeHandler) {
			this.app.vault.offref(this.fileChangeHandler);
			this.fileChangeHandler = null;
		}
		this.isRefreshing = false;
	}

	async openAddContactModal() {
		const modal = new AddContactModal(
			this.app,
			this.plugin,
			async (name) => {
				try {
					await this.createNewContact(name);
					modal.close();
					// Wait a brief moment before refreshing to ensure file system events are settled
					setTimeout(() => this.refresh(), 100);
				} catch (error) {
					new Notice(`Error creating contact: ${error}`);
				}
			}
		);
		modal.open();
	}

	async createNewContact(name: string) {
		const folder = this.plugin.settings.defaultFolder;
		const fileName = `${name}.md`;
		const filePath = `${folder}/${fileName}`;

		const content = [
			"---",
			`name: ${name}`,
			"birthday:", // YYYY-MM-DD format
			"relationship:",
			"email:",
			"phone:",
			"address:",
			"lastContacted:",
			"contactFrequency:", // e.g., "weekly", "monthly", "quarterly"
			"---",
			"",
			`# ${name}`,
			"",
			"## Family",
			"- Spouse: [[]]",
			"- Children: ",
			"  - [[]]",
			"",
			"## Recent Interactions",
			"_Add recent interactions here_",
			"",
			"## Important Information",
			"_Add important information here_",
			"",
			"## Notes",
			"_Add general notes here_",
		].join("\n");

		try {
			await this.app.vault.create(filePath, content);
			new Notice(`Created contact: ${name}`);
		} catch (error) {
			new Notice(`Error creating contact: ${error}`);
		}
	}
}

class AddContactModal extends Modal {
	plugin: FriendTracker;
	onSubmit: (name: string) => void;

	constructor(
		app: App,
		plugin: FriendTracker,
		onSubmit: (name: string) => void
	) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Add New Contact" });

		const form = contentEl.createEl("form");
		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			const nameInput = form.querySelector("input");
			if (nameInput?.value) {
				await this.onSubmit(nameInput.value);
				// Don't close here, let the caller handle it
			}
		});

		const nameInput = form.createEl("input", {
			attr: { type: "text", placeholder: "Contact name" },
		});
		nameInput.focus();

		form.createEl("button", {
			text: "Add Contact",
			attr: { type: "submit" },
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
