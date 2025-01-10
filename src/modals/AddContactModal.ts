import { App, Modal, Notice } from "obsidian";
import type FriendTracker from "@/main";
import { stringifyYaml } from "obsidian";

export class AddContactModal extends Modal {
	constructor(app: App, private plugin: FriendTracker) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Add new contact" });

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
				required: true,
				placeholder: "Contact name",
			},
			cls: "friend-tracker-modal-input",
		});
		nameInput.focus();

		// Birthday field
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

		// Email field
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

		// Phone field
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

		// Relationship field
		const relationshipField = form.createDiv({
			cls: "friend-tracker-modal-field",
		});
		relationshipField.createEl("label", { text: "Relationship" });
		const relationshipInput = relationshipField.createEl("input", {
			attr: {
				type: "text",
				name: "relationship",
				placeholder: "Friend, Family, Colleague, etc.",
			},
			cls: "friend-tracker-modal-input",
		});

		// Submit button
		form.createEl("button", {
			text: "Create contact",
			attr: { type: "submit" },
			cls: "friend-tracker-modal-submit",
		});

		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const data: Record<string, string> = {
				name: nameInput.value,
			};

			if (birthdayInput.value) data.birthday = birthdayInput.value;
			if (emailInput.value) data.email = emailInput.value;
			if (phoneInput.value) data.phone = phoneInput.value;
			if (relationshipInput.value)
				data.relationship = relationshipInput.value;

			if (data.name) {
				this.onSubmit(data);
				this.close();
			}
		});
	}

	private async onSubmit(data: Record<string, string>) {
		const fileName = `${data.name}.md`;
		const filePath = `${this.plugin.settings.contactsFolder}/${fileName}`;

		// Ensure folder exists before creating contact
		const folder = this.plugin.settings.contactsFolder;
		if (!this.app.vault.getFolderByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		// Create YAML frontmatter
		const yaml = stringifyYaml(data);
		const fileContent = `---\n${yaml}\n---\n`;

		this.app.vault
			.create(filePath, fileContent)
			.then(() => {
				new Notice(`Created contact: ${data.name}`);
			})
			.catch((error) => {
				new Notice(`Error creating contact: ${error}`);
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
