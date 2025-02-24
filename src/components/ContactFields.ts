import type { ContactPageView } from "@/views/ContactPageView";
import { STANDARD_FIELDS } from "@/constants";
import type FriendTracker from "@/main";

export function createRelationshipInput(
	container: HTMLElement,
	plugin: FriendTracker,
	value: string = "",
	onChange?: (value: string) => void
) {
	const input = container.createEl("input", {
		cls: "friend-tracker-modal-input",
		attr: {
			type: "text",
			value: value || "",
			placeholder: "Friend, Family, Colleague, etc.",
			list: "relationship-types",
			autocomplete: "on",
			role: "combobox",
			"aria-autocomplete": "list",
		},
	});

	// Create or get existing datalist
	let datalist = document.getElementById(
		"relationship-types"
	) as HTMLDataListElement;
	if (!datalist) {
		datalist = document.createElement("datalist");
		datalist.id = "relationship-types";
		document.body.appendChild(datalist);
	}

	// Update options
	const updateDatalist = (filter?: string) => {
		datalist.empty();
		const types = plugin.settings.relationshipTypes;
		types
			.filter((type) => !filter || type.includes(filter.toLowerCase()))
			.forEach((type) => {
				const option = datalist.createEl("option");
				option.text = type.charAt(0).toUpperCase() + type.slice(1);
			});
	};

	updateDatalist();

	// Add input event listener for immediate feedback
	input.addEventListener("input", () => {
		updateDatalist(input.value);
	});

	if (onChange) {
		input.addEventListener("change", () => {
			onChange(input.value);
		});
	}

	return input;
}

export class ContactFields {
	constructor(private view: ContactPageView) {}

	private createRelationshipField(container: HTMLElement, value: string) {
		const input = createRelationshipInput(
			container,
			this.view.plugin,
			value,
			async (newValue) => {
				const relationship = newValue.toLowerCase();
				await this.view.updateContactData(
					STANDARD_FIELDS.RELATIONSHIP,
					relationship
				);

				// Add new type if it doesn't exist
				if (
					relationship &&
					!this.view.getRelationshipTypes().includes(relationship)
				) {
					const types = this.view
						.getRelationshipTypes()
						.filter((type) => type.toLowerCase() !== relationship);
					await this.view.addRelationshipType(relationship, types);
				}
			}
		);
		input.className = "contact-field-input";
	}

	createInfoField(container: HTMLElement, label: string, value: string) {
		const field = container.createEl("div", { cls: "contact-field" });
		field.createEl("label", { text: label });

		if (label.toLowerCase() === STANDARD_FIELDS.BIRTHDAY) {
			this.createBirthdayField(field, value);
		} else if (label.toLowerCase() === STANDARD_FIELDS.PHONE) {
			this.createPhoneField(field, value);
		} else if (label.toLowerCase() === STANDARD_FIELDS.RELATIONSHIP) {
			this.createRelationshipField(field, value);
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
				pattern: "\\d{4}-\\d{2}-\\d{2}",
			},
		});

		input.addEventListener("change", async () => {
			if (!this.view.file) return;
			const formattedDate = input.value;
			await this.view.updateContactData("birthday", formattedDate);
		});
	}

	private createPhoneField(container: HTMLElement, value: string) {
		const input = container.createEl("input", {
			cls: "contact-field-input",
			attr: {
				type: "tel",
				value: value || "",
				placeholder: "+1234567890",
				pattern: "^[0-9+\\-]*$", // Allow only numbers, +, and -
			},
		});

		input.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement;
			target.value = target.value.replace(/[^0-9+-]/g, ""); // Keep only numbers, +, and -
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
