import type { ContactPageView } from "@/views/ContactPageView";

export class ContactFields {
	constructor(private view: ContactPageView) {}

	createInfoField(container: HTMLElement, label: string, value: string) {
		const field = container.createEl("div", { cls: "contact-field" });
		field.createEl("label", { text: label });

		if (label === "Birthday") {
			this.createBirthdayField(field, value);
		} else if (label === "Phone") {
			this.createPhoneField(field, value);
		} else {
			this.createTextField(field, label, value);
		}
	}

	private createBirthdayField(container: HTMLElement, value: string) {
		const input = container.createEl("input", {
			cls: "contact-field-input",
			attr: {
				type: "date",
				value: value || "",
				placeholder: "YYYY-MM-DD",
			},
		});

		input.addEventListener("change", async () => {
			if (!this.view.file) return;
			const date = input.valueAsDate;
			const formattedDate = date
				? date.toISOString().split("T")[0]
				: input.value;
			await this.view.updateContactData("birthday", formattedDate);
		});
	}

	private createPhoneField(container: HTMLElement, value: string) {
		const input = container.createEl("input", {
			cls: "contact-field-input",
			attr: {
				type: "tel",
				value: value || "",
				placeholder: "000-000-0000",
				pattern: "[0-9]{3}-[0-9]{3}-[0-9]{4}",
			},
		});

		input.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement;
			const value = target.value.replace(/\D/g, "");
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
			await this.view.updateContactData("phone", input.value);
		});
	}

	private createTextField(
		container: HTMLElement,
		label: string,
		value: string
	) {
		const input = container.createEl("input", {
			cls: "contact-field-input",
			attr: {
				type: "text",
				value: value || "",
				placeholder: "Not set",
			},
		});

		input.addEventListener("change", async () => {
			await this.view.updateContactData(label.toLowerCase(), input.value);
		});
	}
}
