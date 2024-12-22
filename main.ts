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
	setIcon,
	EventRef,
} from "obsidian";
import { addIcon } from "obsidian";

const VIEW_TYPE_FRIEND_TRACKER = "friend-tracker-view";
const VIEW_TYPE_CONTACT_PAGE = "contact-page-view";

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
	column: keyof Omit<ContactWithCountdown, "file">;
	direction: "asc" | "desc";
}

interface ContactWithCountdown extends Contact {
	formattedBirthday: string;
	daysUntilBirthday: number | null;
}

// Add this interface for type safety
interface Interaction {
	date: string;
	text: string;
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

		// Register the contact page view
		this.registerView(
			VIEW_TYPE_CONTACT_PAGE,
			(leaf) => new ContactPageView(leaf, this)
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
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
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
				sortable?: boolean;
			}> = [
				{ key: "name", label: "Name", sortable: true },
				{ key: "age", label: "Age", sortable: true },
				{ key: "formattedBirthday", label: "Birthday", sortable: true },
				{
					key: "daysUntilBirthday",
					label: "Days Until Birthday",
					sortable: true,
				},
				{ key: "relationship", label: "Relationship", sortable: true },
				{ key: "name", label: "", sortable: false }, // Empty label for actions column
			];

			columns.forEach(({ key, label, sortable }) => {
				const th = headerRow.createEl("th");

				if (sortable) {
					const button = th.createEl("button", {
						cls: "friend-tracker-sort-button",
					});

					// Add text span
					button.createEl("span", { text: label });

					// Add sort indicator span
					button.createEl("span", {
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
				} else {
					th.setText(label);
				}
			});

			// Create table rows
			contacts.forEach((contact) => {
				const row = table.createEl("tr");

				// Create name cell with click handler
				const nameCell = row.createEl("td", {
					cls: "friend-tracker-name-cell",
					text: contact.name,
				});
				nameCell.addEventListener("click", (e) => {
					e.stopPropagation(); // Stop event from bubbling
					this.openContact(contact.file);
				});

				// Rest of the cells (no click handlers)
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

				// Actions cell
				const actionsCell = row.createEl("td", {
					cls: "friend-tracker-actions",
				});

				// Delete button
				const deleteButton = actionsCell.createEl("button", {
					cls: "friend-tracker-delete-button",
					attr: { "aria-label": "Remove contact" },
				});
				setIcon(deleteButton, "trash");

				deleteButton.addEventListener("click", (e) => {
					e.stopPropagation();
					this.openDeleteModal(contact.file);
				});
			});
		} finally {
			this.isRefreshing = false;
		}
	}

