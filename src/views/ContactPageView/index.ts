import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	TFile,
	setIcon,
	parseYaml,
	MarkdownRenderer,
} from "obsidian";
import type FriendTracker from "@/main";
import { ContactFields } from "@/components/ContactFields";
import { InteractionView } from "@/components/InteractionView";
import type { Interaction } from "@/types";
import { AddFieldModal } from "@/modals/AddFieldModal";
import { InteractionModal } from "@/modals/InteractionModal";
import { VIEW_TYPE_FRIEND_TRACKER } from "@/views/FriendTrackerView";
import { FriendTrackerView } from "@/views/FriendTrackerView";
import { STANDARD_FIELDS, SYSTEM_FIELDS } from "@/constants";

export const VIEW_TYPE_CONTACT_PAGE = "contact-page-view";

export class ContactPageView extends ItemView {
	private _file: TFile | null = null;
	private contactData: any = {};
	private contactFields: ContactFields;
	private interactionView: InteractionView;
	public plugin: FriendTracker;

	public getRelationshipTypes(): string[] {
		return this.plugin.settings.relationshipTypes;
	}

	public async addRelationshipType(
		type: string,
		existingTypes?: string[]
	): Promise<void> {
		this.plugin.settings.relationshipTypes = [
			...(existingTypes || this.plugin.settings.relationshipTypes),
			type,
		];
		await this.plugin.saveSettings();
	}

	constructor(leaf: WorkspaceLeaf, private _plugin: FriendTracker) {
		super(leaf);
		this.plugin = _plugin;
		this.contactFields = new ContactFields(this);
		this.interactionView = new InteractionView(this);
	}

	getViewType(): string {
		return VIEW_TYPE_CONTACT_PAGE;
	}

	getDisplayText(): string {
		return this._file?.basename || "Contact";
	}

	get file() {
		return this._file;
	}

	async setState(state: any, result: any) {
		const file = this.app.vault.getFileByPath(state.filePath);
		if (file) {
			await this.setFile(file);
		}
		await super.setState(state, result);
	}

	getState() {
		return {
			type: VIEW_TYPE_CONTACT_PAGE,
			filePath: this._file?.path,
		};
	}

	async setFile(file: TFile) {
		this._file = file;
		if (this._file) {
			try {
				const content = await this.app.vault.read(file);
				const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
				this.contactData = yamlMatch ? parseYaml(yamlMatch[1]) : {};
			} catch (error) {
				console.error(
					`Error reading contact file ${file.path}:`,
					error
				);
				this.contactData = {};
			}
			this.render();
		}
	}

	render() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		if (!this.contactData || !this.contactData.name) {
			container.createEl("div", {
				text: "No contact data available",
				cls: "contact-empty-state",
			});
			return;
		}

		// Create header with editable name
		const header = container.createEl("div", {
			cls: "contact-page-header",
		});

		const nameContainer = header.createEl("div", {
			cls: "contact-name-container",
		});

		this.renderNameSection(nameContainer);

		// Basic Info Section
		const infoSection = container.createEl("div", {
			cls: "contact-info-section",
		});

		const basicInfo = infoSection.createEl("div", {
			cls: "contact-basic-info",
		});

		// Standard fields
		const standardFields = Object.values(STANDARD_FIELDS).filter(
			(field) => !SYSTEM_FIELDS.includes(field)
		);
		standardFields.forEach((field) => {
			this.contactFields.createInfoField(
				basicInfo,
				field,
				this.contactData[field]
			);
		});

		// Custom fields
		const excludedFields = [
			...SYSTEM_FIELDS,
			...standardFields.map((f) => f.toLowerCase()),
		];
		Object.entries(this.contactData)
			.filter(([key]) => !excludedFields.includes(key.toLowerCase()))
			.forEach(([key, value]) => {
				this.contactFields.createInfoField(
					basicInfo,
					key,
					value as string
				);
			});

