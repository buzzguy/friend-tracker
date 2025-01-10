import { App, Modal } from "obsidian";

export class AddFieldModal extends Modal {
	private onSubmit: (fieldName: string) => void;

	constructor(app: App, onSubmit: (fieldName: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Add custom field" });

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
			text: "Add field",
			attr: { type: "submit" },
			cls: "contact-add-field-submit",
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