	private handleSort(column: keyof Omit<ContactWithCountdown, "file">) {
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

	private sortContacts(
		contacts: ContactWithCountdown[],
		sort: SortConfig
	): ContactWithCountdown[] {
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
		// Try to get an existing leaf in the center
		let leaf = this.app.workspace.getMostRecentLeaf();

		// If no leaf exists or it's not in the center, create a new one
		if (!leaf || leaf.getViewState().type === VIEW_TYPE_FRIEND_TRACKER) {
			leaf = this.app.workspace.getLeaf("tab");
		}

		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_CONTACT_PAGE,
				state: { filePath: file.path },
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	async onClose() {
		if (this.fileChangeHandler) {
			this.app.vault.offref(this.fileChangeHandler);
			this.fileChangeHandler = null;
		}
		this.isRefreshing = false;
	}

	async openAddContactModal() {
		const modal = new AddContactModal(this.app, async (contactData) => {
			const fileName = `${contactData.name}.md`;
			const filePath = `${this.plugin.settings.defaultFolder}/${fileName}`;

			// Ensure all standard fields exist in YAML
			const standardFields = {
				name: contactData.name,
				birthday: contactData.birthday || "",
				email: contactData.email || "",
				phone: contactData.phone || "",
				address: contactData.address || "",
				relationship: contactData.relationship || "",
				notes: contactData.notes || "",
			};

			// Create YAML frontmatter
			const yaml = Object.entries(standardFields)
				.map(([key, value]) => `${key}: ${value}`)
				.join("\n");

			const fileContent = `---\n${yaml}\n---\n`;

			try {
				await this.app.vault.create(filePath, fileContent);
				new Notice(`Created contact: ${contactData.name}`);
				this.refresh();
			} catch (error) {
				new Notice(`Error creating contact: ${error}`);
			}
		});
		modal.open();
	}

	private async openDeleteModal(file: TFile) {
		const modal = new DeleteContactModal(this.app, file, async () => {
			try {
				await this.app.vault.trash(file, true);
				new Notice(`Deleted contact: ${file.basename}`);
				this.refresh();
			} catch (error) {
				new Notice(`Error deleting contact: ${error}`);
			}
		});
		modal.open();
	}
}

class AddContactModal extends Modal {
	private onSubmit: (contactData: Record<string, string>) => void;

	constructor(
		app: App,
		onSubmit: (contactData: Record<string, string>) => void
	) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Add New Contact" });

		const form = contentEl.createEl("form", {
			cls: "friend-tracker-add-contact-form",
		});

		// Name field (required)
		const nameField = form.createDiv({ cls: "friend-tracker-modal-field" });
		nameField.createEl("label", { text: "Name *" });
		const nameInput = nameField.createEl("input", {
			attr: {
				type: "text",
				name: "name",
				required: "true",
				placeholder: "Contact name",
			},
			cls: "friend-tracker-modal-input",
		});
		nameInput.focus();

		// Birthday field (optional)
		const birthdayField = form.createDiv({
			cls: "friend-tracker-modal-field",
		});
		birthdayField.createEl("label", { text: "Birthday" });
		const birthdayInput = birthdayField.createEl("input", {
			attr: {
				type: "date",
				name: "birthday",
				placeholder: "YYYY-MM-DD",
			},
			cls: "friend-tracker-modal-input",
		});

		// Email field (optional)
		const emailField = form.createDiv({
			cls: "friend-tracker-modal-field",
		});
		emailField.createEl("label", { text: "Email" });
		const emailInput = emailField.createEl("input", {
			attr: {
				type: "email",
				name: "email",
				placeholder: "email@example.com",
			},
			cls: "friend-tracker-modal-input",
		});

		// Phone field (optional)
		const phoneField = form.createDiv({
			cls: "friend-tracker-modal-field",
		});
		phoneField.createEl("label", { text: "Phone" });
		const phoneInput = phoneField.createEl("input", {
			attr: {
				type: "tel",
				name: "phone",
				placeholder: "000-000-0000",
			},
			cls: "friend-tracker-modal-input",
		});

		// Submit button
		const buttonContainer = form.createDiv({
			cls: "friend-tracker-modal-buttons",
		});
		const submitButton = buttonContainer.createEl("button", {
			text: "Create Contact",
			attr: { type: "submit" },
			cls: "friend-tracker-modal-submit",
		});

		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const contactData: Record<string, string> = {
				name: nameInput.value,
			};

			if (birthdayInput.value) contactData.birthday = birthdayInput.value;
			if (emailInput.value) contactData.email = emailInput.value;
			if (phoneInput.value) contactData.phone = phoneInput.value;

			if (contactData.name) {
				this.onSubmit(contactData);
				this.close();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class DeleteContactModal extends Modal {
	constructor(
		app: App,
		private contact: TFile,
		private onConfirm: () => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Delete Contact" });
		contentEl.createEl("p", {
			text: `Are you sure you want to delete ${this.contact.basename}?`,
		});

		const buttonContainer = contentEl.createEl("div", {
			cls: "friend-tracker-delete-modal-buttons",
		});

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "friend-tracker-button-secondary",
		});
		cancelButton.addEventListener("click", () => this.close());

		const deleteButton = buttonContainer.createEl("button", {
			text: "Delete",
			cls: "friend-tracker-button-danger",
		});
		deleteButton.addEventListener("click", async () => {
			await this.onConfirm();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ContactPageView extends ItemView {
	private file: TFile | null = null;
	private contactData: any = {};

	constructor(leaf: WorkspaceLeaf, private plugin: FriendTracker) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CONTACT_PAGE;
	}

	getDisplayText(): string {
		return this.file?.basename || "Contact";
	}

	async onload() {
		super.onload();
	}

	async setState(state: any, result: any) {
		const file = this.app.vault.getAbstractFileByPath(state.filePath);
		if (file instanceof TFile) {
			await this.setFile(file);
		}
		await super.setState(state, result);
	}

	getState() {
		return {
			type: VIEW_TYPE_CONTACT_PAGE,
			filePath: this.file?.path,
		};
	}

	async setFile(file: TFile) {
		this.file = file;
		if (this.file) {
			const content = await this.app.vault.read(this.file);
			const match = content.match(/^---\n([\s\S]+?)\n---/);
			this.contactData = match ? parseYaml(match[1]) : {};
			this.render();
		}
	}

	render() {
		const container = this.containerEl.children[1];
		container.empty();

		if (!this.contactData || !this.contactData.name) {
			container.createEl("div", {
				text: "No contact data available",
				cls: "contact-empty-state",
			});
			return;
		}

		// Create a custom interface with editable name
		const header = container.createEl("div", {
			cls: "contact-page-header",
		});

		// Create name container for flex layout
		const nameContainer = header.createEl("div", {
			cls: "contact-name-container",
		});

		// Add editable name input
		const nameInput = nameContainer.createEl("input", {
			cls: "contact-name-input",
			attr: {
				type: "text",
				value: this.contactData.name || "",
				placeholder: "Contact name",
			},
		});

		// Handle name changes
		nameInput.addEventListener("change", async () => {
			if (!this.file?.parent) return;
			const newName = nameInput.value.trim();
			if (newName) {
				this.contactData.name = newName;

				const newPath = `${this.file.parent.path}/${newName}.md`;
				try {
					await this.app.fileManager.renameFile(this.file, newPath);
					new Notice(`Updated contact name`);
				} catch (error) {
					new Notice(`Error updating file name: ${error}`);
				}
			}
		});

		const infoSection = container.createEl("div", {
			cls: "contact-info-section",
		});

		// Basic Info
		const basicInfo = infoSection.createEl("div", {
			cls: "contact-basic-info",
		});

		// Standard fields first
		const standardFields = ["Birthday", "Email", "Phone", "Address"];
		standardFields.forEach((field) => {
			this.createInfoField(
				basicInfo,
				field,
				this.contactData[field.toLowerCase()]
			);
		});

		// Then any custom fields (excluding internal fields)
		const excludedFields = [
			"name",
			"interactions",
			"created",
			"updated",
			"notes",
			...standardFields.map((f) => f.toLowerCase()),
		];
		Object.entries(this.contactData)
			.filter(([key]) => !excludedFields.includes(key))
			.forEach(([key, value]) => {
				this.createInfoField(basicInfo, key, value as string);
			});

		// Add custom field button at the bottom
		const addFieldButton = basicInfo.createEl("button", {
			text: "Add Custom Field",
			cls: "contact-add-field-button",
		});
		addFieldButton.addEventListener("click", () => {
			this.openAddFieldModal();
		});

		// Add notes section before interactions
		const notesSection = container.createEl("div", {
			cls: "contact-notes-section",
		});
		notesSection.createEl("h2", { text: "Notes" });

		// Notes textarea
		const notesInput = notesSection.createEl("textarea", {
			cls: "contact-notes-input",
			attr: {
				placeholder:
					"Add notes about family members, parents' names, or anything else you want to remember...",
			},
		});
		notesInput.value = this.contactData.notes || "";

		// Auto-resize textarea as content changes
		notesInput.addEventListener("input", () => {
			notesInput.style.height = "auto";
			notesInput.style.height = notesInput.scrollHeight + "px";
		});

		// Save notes when changed
		notesInput.addEventListener("change", async () => {
			if (!this.file) return;
			this.contactData.notes = notesInput.value;
			await this.saveContactData();
		});

		// Trigger initial height adjustment
		setTimeout(() => {
			notesInput.style.height = "auto";
			notesInput.style.height = notesInput.scrollHeight + "px";
		}, 0);

		// Interactions section
		const interactions = container.createEl("div", {
			cls: "contact-interactions",
		});
		interactions.createEl("h2", { text: "Recent Interactions" });

		// Add interaction button
		const addButton = interactions.createEl("button", {
			text: "Add Interaction",
			cls: "contact-add-interaction-button",
		});
		addButton.addEventListener("click", () => {
			this.openAddInteractionModal();
		});

		// Display existing interactions
		if (Array.isArray(this.contactData.interactions)) {
			const interactionsList = interactions.createEl("div", {
				cls: "contact-interactions-list",
			});

			// Sort interactions by date, most recent first
			const sortedInteractions = [...this.contactData.interactions].sort(
				(a, b) =>
					new Date(b.date).getTime() - new Date(a.date).getTime()
			);

			sortedInteractions.forEach(
				(interaction: Interaction, index: number) => {
					const interactionEl = interactionsList.createEl("div", {
						cls: "contact-interaction-item",
					});

					// Format date nicely, adjusting for timezone
					const [year, month, day] = interaction.date
						.split("-")
						.map(Number);
					const date = new Date(year, month - 1, day); // months are 0-based in JS
					const formattedDate = date.toLocaleDateString(undefined, {
						year: "numeric",
						month: "short",
						day: "numeric",
					});

					// Date
					const dateEl = interactionEl.createEl("div", {
						cls: "contact-interaction-date",
						text: formattedDate,
					});

					// Text
					const textEl = interactionEl.createEl("div", {
						cls: "contact-interaction-text",
						text: interaction.text,
					});

					// Actions
					const actions = interactionEl.createEl("div", {
						cls: "contact-interaction-actions",
					});

					// Edit button
					const editBtn = actions.createEl("button", {
						cls: "contact-interaction-edit",
						attr: { "aria-label": "Edit interaction" },
					});
					setIcon(editBtn, "pencil");

					// Delete button
					const deleteBtn = actions.createEl("button", {
						cls: "contact-interaction-delete",
						attr: { "aria-label": "Delete interaction" },
					});
					setIcon(deleteBtn, "trash");

					// Event handlers
					editBtn.addEventListener("click", () => {
						this.openEditInteractionModal(index, interaction);
					});

					deleteBtn.addEventListener("click", () => {
						this.deleteInteraction(index);
					});
				}
			);
		}
	}

	private createInfoField(
		container: HTMLElement,
		label: string,
		value: string
	) {
		const field = container.createEl("div", { cls: "contact-field" });
		field.createEl("label", { text: label });

		// Special handling for birthday field
		if (label === "Birthday") {
			const input = field.createEl("input", {
				cls: "contact-field-input",
				attr: {
					type: "date",
					value: value || "",
					placeholder: "YYYY-MM-DD",
				},
			});

			input.addEventListener("change", async () => {
				if (!this.file) return;
				const date = input.valueAsDate;
				const formattedDate = date
					? date.toISOString().split("T")[0]
					: input.value;
				this.contactData[label.toLowerCase()] = formattedDate;
				await this.saveContactData();
			});
		}
		// Special handling for phone field
		else if (label === "Phone") {
			const input = field.createEl("input", {
				cls: "contact-field-input",
				attr: {
					type: "tel",
					value: value || "",
					placeholder: "000-000-0000",
					pattern: "[0-9]{3}-[0-9]{3}-[0-9]{4}",
				},
			});

			// Format phone number as user types
			input.addEventListener("input", (e) => {
				const target = e.target as HTMLInputElement;
				let value = target.value.replace(/\D/g, ""); // Remove non-digits
				if (value.length > 0) {
					if (value.length <= 3) {
						target.value = value;
					} else if (value.length <= 6) {
						target.value = `${value.slice(0, 3)}-${value.slice(3)}`;
					} else {
						target.value = `${value.slice(0, 3)}-${value.slice(
							3,
							6
						)}-${value.slice(6, 10)}`;
					}
				}
			});

			input.addEventListener("change", async () => {
				if (!this.file) return;
				this.contactData[label.toLowerCase()] = input.value;
				await this.saveContactData();
			});
		}
		// Regular text input for other fields
		else {
			const input = field.createEl("input", {
				cls: "contact-field-input",
				attr: {
					type: "text",
					value: value || "",
					placeholder: "Not set",
				},
			});

			input.addEventListener("change", async () => {
				if (!this.file) return;
				this.contactData[label.toLowerCase()] = input.value;
				await this.saveContactData();
			});
		}
	}

	// Add this helper method to handle file saving
	private async saveContactData() {
		if (!this.file) return;

		// Read the current file content
		const content = await this.app.vault.read(this.file);

		// Split the content into YAML front matter and the rest
		const parts = content.split(/---\n([\s\S]+?)\n---/);

		if (parts.length >= 3) {
			// Format the YAML content properly
			const yamlLines = Object.entries(this.contactData).map(
				([key, value]) => {
					// Special handling for interactions array
					if (key === "interactions" && Array.isArray(value)) {
						const interactionsYaml = value
							.map(
								(interaction) =>
									`  - date: "${interaction.date}"\n    text: "${interaction.text}"`
							)
							.join("\n");
						return `${key}:\n${interactionsYaml}`;
					}
					// Regular fields
					return `${key}: ${value}`;
				}
			);

			// Reconstruct the file content
			const newContent = `---\n${yamlLines.join("\n")}\n---${parts[2]}`;

			// Save the file
			await this.app.vault.modify(this.file, newContent);
			new Notice(`Updated contact`);
		}
	}

	private async openAddFieldModal() {
		const modal = new AddFieldModal(this.app, async (fieldName) => {
			if (!this.contactData[fieldName]) {
				this.contactData[fieldName] = "";
				await this.saveContactData();
				this.render();
			} else {
				new Notice("Field already exists!");
			}
		});
		modal.open();
	}

	private async openAddInteractionModal() {
		const modal = new InteractionModal(
			this.app,
			null,
			async (date: string, text: string) => {
				if (!Array.isArray(this.contactData.interactions)) {
					this.contactData.interactions = [];
				}
				this.contactData.interactions.push({ date, text });
				await this.saveContactData();
				this.render();
			}
		);
		modal.open();
	}

	private async openEditInteractionModal(
		index: number,
		interaction: Interaction
	) {
		const modal = new InteractionModal(
			this.app,
			interaction,
			async (date: string, text: string) => {
				if (!Array.isArray(this.contactData.interactions)) {
					this.contactData.interactions = [];
				}

				// Keep the date as is since it's already in YYYY-MM-DD format
				this.contactData.interactions[index] = {
					date: date,
					text: text,
				};

				await this.saveContactData();
				this.render();
			}
		);
		modal.open();
	}

	private async deleteInteraction(index: number) {
		this.contactData.interactions.splice(index, 1);
		await this.saveContactData();
		this.render();
	}
}

// Add this new modal class
class AddFieldModal extends Modal {
	private onSubmit: (fieldName: string) => void;

	constructor(app: App, onSubmit: (fieldName: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Add Custom Field" });

		const form = contentEl.createEl("form");
		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const input = form.querySelector("input");
			if (input?.value) {
				this.onSubmit(input.value.toLowerCase());
				this.close();
			}
		});

		const input = form.createEl("input", {
			attr: {
				type: "text",
				placeholder: "Field name",
				pattern: "[a-zA-Z][a-zA-Z0-9]*",
			},
			cls: "contact-field-input",
		});
		input.focus();

		form.createEl("button", {
			text: "Add Field",
			attr: { type: "submit" },
			cls: "contact-add-field-submit",
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Add this new modal class for adding/editing interactions
class InteractionModal extends Modal {
	private interaction: Interaction | null;
	private onSubmit: (date: string, text: string) => void;

	constructor(
		app: App,
		interaction: Interaction | null,
		onSubmit: (date: string, text: string) => void
	) {
		super(app);
		this.interaction = interaction;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: this.interaction ? "Edit Interaction" : "Add Interaction",
		});

		const form = contentEl.createEl("form");
		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const dateInput = form.querySelector(
				"[type=date]"
			) as HTMLInputElement;
			const textInput = form.querySelector(
				"textarea"
			) as HTMLTextAreaElement;

			if (dateInput?.value && textInput?.value) {
				this.onSubmit(dateInput.value, textInput.value);
				this.close();
			}
		});

		// Date input
		const dateInput = form.createEl("input", {
			attr: {
				type: "date",
				value:
					this.interaction?.date ||
					new Date().toISOString().split("T")[0],
				required: "true",
			},
			cls: "contact-interaction-date-input",
		});

		// Text input
		const textInput = form.createEl("textarea", {
			attr: {
				placeholder: "What happened?",
				required: "true",
			},
			cls: "contact-interaction-text-input",
		});
		textInput.value = this.interaction?.text || "";

		// Submit button
		form.createEl("button", {
			text: this.interaction ? "Save Changes" : "Add Interaction",
			attr: { type: "submit" },
			cls: "contact-interaction-submit",
		});
	}
}