		// Add custom field button
		const addFieldButton = basicInfo.createEl("button", {
			text: "Add custom field",
			cls: "contact-add-field-button",
		});
		addFieldButton.addEventListener("click", () => {
			this.openAddFieldModal();
		});

		// Notes Section
		this.renderNotesSection(container);

		// Interactions Section
		this.renderInteractionsSection(container);

		// Extras Section
		this.renderExtrasSection(container);
	}

	private renderNameSection(container: HTMLElement) {
		const nameSection = container.createEl("div", {
			cls: "contact-name-section",
		});

		const nameDisplay = nameSection.createEl("div", {
			cls: "contact-name-display",
		});

		const editContainer = nameDisplay.createEl("div", {
			cls: "contact-name-row",
		});

		const nameText = editContainer.createEl("h1", {
			text: this.contactData.name || "Unnamed Contact",
		});

		const nameInput = editContainer.createEl("input", {
			type: "text",
			value: this.contactData.name || "",
			placeholder: "Contact name",
			cls: "contact-name-input",
		});

		const editButton = editContainer.createEl("button", {
			cls: "contact-name-edit",
		});
		setIcon(editButton, "pencil");

		// Add age display if birthday exists
		if (this.contactData.birthday) {
			const ageText = this.calculateDetailedAge(
				this.contactData.birthday
			);
			nameDisplay.createEl("span", {
				text: ageText,
				cls: "contact-age-display",
			});
		}

		editButton.addEventListener("click", () => {
			if (!nameInput.classList.contains("editing")) {
				nameText.classList.add("editing");
				nameInput.classList.add("editing");
				setIcon(editButton, "checkmark");
				nameInput.focus();
			} else {
				saveNameChange();
			}
		});

		const saveNameChange = async () => {
			if (!this._file) return;
			const newName = nameInput.value.trim();
			if (newName) {
				this.contactData.name = nameInput.value;
				await this.saveContactData();

				// Rename the file
				if (this._file.parent) {
					const newPath = `${this._file.parent.path}/${newName}.md`;
					try {
						await this.app.fileManager.renameFile(
							this._file,
							newPath
						);
						new Notice(`Updated contact name`);

						// Refresh Friend Tracker view
						const friendTrackerLeaves =
							this.app.workspace.getLeavesOfType(
								VIEW_TYPE_FRIEND_TRACKER
							);
						for (const leaf of friendTrackerLeaves) {
							const view = await leaf.view;
							if (view instanceof FriendTrackerView) {
								await view.refresh();
								break;
							}
						}
					} catch (error) {
						new Notice(`Error updating file name: ${error}`);
					}
				}
			}
			nameText.textContent = nameInput.value || "Unnamed Contact";
			nameText.classList.remove("editing");
			nameInput.classList.remove("editing");
			setIcon(editButton, "pencil");
		};

		nameInput.addEventListener("change", saveNameChange);
	}

	private calculateDetailedAge(birthday: string): string {
		const birthDate = new Date(birthday + "T00:00:00Z");
		const today = new Date();
		const todayUTC = new Date(
			Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
		);

		let years = todayUTC.getUTCFullYear() - birthDate.getUTCFullYear();
		let months = todayUTC.getUTCMonth() - birthDate.getUTCMonth();

		// Adjust for day of month
		if (todayUTC.getUTCDate() < birthDate.getUTCDate()) {
			months--;
		}

		// Handle negative months
		if (months < 0) {
			years--;
			months += 12;
		}

		return `${years} years, ${months} months old`;
	}

	private renderNotesSection(container: HTMLElement) {
		const notesSection = container.createEl("div", {
			cls: "contact-notes-section",
		});
		notesSection.createEl("h2", { text: "Notes" });

		const notesInput = notesSection.createEl("textarea", {
			cls: "contact-notes-input",
			attr: {
				placeholder:
					"Add notes about family members, parents' names, or anything else you want to remember...",
			},
		});
		notesInput.value = this.contactData.notes || "";

		notesInput.addEventListener("input", () => {
			this.adjustTextareaHeight(notesInput);
		});

		setTimeout(() => {
			this.adjustTextareaHeight(notesInput);
		}, 0);

		notesInput.addEventListener("change", async () => {
			if (!this._file) return;
			this.contactData.notes = notesInput.value;
			await this.saveContactData();
		});
	}

	private renderInteractionsSection(container: HTMLElement) {
		const interactions = container.createEl("div", {
			cls: "contact-interactions selectable",
		});
		interactions.createEl("h2", { text: "Recent interactions" });

		const addButton = interactions.createEl("button", {
			text: "Add interaction",
			cls: "contact-add-interaction-button",
		});
		addButton.addEventListener("click", () => {
			this.openAddInteractionModal();
		});

		if (Array.isArray(this.contactData.interactions)) {
			this.interactionView.render(
				interactions,
				this.contactData.interactions
			);
		}
	}

	private async renderExtrasSection(container: HTMLElement) {
		const extrasSection = container.createEl("div", {
			cls: "contact-extras-section",
		});

		if (!this._file) return;

		const headerContainer = extrasSection.createEl("div", {
			cls: "contact-extras-header",
		});

		headerContainer.createEl("h2", { text: "Additional notes" });

		const editButton = headerContainer.createEl("button", {
			cls: "contact-extras-edit",
			attr: { "aria-label": "Edit in markdown" },
		});
		setIcon(editButton, "pencil");

		editButton.addEventListener("click", () => {
			this.app.workspace.openLinkText(this._file?.path || "", "", true);
		});

		try {
			const content = await this.app.vault.read(this._file);
			const extrasContent =
				content.split(/^---\n([\s\S]*?)\n---/).pop() || "";

			if (extrasContent.trim()) {
				const contentDiv = extrasSection.createEl("div", {
					cls: "contact-extras-content",
				});

				await MarkdownRenderer.renderMarkdown(
					extrasContent,
					contentDiv,
					this._file.path,
					this
				);

				// Add click handlers for internal links
				contentDiv.addEventListener("click", (event) => {
					const target = event.target as HTMLElement;
					if (target.tagName === "A") {
						const anchor = target as HTMLAnchorElement;
						const href = anchor.getAttribute("href");

						if (href?.startsWith("#")) {
							// Handle internal anchor links
							event.preventDefault();
							const targetEl = contentDiv.querySelector(href);
							targetEl?.scrollIntoView();
						} else if (!href?.startsWith("http")) {
							// Handle internal Obsidian links
							event.preventDefault();
							this.app.workspace.openLinkText(
								href || "",
								this._file?.path || "",
								event.ctrlKey || event.metaKey
							);
						}
					}
				});
			}
		} catch (error) {
			console.error(
				`Error reading extras from file ${this._file.path}:`,
				error
			);
		}
	}

	private adjustTextareaHeight(textarea: HTMLTextAreaElement) {
		textarea.classList.add("measuring");
		textarea.style.setProperty(
			"--scroll-height",
			`${textarea.scrollHeight}px`
		);
		textarea.classList.remove("measuring");
	}

	async saveContactData() {
		if (!this._file) return;

		// Sort interactions by date in descending order (newest first)
		if (this.contactData.interactions) {
			this.contactData.interactions.sort(
				(a: Interaction, b: Interaction) =>
					new Date(b.date).getTime() - new Date(a.date).getTime()
			);
		}

		await this.app.fileManager.processFrontMatter(
			this._file,
			(frontmatter) => {
				Object.assign(frontmatter, this.contactData);
			}
		);
	}

	// Modal methods
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

	public async openEditInteractionModal(
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
				this.contactData.interactions[index] = { date, text };
				await this.saveContactData();
				this.render();
			}
		);
		modal.open();
	}

	public async deleteInteraction(index: number) {
		this.contactData.interactions.splice(index, 1);
		await this.saveContactData();
		this.render();
	}

	async updateContactData(field: string, value: string) {
		this.contactData[field] = value;
		await this.saveContactData();
	}
}
