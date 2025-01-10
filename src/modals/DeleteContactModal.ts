import { App, Modal, TFile } from "obsidian";

export class DeleteContactModal extends Modal {
	constructor(
		app: App,
		private file: TFile,
		private onDelete: () => Promise<void>
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Delete Contact" });
		contentEl.createEl("p", {
			text: `Are you sure you want to delete ${this.file.basename}?`,
		});

		const buttonContainer = contentEl.createEl("div", {
			cls: "friend-tracker-modal-buttons",
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "friend-tracker-modal-button",
		});
		cancelButton.addEventListener("click", () => this.close());

		// Delete button
		const deleteButton = buttonContainer.createEl("button", {
			text: "Delete",
			cls: "friend-tracker-modal-button friend-tracker-modal-button-danger",
		});
		deleteButton.addEventListener("click", async () => {
			await this.onDelete();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
